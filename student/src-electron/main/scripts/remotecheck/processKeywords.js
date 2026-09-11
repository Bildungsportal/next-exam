/**
 * Shared keyword matching for remotecheck process detection (exact stem; multi-word = cmd substring).
 */

// Process stems reported only via net scan allowlist — skip keyword detect (still killed via appsToClose).
const REMOTE_KEYWORD_DETECT_SKIP = new Set(['msedgewebview2']);

/** Lowercase executable stem without .exe suffix. */
export function normalizeStem(name) {
    return String(name || '').toLowerCase().replace(/\.exe$/i, '').trim();
}

/** Parse Windows tasklist /fo csv image names into lowercase stems. */
export function parseWinTasklistStems(stdout) {
    const stems = new Set();
    for (const line of String(stdout || '').split('\n')) {
        const m = line.match(/^"([^"]+)"/);
        if (!m) continue;
        const stem = normalizeStem(m[1]);
        if (stem) stems.add(stem);
    }
    return stems;
}

/** Parse ps aux rows into stems (basename of argv0) plus raw command strings. */
export function parsePsRows(stdout) {
    const stems = new Set();
    const cmdLines = [];
    for (const line of String(stdout || '').split('\n').slice(1)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length < 11) continue;
        const cmd = parts.slice(10).join(' ');
        cmdLines.push(cmd);
        const first = cmd.split(/\s+/)[0].replace(/^['"]|['"]$/g, '');
        const base = first.split(/[/\\]/).pop();
        const stem = normalizeStem(base);
        if (stem) stems.add(stem);
    }
    return { stems, cmdLines };
}

/**
 * Match appsToClose keywords: single-token = exact stem; multi-word = cmdline substring only.
 * @param {Set<string>} stems
 * @param {string[]} keywords
 * @param {string[]} [cmdLines]
 */
export function findKeywordHits(stems, keywords, cmdLines = []) {
    const found = [];
    const seen = new Set();
    for (const keyword of keywords) {
        const k = normalizeStem(keyword);
        if (!k || seen.has(k) || REMOTE_KEYWORD_DETECT_SKIP.has(k)) continue;
        const multiWord = k.includes(' ');
        const hit = multiWord
            ? cmdLines.some((cmd) => cmd.toLowerCase().includes(k))
            : stems.has(k);
        if (hit) {
            seen.add(k);
            found.push(keyword);
        }
    }
    return found;
}
