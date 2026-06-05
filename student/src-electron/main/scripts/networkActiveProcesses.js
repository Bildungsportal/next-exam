/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 *
 * Detect processes with non-localhost outbound TCP and/or TCP LISTEN sockets.
 * Excludes the Next-Exam process subtree, LanguageTool (cmdline/exe based) and a
 * small allowlist of system-critical processes. Does NOT kill - returns a list
 * so platform-specific scripts can kill later.
 */

import childProcess from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';
import platformDispatcher from './platformDispatcher.js';
import ltServer from './lt-server.js';

const execFileAsync = promisify(childProcess.execFile);

// LanguageTool process markers (cmdline/exe based; never port-based)
const LT_MARKERS = ['languagetool-server.jar', 'org.languagetool.server'];

// LT default listen port; conflict detection uses ltServer.port when set
const LT_DEFAULT_PORT = 8088;

// Next-Exam owned helper markers; cmdline-based safety net for processes that may
// outlive the main process (e.g. orphaned after dev HMR / unclean shutdown) and
// therefore escape PID-tree exclusion.
const NEXT_EXAM_CMDLINE_MARKERS = ['vncproxy-helper.cjs'];

// Minimal allowlist; goal: never break the OS. Compared against the executable basename, case-insensitive.
const SYSTEM_CRITICAL_NAMES = new Set([
    // linux
    'systemd', 'systemd-resolved', 'systemd-networkd', 'systemd-timesyncd',
    'dbus-daemon', 'dbus-broker', 'networkmanager', 'wpa_supplicant', 'avahi-daemon',
    'cupsd', 'sshd', 'pipewire', 'pipewire-pulse', 'pulseaudio',
    'xorg', 'wayland', 'gnome-shell', 'plasmashell', 'kwin_x11', 'kwin_wayland', 'kdeconnectd',
    // windows
    'svchost', 'svchost.exe', 'lsass', 'lsass.exe', 'services', 'services.exe',
    'wininit', 'wininit.exe', 'csrss', 'csrss.exe', 'winlogon', 'winlogon.exe',
    'dwm', 'dwm.exe', 'smss', 'smss.exe', 'registry', 'system',
    'fontdrvhost', 'fontdrvhost.exe', 'sgrmbroker', 'sgrmbroker.exe',
    'spoolsv', 'spoolsv.exe', 'jhi_service', 'jhi_service.exe',
    'smartscreen', 'smartscreen.exe', 'searchapp', 'searchapp.exe',
    'codemeter', 'codemeter.exe', 'mdnsresponder', 'mdnsresponder.exe',
    // macOS
    'launchd', 'mdnsresponder', 'syslogd', 'configd', 'kernel_task',
    'windowserver', 'loginwindow', 'coreaudiod', 'trustd', 'symptomsd'
]);

/**
 * Spawn an external command and return stdout; swallows errors and returns ''.
 * @param {string} cmd - executable name
 * @param {string[]} args - argv
 * @returns {Promise<string>}
 */
async function sh(cmd, args) {
    try {
        const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 12 << 20, windowsHide: true });
        return String(stdout || '');
    } catch {
        return '';
    }
}

/**
 * True if cmdline/exe identifies Next-Exam's LanguageTool server (never port-based).
 * @param {string} cmd
 * @param {string} [exe]
 */
const isLt = (cmd, exe) => {
    const s = `${cmd || ''} ${exe || ''}`.toLowerCase();
    return s.includes('languagetool') || LT_MARKERS.some((m) => s.includes(m));
};

/**
 * True if process basename is in the OS-critical allowlist.
 * @param {string} name - process name or absolute path
 */
const isSysCritical = (name) => {
    if (!name) return false;
    return SYSTEM_CRITICAL_NAMES.has(String(name).split(/[/\\]/).pop().toLowerCase());
};

/**
 * True if host string is loopback / any-address (treated as non-outbound).
 * @param {string} h
 */
const isLocal = (h) => {
    if (!h) return true;
    const x = String(h).toLowerCase();
    return x === '127.0.0.1' || x === '::1' || x === 'localhost' || x === '[::1]' || x === '0.0.0.0';
};

/**
 * BFS over pid->ppid edges to collect rootPid and all its descendants.
 * @param {number} rootPid
 * @param {{pid:number,ppid:number}[]} edges
 * @returns {Set<number>}
 */
function descendants(rootPid, edges) {
    const kids = new Map();
    for (const { pid, ppid } of edges) {
        if (!kids.has(ppid)) kids.set(ppid, []);
        kids.get(ppid).push(pid);
    }
    const out = new Set([rootPid]);
    const queue = [rootPid];
    while (queue.length) {
        const p = queue.shift();
        for (const c of (kids.get(p) || [])) {
            if (!out.has(c)) { out.add(c); queue.push(c); }
        }
    }
    return out;
}

// Read all (pid, ppid) edges from the OS; used by getNextExamExcludePids.
async function pidPpidEdges() {
    const text = platformDispatcher.platform === 'win32'
        ? await sh('powershell', ['-NoProfile', '-Command',
            'Get-CimInstance Win32_Process | ForEach-Object { "{0} {1}" -f $_.ProcessId, $_.ParentProcessId }'])
        : await sh('ps', ['-axo', 'pid=,ppid=']);
    const edges = [];
    for (const line of text.split('\n')) {
        const m = line.trim().match(/^(\d+)\s+(\d+)/);
        if (m) edges.push({ pid: +m[1], ppid: +m[2] });
    }
    return edges;
}

/**
 * Build the exclude set: Next-Exam main + descendants + LT child pid if alive.
 * Used by getNetworkActiveProcesses + logNetworkActiveProcesses.
 * @returns {Promise<Set<number>>}
 */
export async function getNextExamExcludePids() {
    const tree = descendants(process.pid, await pidPpidEdges());
    const ltPid = ltServer?.languageToolProcess?.pid;
    if (Number.isFinite(ltPid)) tree.add(ltPid);
    return tree;
}

/**
 * macOS `comm` is capped at 16 chars; use the first token of the full command line instead.
 * @param {string} cmdline
 */
function darwinProcessName(cmdline) {
    const s = String(cmdline || '').trim();
    if (!s) return '';
    return s.split(/\s+/)[0].replace(/^['"]|['"]$/g, '');
}

/**
 * Resolve pid -> {name, cmdline} via `ps` (Linux/macOS), in batches; used by collectLinux + collectDarwin.
 * @param {Iterable<number>} pids
 * @returns {Promise<Map<number,{name:string,cmdline:string}>>}
 */
async function unixMeta(pids) {
    const arr = [...new Set([...pids].filter(Number.isFinite))].sort((a, b) => a - b);
    const meta = new Map();
    const isDarwin = platformDispatcher.platform === 'darwin';
    for (let i = 0; i < arr.length; i += 80) {
        const chunk = arr.slice(i, i + 80);
        const text = await sh('ps', ['-p', chunk.join(','), '-o', isDarwin ? 'pid=,command=' : 'pid=,comm=,args=']);
        for (const line of text.split('\n')) {
            if (isDarwin) {
                const m = line.trim().match(/^(\d+)\s+(.*)$/);
                if (!m) continue;
                const cmdline = m[2].trim();
                meta.set(+m[1], { name: darwinProcessName(cmdline) || 'unknown', cmdline });
            } else {
                const m = line.trim().match(/^(\d+)\s+(\S+)\s*(.*)$/);
                if (!m) continue;
                meta.set(+m[1], { name: m[2], cmdline: m[3] || m[2] });
            }
        }
    }
    return meta;
}

/**
 * Extract local port from an `ss` local endpoint token like '127.0.0.1:8088' or '[::]:22'.
 * @param {string} tok
 */
function portFromSsLocal(tok) {
    const s = String(tok || '');
    const colon = s.lastIndexOf(':');
    if (colon < 0) return null;
    const p = +s.slice(colon + 1);
    return Number.isFinite(p) ? p : null;
}

/**
 * Extract host from `ss` peer endpoint token; returns IPv4 or IPv6 inside brackets.
 * @param {string} tok
 */
function hostFromSsPeer(tok) {
    if (!tok || tok === '*') return null;
    const s = String(tok).trim();
    if (s.startsWith('[')) {
        const end = s.indexOf(']');
        return end > 0 ? s.slice(1, end) : s;
    }
    const colon = s.lastIndexOf(':');
    return colon <= 0 ? s : s.slice(0, colon);
}

/** Linux: established (non-loopback) and TCP listen via ss; used by getNetworkActiveProcesses. */
async function collectLinux() {
    const rows = new Map();
    const row = (pid) => {
        if (!rows.has(pid)) rows.set(pid, {
            pid, name: 'unknown', cmdline: '', exe: undefined,
            reasons: { outbound: false, listen: false }, listenPorts: new Set()
        });
        return rows.get(pid);
    };

    const est = await sh('ss', ['-Htanp', 'state', 'established']);
    for (const line of est.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) continue;
        if (isLocal(hostFromSsPeer(parts[4]))) continue;
        const m = line.match(/pid=(\d+)/);
        if (m) row(+m[1]).reasons.outbound = true;
    }

    const lst = await sh('ss', ['-Htlnp']);
    for (const line of lst.split('\n')) {
        if (!line.includes('LISTEN')) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        const m = line.match(/pid=(\d+)/);
        if (!m) continue;
        const r = row(+m[1]);
        r.reasons.listen = true;
        const port = portFromSsLocal(parts[3]);
        if (Number.isFinite(port)) r.listenPorts.add(port);
    }

    const meta = await unixMeta(rows.keys());
    for (const [pid, r] of rows) {
        const m = meta.get(pid);
        if (m) { r.name = m.name; r.cmdline = m.cmdline; }
    }
    return [...rows.values()];
}

/** macOS: established (non-loopback) and TCP listen via lsof; used by getNetworkActiveProcesses. */
async function collectDarwin() {
    const rows = new Map();
    const row = (pid, name) => {
        if (!rows.has(pid)) rows.set(pid, {
            pid, name, cmdline: '', exe: undefined,
            reasons: { outbound: false, listen: false }, listenPorts: new Set()
        });
        return rows.get(pid);
    };

    /**
     * Parse one lsof output (ESTABLISHED or LISTEN) into rows.
     * @param {string} text
     * @param {'established'|'listen'} kind
     */
    const parse = (text, kind) => {
        for (const line of text.split('\n')) {
            const t = line.trim();
            if (!t || t.startsWith('COMMAND')) continue;
            const parts = t.split(/\s+/);
            if (parts.length < 9) continue;
            const pid = +parts[1];
            if (!Number.isFinite(pid)) continue;
            const tail = parts.slice(8).join(' ');
            if (kind === 'established') {
                const arrow = tail.indexOf('->');
                if (arrow < 0) continue;
                if (isLocal(tail.slice(arrow + 2).trim().split(':')[0])) continue;
                row(pid, parts[0]).reasons.outbound = true;
            } else {
                const m = tail.match(/:(\d+)\s+\(LISTEN\)/);
                const r = row(pid, parts[0]);
                r.reasons.listen = true;
                if (m) r.listenPorts.add(+m[1]);
            }
        }
    };

    parse(await sh('lsof', ['-nP', '-iTCP', '-sTCP:ESTABLISHED']), 'established');
    parse(await sh('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']), 'listen');

    const meta = await unixMeta(rows.keys());
    for (const [pid, r] of rows) {
        const m = meta.get(pid);
        if (m) { r.name = m.name; r.cmdline = m.cmdline; }
    }
    return [...rows.values()];
}

/**
 * Windows: single powershell.exe spawn that returns process tree + TCP connections as JSON.
 * Consolidates what used to be 3 separate PS invocations (Win32_Process for pid/ppid,
 * Get-NetTCPConnection est+listen, Get-Process per pid) into one to avoid ~600-1000ms
 * of cumulative PowerShell cold-start cost per scan.
 * @returns {Promise<{rows: object[], edges: {pid:number,ppid:number}[]}>}
 */
async function collectWin32() {
    // single PS script: enumerate all processes (for pid/ppid/meta) AND TCP connections;
    // result is one compact JSON object that JS parses below.
    const ps =
        '$procs = Get-CimInstance Win32_Process | ForEach-Object { ' +
            '[PSCustomObject]@{ p = $_.ProcessId; pp = $_.ParentProcessId; n = $_.Name; e = $_.ExecutablePath; c = $_.CommandLine } ' +
        '}; ' +
        '$est = Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | ' +
            'Where-Object { $_.RemoteAddress -notin @("127.0.0.1","::1","0.0.0.0") -and $_.OwningProcess -gt 0 } | ' +
            'ForEach-Object { $_.OwningProcess }; ' +
        '$lst = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ' +
            'Where-Object { $_.OwningProcess -gt 0 } | ' +
            'ForEach-Object { [PSCustomObject]@{ p = $_.OwningProcess; po = $_.LocalPort } }; ' +
        '[PSCustomObject]@{ procs = @($procs); est = @($est); lst = @($lst) } | ConvertTo-Json -Compress -Depth 4';
    const text = await sh('powershell', ['-NoProfile', '-Command', ps]);

    // defensive: strip non-JSON output (warnings, BOM, etc.) before parsing
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) return { rows: [], edges: [] };
    let data;
    try {
        data = JSON.parse(text.slice(start, end + 1));
    } catch (e) {
        log.warn(`networkActiveProcesses @ collectWin32: JSON parse failed: ${e.message}`);
        return { rows: [], edges: [] };
    }

    // ConvertTo-Json can unwrap single-element arrays to objects; normalize back to array
    const asArr = (v) => Array.isArray(v) ? v : (v ? [v] : []);
    const procs = asArr(data.procs);
    const estPids = asArr(data.est);
    const lstItems = asArr(data.lst);

    const edges = [];
    const procMeta = new Map();
    for (const p of procs) {
        const pid = +p.p;
        const ppid = +p.pp;
        if (!Number.isFinite(pid)) continue;
        if (Number.isFinite(ppid)) edges.push({ pid, ppid });
        procMeta.set(pid, {
            name: p.n || 'unknown',
            exe: p.e || '',
            cmdline: p.c || p.n || ''
        });
    }

    const rows = new Map();
    const row = (pid) => {
        if (!rows.has(pid)) rows.set(pid, {
            pid, name: 'unknown', cmdline: '', exe: '',
            reasons: { outbound: false, listen: false }, listenPorts: new Set()
        });
        return rows.get(pid);
    };
    for (const pidRaw of estPids) {
        const pid = +pidRaw;
        if (!Number.isFinite(pid) || pid <= 0) continue;
        row(pid).reasons.outbound = true;
    }
    for (const item of lstItems) {
        const pid = +item.p;
        if (!Number.isFinite(pid) || pid <= 0) continue;
        const r = row(pid);
        r.reasons.listen = true;
        const port = +item.po;
        if (Number.isFinite(port)) r.listenPorts.add(port);
    }

    for (const [pid, r] of rows) {
        const m = procMeta.get(pid);
        if (m) { r.name = m.name; r.exe = m.exe; r.cmdline = m.cmdline; }
    }

    return { rows: [...rows.values()], edges };
}

/**
 * Return network-active processes with Next-Exam, LT and system-critical filtered out.
 * Used by logNetworkActiveProcesses and (later) platform kill paths.
 * @param {object} [opts]
 * @param {Set<number>} [opts.excludePids] - precomputed exclude set (default: getNextExamExcludePids())
 * @param {string[]} [opts.extraExcludeCmdlineSubstrings] - extra cmdline substrings to drop (case-insensitive)
 * @param {'outbound'|'listen'|'both'} [opts.mode] - which reason(s) qualify a process for the result
 */
export async function getNetworkActiveProcesses(opts = {}) {
    const mode = opts.mode || 'both';
    const extras = (opts.extraExcludeCmdlineSubstrings || []).map((s) => String(s).toLowerCase());

    let rows = [];
    let excludePids;
    try {
        if (platformDispatcher.platform === 'win32') {
            // single consolidated PS call; reuse the edges it already produced for the exclude tree
            // instead of paying for another powershell.exe spawn via pidPpidEdges()
            const { rows: winRows, edges } = await collectWin32();
            rows = winRows;
            if (opts.excludePids instanceof Set) {
                excludePids = opts.excludePids;
            } else {
                const tree = descendants(process.pid, edges);
                const ltPid = ltServer?.languageToolProcess?.pid;
                if (Number.isFinite(ltPid)) tree.add(ltPid);
                excludePids = tree;
            }
        } else {
            excludePids = opts.excludePids instanceof Set ? opts.excludePids : await getNextExamExcludePids();
            if (platformDispatcher.platform === 'linux') rows = await collectLinux();
            else if (platformDispatcher.platform === 'darwin') rows = await collectDarwin();
        }
    } catch (e) {
        log.warn(`networkActiveProcesses @ getNetworkActiveProcesses: collect failed: ${e.message}`);
    }
    if (!excludePids) excludePids = new Set();

    const processes = [];
    for (const r of rows) {
        if (excludePids.has(r.pid)) continue;
        if (mode === 'outbound' && !r.reasons.outbound) continue;
        if (mode === 'listen' && !r.reasons.listen) continue;
        if (mode === 'both' && !r.reasons.outbound && !r.reasons.listen) continue;

        const cmd = r.cmdline || '';
        const cmdLower = cmd.toLowerCase();
        if (extras.some((sub) => cmdLower.includes(sub))) continue;
        if (NEXT_EXAM_CMDLINE_MARKERS.some((m) => cmdLower.includes(m))) continue;
        if (isSysCritical(r.name)) continue;
        if (isLt(cmd, r.exe)) continue;

        processes.push({
            pid: r.pid,
            name: r.name,
            cmdline: r.cmdline,
            exe: r.exe,
            reasons: { ...r.reasons },
            listenPorts: r.listenPorts ? [...r.listenPorts].sort((a, b) => a - b) : []
        });
    }
    return { processes, snapshotTs: Date.now() };
}

/** TCP listeners on 8088 that are not LanguageTool (already filtered by getNetworkActiveProcesses). */
export async function findNonLanguageToolOn8088() {
    const { processes } = await getNetworkActiveProcesses({ mode: 'listen' });
    return processes.filter((p) => p.listenPorts.includes(LT_DEFAULT_PORT));
}

/**
 * Run a scan and emit a summary + one electron-log line per candidate.
 * Used by communicationhandler requestUpdate (remote-check tick).
 * @param {object} [opts]
 * @param {'outbound'|'listen'|'both'} [opts.mode]
 */
export async function logNetworkActiveProcesses(opts = {}) {
    const { processes, snapshotTs } = await getNetworkActiveProcesses(opts);
    if (!processes.length) {
        log.info('networkActiveProcesses @ scan: no candidates');
        return { processes, snapshotTs };
    }
    // direction tag per process: L = listen only, O = outbound only, LO = both
    // aggregate identical name+direction+ports tuples with ×N to keep one line readable
    const counts = new Map();
    for (const p of processes) {
        const dir = p.reasons.listen && p.reasons.outbound ? 'LO'
            : p.reasons.listen ? 'L'
            : 'O';
        const ports = p.listenPorts.length ? p.listenPorts.join(',') : '';
        const label = ports ? `${p.name} ${dir}:${ports}` : `${p.name} ${dir}`;
        counts.set(label, (counts.get(label) || 0) + 1);
    }
    const items = [...counts.entries()].map(([label, n]) => n > 1 ? `${label} ×${n}` : label);
    log.info(`networkActiveProcesses @ scan: ${items.join(' | ')}`);
    return { processes, snapshotTs };
}
