/**
 * Resolve the official Windows 11 (multi-edition consumer) ISO download URL
 * via the microsoft.com session API — Microsoft publishes no static links.
 * Flow (same as Mido/quickget): download page → product edition id →
 * session permit → language SKU id → 24h-valid download link.
 * Edition (Education) is selected later by the GVLK key in autounattend.xml.
 * Used by teacher qemuService.js and (via CLI) teacher/scripts/qemu/buildandinstall.sh.
 */

import { pathToFileURL } from 'url';
import { randomUUID } from 'crypto';

export const MS_DOWNLOAD_PAGE = 'https://www.microsoft.com/en-us/software-download/windows11';
export const MS_PROFILE = '606624d44113';
const MS_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0';

/** GET url with browser-like UA; returns body text, throws on HTTP error. */
async function msFetchText(fetchImpl, userAgent, url, headers = {}) {
    const res = await fetchImpl(url, { headers: { 'User-Agent': userAgent, ...headers } });
    const body = await res.text();
    if (!res.ok) {
        throw new Error(`microsoft request failed: ${res.status} ${res.statusText} (${url.split('?')[0]})`);
    }
    return body;
}

/**
 * @param {object} [opts]
 * @param {Function} [opts.fetchImpl] pass Electron net.fetch from main process — Chromium TLS
 *   fingerprint avoids Sentinel bot-blocking that plain Node fetch can trigger.
 * @param {string} [opts.userAgent] must match fetchImpl's TLS stack (Chrome UA for net.fetch) —
 *   UA/TLS mismatch is a bot signal for Sentinel.
 * @returns {Promise<string>} direct x64 ISO download URL (valid ~24h)
 */
export async function resolveWindows11IsoUrl({ language = 'German', onLog = null, fetchImpl = fetch, userAgent = MS_USER_AGENT } = {}) {
    const log = (m) => { try { onLog?.(m); } catch (e) {} };

    log(`parsing download page ${MS_DOWNLOAD_PAGE}`);
    const pageHtml = await msFetchText(fetchImpl, userAgent, MS_DOWNLOAD_PAGE, { Accept: '' });
    const editionMatch = pageHtml.match(/<option value="(\d+)">Windows/);
    if (!editionMatch) {
        throw new Error('could not parse product edition id from microsoft download page');
    }
    const productEditionId = editionMatch[1];

    const sessionId = randomUUID();
    log(`product edition id ${productEditionId}, permit session ${sessionId}`);
    await msFetchText(fetchImpl, userAgent, `https://vlscppe.microsoft.com/tags?org_id=y6jn8c31&session_id=${sessionId}`, { Accept: '' });

    const skuBody = await msFetchText(
        fetchImpl,
        userAgent,
        `https://www.microsoft.com/software-download-connector/api/getskuinformationbyproductedition?profile=${MS_PROFILE}&ProductEditionId=${productEditionId}&SKU=undefined&friendlyFileName=undefined&Locale=en-US&sessionID=${sessionId}`
    );
    const skus = JSON.parse(skuBody)?.Skus || [];
    const sku = skus.find((s) => s?.Language === language || s?.LocalizedLanguage === language);
    if (!sku?.Id) {
        throw new Error(`no SKU for language "${language}" (available: ${skus.map((s) => s?.Language).join(', ')})`);
    }
    log(`language sku id ${sku.Id}`);

    // Referer required by Microsoft; this request is the one that gets IP-blocked ("Sentinel").
    const linkRes = await fetchImpl(
        `https://www.microsoft.com/software-download-connector/api/GetProductDownloadLinksBySku?profile=${MS_PROFILE}&productEditionId=undefined&SKU=${sku.Id}&friendlyFileName=undefined&Locale=en-US&sessionID=${sessionId}`,
        { headers: { 'User-Agent': userAgent, Referer: MS_DOWNLOAD_PAGE } }
    );
    const linkBody = await linkRes.text();
    if (linkBody.includes('Sentinel marked this request as rejected')) {
        throw new Error(`Microsoft blocked the automated download for this IP address. Download the ISO manually: ${MS_DOWNLOAD_PAGE}`);
    }
    if (!linkRes.ok) {
        throw new Error(`microsoft download link request failed: ${linkRes.status} ${linkRes.statusText}`);
    }
    const options = JSON.parse(linkBody)?.ProductDownloadOptions || [];
    const uri = options.map((o) => o?.Uri).find((u) => typeof u === 'string' && u.includes('x64'));
    if (!uri) {
        throw new Error(`no x64 ISO link in microsoft response. Download the ISO manually: ${MS_DOWNLOAD_PAGE}`);
    }
    return uri;
}

// CLI for buildandinstall.sh: prints the resolved URL on stdout, progress on stderr.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    resolveWindows11IsoUrl({ onLog: (m) => console.error(`[qemuWindowsIsoUrl] ${m}`) })
        .then((u) => { console.log(u); })
        .catch((e) => { console.error(String(e?.message || e)); process.exit(1); });
}
