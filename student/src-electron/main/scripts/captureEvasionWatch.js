/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * Detect foreign windows hidden from screen capture (SetWindowDisplayAffinity WDA_MONITOR /
 * WDA_EXCLUDEFROMCAPTURE) on Windows. Affinity persists while hidden, so a cheat overlay
 * (focusable:false + showInactive) is found even when it is not shown. Windows only (koffi FFI).
 */

import { app } from 'electron';
import log from 'electron-log';
import { createRequire } from 'module';

let api = null;   // lazily bound user32/kernel32 functions; false = unavailable

/** Bind the needed Win32 functions once via koffi (only ever imported on win32). */
async function loadApi() {
    if (api !== null) return api;
    try {
        const koffi = createRequire(import.meta.url)('koffi');   // no dynamic import(): bytenode-compiled main has no import callback
        const user32 = koffi.load('user32.dll');
        const kernel32 = koffi.load('kernel32.dll');
        koffi.proto('int __stdcall EnumWindowsProc(void *hwnd, intptr_t lParam)');
        api = {
            EnumWindows: user32.func('int __stdcall EnumWindows(EnumWindowsProc *cb, intptr_t lParam)'),
            GetWindowDisplayAffinity: user32.func('int __stdcall GetWindowDisplayAffinity(void *hwnd, _Out_ uint32_t *affinity)'),
            GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *pid)'),
            OpenProcess: kernel32.func('void * __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)'),
            QueryFullProcessImageNameW: kernel32.func('int __stdcall QueryFullProcessImageNameW(void *h, uint32_t flags, void *buf, _Inout_ uint32_t *size)'),
            CloseHandle: kernel32.func('int __stdcall CloseHandle(void *h)'),
        };
    } catch (e) {
        log.error(`captureEvasionWatch @ loadApi: koffi unavailable: ${e.message}`);
        api = false;
    }
    return api;
}

/** Resolve the executable path of a pid (for logging only). */
function exePath(pid) {
    const h = api.OpenProcess(0x1000, 0, pid);   // PROCESS_QUERY_LIMITED_INFORMATION
    if (!h) return `pid=${pid}`;
    try {
        const buf = Buffer.alloc(1024);
        const size = [512];
        return api.QueryFullProcessImageNameW(h, 0, buf, size) ? buf.toString('utf16le', 0, size[0] * 2) : `pid=${pid}`;
    } finally {
        api.CloseHandle(h);
    }
}

/**
 * Scan all top-level windows for capture-excluded foreign windows and lock down on a hit.
 * @param {object} clientinfo - multicast clientinfo object
 * @param {{ applySecurityFocusLost?: (reason: string) => void }} [opts]
 */
export async function updateCaptureEvasionWatch(clientinfo, opts = {}) {
    if (process.platform !== 'win32' || !clientinfo?.exammode) return;
    if (!(await loadApi())) return;

    try {   // runs inside requestUpdate: a throw here must never skip the heartbeat
        const ownPids = new Set([process.pid, ...app.getAppMetrics().map((m) => m.pid)]);
        const hits = new Map();   // pid -> affinity
        api.EnumWindows((hwnd) => {
            const affinity = [0];
            if (api.GetWindowDisplayAffinity(hwnd, affinity) && affinity[0] !== 0) {
                const pid = [0];
                api.GetWindowThreadProcessId(hwnd, pid);
                if (!ownPids.has(pid[0])) hits.set(pid[0], affinity[0]);
            }
            return 1;
        }, 0);

        if (!hits.size) return;
        const summary = [...hits].map(([pid, aff]) => `${exePath(pid)}(pid=${pid}, affinity=0x${aff.toString(16)})`).join(', ');
        log.warn(`captureEvasionWatch @ updateCaptureEvasionWatch: capture-excluded window detected: ${summary}`);
        for (const pid of hits.keys()) {   // kill offender so a harmless tray app (password manager) does not re-lock every tick
            try {
                if (pid) process.kill(pid);
            } catch (e) {
                log.warn(`captureEvasionWatch @ updateCaptureEvasionWatch: kill pid=${pid} failed: ${e.message}`);
            }
        }
        if (opts.applySecurityFocusLost) opts.applySecurityFocusLost('captureEvasion');
    } catch (e) {
        log.error(`captureEvasionWatch @ updateCaptureEvasionWatch: scan failed: ${e.message}`);
    }
}
