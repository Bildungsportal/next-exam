/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * Detect VT/tty switches (Ctrl+Alt+F3) on Linux by comparing the kernel's currently
 * visible VT against our own session VT. No root, no spawn, display-server independent.
 */

import fs from 'fs';
import log from 'electron-log';

let ownVt = null;   // resolved once from XDG_VTNR
let awayCount = 0;

/**
 * Refresh clientinfo.ttySwitch from /sys/class/tty/tty0/active and lock down on a foreign VT.
 * @param {object} clientinfo - multicast clientinfo object to mutate
 * @param {{ applySecurityFocusLost?: (reason: string) => void }} [opts]
 */
export function updateTtyWatch(clientinfo, opts = {}) {
    if (process.platform !== 'linux' || !clientinfo) return;
    if (ownVt === null) ownVt = process.env.XDG_VTNR ? `tty${process.env.XDG_VTNR}` : '';
    if (!ownVt) return;   // no VT (nested wayland / ssh) - detector not applicable, never guess

    let active;
    try {
        active = fs.readFileSync('/sys/class/tty/tty0/active', 'utf8').trim();
    } catch (e) {
        return;   // container / no VT subsystem
    }

    if (active === ownVt) return;

    awayCount++;
    log.warn(`ttyWatch @ updateTtyWatch: foreign VT active (${active}, own=${ownVt})`);
    clientinfo.ttySwitch = { vt: active, count: awayCount, ts: Date.now() };
    if (clientinfo.exammode && opts.applySecurityFocusLost) {
        opts.applySecurityFocusLost('ttySwitch');
    }
}
