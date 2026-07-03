/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * Refresh clientinfo.remoteassistant from keyword, network and LT-port scans.
 */

import log from 'electron-log';
import { runRemoteCheck } from './remoteCheck.js';
import { logNetworkActiveProcesses, findNonLanguageToolOn8088 } from './networkActiveProcesses.js';

/**
 * Run remote-assistant detectors and merge into clientinfo.remoteassistant.
 * @param {object} clientinfo - multicast clientinfo object to mutate
 * @param {{ applySecurityFocusLost?: (reason: string) => void, logTag?: string }} [opts]
 */
export async function updateRemoteAssistant(clientinfo, opts = {}) {
    if (!clientinfo) return;
    const logTag = opts.logTag || 'remoteAssistantScan';

    const [keywordHit, netScan, ltFakes] = await Promise.all([
        runRemoteCheck(process.platform),
        logNetworkActiveProcesses({ mode: 'both' }).catch((err) => {
            log.warn(`${logTag} @ updateRemoteAssistant: networkActiveProcesses failed: ${err.message}`);
            return { processes: [] };
        }),
        findNonLanguageToolOn8088().catch((err) => {
            log.warn(`${logTag} @ updateRemoteAssistant: port 8088 check failed: ${err.message}`);
            return [];
        }),
    ]);

    if (ltFakes.length) {
        const occupantSummary = ltFakes.map((o) => `${o.name}(pid=${o.pid})`).join(', ');
        log.warn(`${logTag} @ updateRemoteAssistant: non-LanguageTool listener on port 8088: ${occupantSummary}`);
        if (clientinfo.exammode && opts.applySecurityFocusLost) {
            opts.applySecurityFocusLost('ltPort8088');
        }
        const ra = clientinfo.remoteassistant || { keywords: [], ports: [] };
        clientinfo.remoteassistant = { ...ra, languagetoolFake: true };
    } else if (clientinfo.remoteassistant?.languagetoolFake) {
        const ra = { ...clientinfo.remoteassistant };
        delete ra.languagetoolFake;
        if (!ra.keywords?.length && !ra.ports?.length) {
            delete clientinfo.remoteassistant;
        } else {
            clientinfo.remoteassistant = ra;
        }
    }

    const algorithmicNames = [...new Set(netScan.processes.map((p) => p.name))];
    const keywordHits = keywordHit ? keywordHit.keywords : [];
    const mergedKeywords = [...new Set([...keywordHits, ...algorithmicNames])];
    const ports = keywordHit?.ports?.length ? keywordHit.ports : [];

    if (mergedKeywords.length || ports.length) {
        if (keywordHit?.keywords?.length) {
            log.warn(`${logTag} @ updateRemoteAssistant: possible remote assistance detected`);
            for (const keyword of keywordHit.keywords) {
                log.warn(`${logTag} @ updateRemoteAssistant: keyword ${keyword} detected`);
            }
        }
        if (keywordHit?.ports?.length) {
            for (const port of keywordHit.ports) {
                log.warn(`${logTag} @ updateRemoteAssistant: port ${port} detected`);
            }
        }
        const ra = clientinfo.remoteassistant || { keywords: [], ports: [] };
        clientinfo.remoteassistant = {
            ...ra,
            keywords: mergedKeywords,
            ports: ports.length ? ports : (ra.ports || []),
        };
    } else if (clientinfo.remoteassistant?.languagetoolFake) {
        clientinfo.remoteassistant = { languagetoolFake: true };
    } else {
        delete clientinfo.remoteassistant;
    }
}
