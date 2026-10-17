/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * Refresh clientinfo.remoteassistant from appsToClose keyword/port scans (+ LT-port fake).
 * Network-active scan runs for local logs only; hits are not sent to the teacher.
 */

import log from 'electron-log';
import { runRemoteCheck } from './remoteCheck.js';
import { logNetworkActiveProcesses, findNonLanguageToolOn8088 } from './networkActiveProcesses.js';

/**
 * Run remote-assistant detectors and merge into clientinfo.remoteassistant.
 * @param {object} clientinfo - multicast clientinfo object to mutate
 * @param {{ applySecurityFocusLost?: (reason: string) => void, logTag?: string, skipNetworkScan?: boolean }} [opts]
 */
export async function updateRemoteAssistant(clientinfo, opts = {}) {
    if (!clientinfo) return;
    const logTag = opts.logTag || 'remoteAssistantScan';

    // skipNetworkScan: run only the cheap keyword+port remoteCheck (reported to teacher),
    // skip the PowerShell-heavy network scan (local logs only) so this can tick more often
    const [keywordHit, networkResult, ltFakes] = await Promise.all([
        runRemoteCheck(process.platform),
        opts.skipNetworkScan ? { processes: [] } : logNetworkActiveProcesses({ mode: 'both', prevSummary: clientinfo._networkScanSummary ?? null }).catch((err) => {
            log.warn(`${logTag} @ updateRemoteAssistant: networkActiveProcesses failed: ${err.message}`);
            return { processes: [] };
        }),
        opts.skipNetworkScan ? [] : findNonLanguageToolOn8088().catch((err) => {
            log.warn(`${logTag} @ updateRemoteAssistant: port 8088 check failed: ${err.message}`);
            return [];
        }),
    ]);

    if (!opts.skipNetworkScan && networkResult?.summary !== undefined) {
        clientinfo._networkScanSummary = networkResult.summary;
    }

    // skipNetworkScan: port-8088 not checked this tick -> keep any prior languagetoolFake untouched
    const ltFakePrev = !!clientinfo.remoteassistant?.languagetoolFake;
    if (ltFakes.length) {
        const occupantSummary = ltFakes.map((o) => `${o.name}(pid=${o.pid})`).join(', ');
        log.warn(`${logTag} @ updateRemoteAssistant: non-LanguageTool listener on port 8088: ${occupantSummary}`);
        if (clientinfo.exammode && opts.applySecurityFocusLost) {
            opts.applySecurityFocusLost('ltPort8088');
        }
        const ra = clientinfo.remoteassistant || { keywords: [], ports: [] };
        clientinfo.remoteassistant = { ...ra, languagetoolFake: true };
    } else if (!opts.skipNetworkScan && ltFakePrev) {
        const ra = { ...clientinfo.remoteassistant };
        delete ra.languagetoolFake;
        if (!ra.keywords?.length && !ra.ports?.length) {
            delete clientinfo.remoteassistant;
        } else {
            clientinfo.remoteassistant = ra;
        }
    }

    const keywordHits = keywordHit ? keywordHit.keywords : [];
    // localvm owns VNC :5901 — drop that port hit so QEMU does not look like remote assist
    let ports = keywordHit?.ports?.length ? keywordHit.ports : [];
    if (clientinfo.examtype === 'localvm') {
        ports = ports.filter((p) => Number(p) !== 5901);
    }

    if (keywordHits.length || ports.length) {
        const prevKeywords = clientinfo.remoteassistant?.keywords || [];
        const prevPorts    = clientinfo.remoteassistant?.ports    || [];
        const changed = keywordHits.length !== prevKeywords.length || ports.length !== prevPorts.length
            || keywordHits.some((k) => !prevKeywords.includes(k)) || ports.some((p) => !prevPorts.includes(p));
        if (changed) {
            const parts = [];
            if (keywordHits.length) parts.push(keywordHits.join(', '));
            if (ports.length) parts.push(`ports: ${ports.join(', ')}`);
            log.warn(`${logTag} @ updateRemoteAssistant: remote assistance apps: ${parts.join(' | ') || 'none'}`);
        }
        const ra = clientinfo.remoteassistant || { keywords: [], ports: [] };
        clientinfo.remoteassistant = {
            ...ra,
            keywords: keywordHits,
            ports: ports.length ? ports : (ra.ports || []),
        };
    } else if (clientinfo.remoteassistant?.languagetoolFake) {
        clientinfo.remoteassistant = { languagetoolFake: true };
    } else if (opts.skipNetworkScan && ltFakePrev) {
        // no keyword/port hit and port-8088 not rechecked -> preserve prior fake flag
        clientinfo.remoteassistant = { languagetoolFake: true };
    } else {
        delete clientinfo.remoteassistant;
    }
}
