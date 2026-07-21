/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * Windows-specific platform restrictions (enable/disable).
 */

import { join } from 'path';
import childProcess from 'child_process';
import log from 'electron-log';
import platformDispatcher from '../platformDispatcher.js';

const __dirname = import.meta.dirname;

// Never kill these via appsToClose substring match (AA kiosk + normal exam).
const WIN_APPS_KILL_SKIP = new Set(['explorer', 'powershell', 'reg', 'whoami', 'netsh', 'cmd']);


/** Kill appsToClose processes by name — one process scan, kill matches only. */
export async function killWindowsAppsToClose(appsToClose) {
    const stems = [...new Set(appsToClose
        .map((app) => String(app).replace(/\.exe$/i, '').trim().toLowerCase())
        .filter((stem) => stem && !WIN_APPS_KILL_SKIP.has(stem)))];
    if (stems.length === 0) return;

    const needles = stems.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
    const command = `powershell -NoProfile -Command "$needles=@(${needles});Get-Process -EA SilentlyContinue|ForEach-Object{$pn=$_.ProcessName.ToLower();foreach($n in $needles){if($pn -like ('*'+$n+'*')){Stop-Process -Id $_.Id -Force -EA SilentlyContinue;Write-Output $_.ProcessName;break}}}"`;

    await new Promise((resolve) => {
        childProcess.exec(command, (_error, stdout) => {
            const killed = stdout?.trim();
            if (killed) log.info(`platformrestrictions @ killWindowsAppsToClose: closed ${killed.replace(/\r?\n/g, ', ')}`);
            resolve();
        });
    });
}

/** Kill explorer.exe during exam lockdown (normal Win session, not Assigned Access). */
export function killWindowsExplorer() {
    if (platformDispatcher.skipElectronKiosk) return;
    try {
        childProcess.exec('taskkill /f /im explorer.exe', (error, stdout) => {
            if (!error && stdout) log.info('platformrestrictions @ killWindowsExplorer: closed explorer.exe');
        });
    } catch (err) {
        // silently ignore errors
    }
}

/**
 * Enable Windows-specific restrictions (keyboard shortcuts).
 */
export async function enableWindowsRestrictions() {
    if (platformDispatcher.skipElectronKiosk) return;
    try {
        const publicBase = platformDispatcher.publicBase;
        const executable1 = join(publicBase, 'disable-shortcuts.exe');
        childProcess.execFile(executable1, [], { detached: true, stdio: 'ignore', shell: false, windowsHide: true });
        log.info("platformrestrictions @ enableRestrictions: windows shortcuts disabled");
    } catch (err) { log.error(`platformrestrictions @ enableRestrictions (win shortcuts): ${err}`); }
}

/**
 * Disable Windows-specific restrictions (unblock shortcuts, restart explorer).
 */
export function disableWindowsRestrictions() {
    if (platformDispatcher.skipElectronKiosk) return;
    log.info("platformrestrictions @ disableRestrictions (win): unblocking shortcuts...");
    try {
        childProcess.exec(`taskkill  /IM "disable-shortcuts.exe" /T /F`, (error, stdout, stderr) => {
            if (!error && stdout) log.info(`platformrestrictions @ disableRestrictions: closed disable-shortcuts.exe`);
        });
    } catch (e) {
        // silently ignore errors
    }

    try {
        childProcess.exec('tasklist /FI "IMAGENAME eq explorer.exe"', (error, stdout, stderr) => {
            if (error) {
                log.error(`tasklist error: ${error}`);
                return;
            }
            if (!stdout.includes('explorer.exe')) {
                log.info("platformrestrictions @ disableRestrictions (win): restarting explorer...");
                const child = childProcess.exec('start explorer.exe', { detached: true, stdio: 'ignore' });
                child.unref();
            }
        });
    } catch (e) { log.error(`platformrestrictions @ disablerestrictions (win explorer): ${e.message}`); }
}
