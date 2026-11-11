/**
 * webFilter.js - URL filtering module for exam website navigation
 *
 * Determines whether navigation to a target URL should be allowed or blocked
 * based on the configured allowed URL and its blocking settings.
 *
 * @module webFilter
 */

/**
 * Check if navigation to a target URL should be allowed; returns result with optional block reason.
 *
 * @param {string} targetUrl - The URL the student is trying to navigate to
 * @param {string} allowedUrl - The base allowed URL (e.g. "https://www.example.com/path")
 * @param {boolean} blockSubdomains - If true, only the exact domain is allowed (no subdomains)
 * @param {boolean} blockSubfolders - If true, only the exact path (and below) of the allowed URL is permitted
 * @returns {{ allowed: boolean, reason?: string, domainMatched?: boolean }}
 */
function getUrlAllowResult(targetUrl, allowedUrl, blockSubdomains, blockSubfolders) {
    if (!targetUrl || !allowedUrl) {
        return { allowed: false, reason: 'missing or invalid target or allowed URL', domainMatched: false };
    }

    let allowedUrlObj;
    let targetUrlObj;

    try {
        let normalizedAllowed = allowedUrl;
        if (!normalizedAllowed.startsWith('http://') && !normalizedAllowed.startsWith('https://')) {
            normalizedAllowed = 'https://' + normalizedAllowed;
        }
        allowedUrlObj = new URL(normalizedAllowed);
    } catch (error) {
        return { allowed: false, reason: 'invalid allowed URL', domainMatched: false };
    }

    try {
        targetUrlObj = new URL(targetUrl);
    } catch (error) {
        return { allowed: false, reason: 'invalid target URL', domainMatched: false };
    }

    const allowedHostname = allowedUrlObj.hostname.toLowerCase();
    const targetHostname = targetUrlObj.hostname.toLowerCase();
    const allowedBase = allowedHostname.replace(/^www\./, '');
    const targetBase = targetHostname.replace(/^www\./, '');
    const targetIsSameOrSubdomainOfAllowed = (targetBase === allowedBase || targetBase.endsWith('.' + allowedBase));

    // --- Domain check ---
    if (blockSubdomains) {
        if (targetHostname !== allowedHostname && targetHostname !== 'www.' + allowedHostname && allowedHostname !== 'www.' + targetHostname) {
            return { allowed: false, reason: 'subdomain or different domain not allowed (blockSubdomains)', domainMatched: targetIsSameOrSubdomainOfAllowed };
        }
    } else {
        if (targetBase !== allowedBase && !targetBase.endsWith('.' + allowedBase)) {
            return { allowed: false, reason: 'domain not in allowed URLs', domainMatched: false };
        }
    }

    // --- Path check ---
    if (blockSubfolders) {
        const allowedPath = allowedUrlObj.pathname.replace(/\/+$/, '') || '/';
        const targetPath = targetUrlObj.pathname.replace(/\/+$/, '') || '/';

        if (allowedPath === '/') {
            if (targetPath !== '/') {
                return { allowed: false, reason: 'subfolder not allowed (only root allowed, blockSubfolders)', domainMatched: true };
            }
        } else {
            if (!targetPath.startsWith(allowedPath)) {
                return { allowed: false, reason: 'path not under allowed path (blockSubfolders)', domainMatched: true };
            }
        }
    }

    return { allowed: true };
}

/**
 * Check if navigation to a target URL should be allowed (boolean).
 * @returns {boolean}
 */
function isUrlAllowed(targetUrl, allowedUrl, blockSubdomains, blockSubfolders) {
    return getUrlAllowResult(targetUrl, allowedUrl, blockSubdomains, blockSubfolders).allowed;
}

export { isUrlAllowed, getUrlAllowResult };
