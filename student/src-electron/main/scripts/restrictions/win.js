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

/**
 * Kill appsToClose processes by name (safe for Win Assigned Access — no explorer/AA internals).
 * @param {string[]} appsToClose - app names to kill
 */
export async function killWindowsAppsToClose(appsToClose) {
    try {
        for (const app of appsToClose) {
            const stem = String(app).replace(/\.exe$/i, '').trim().toLowerCase();
            if (!stem || WIN_APPS_KILL_SKIP.has(stem)) continue;
            const escapedApp = app.replace(/'/g, "''");
            const command = `powershell -NoProfile -Command "$appName = '${escapedApp}'; try { $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -ilike ('*' + $appName + '*') }; if ($procs -and $procs.Count -gt 0) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output 'killed' } } catch { }"`;
            await new Promise((resolveApp) => {
                childProcess.exec(command, (error, stdout, stderr) => {
                    if (!error && stdout && stdout.trim().includes('killed')) {
                        log.info(`platformrestrictions @ killWindowsAppsToClose: closed ${app}`);
                    }
                    resolveApp();
                });
            });
        }
    } catch (err) {
        // silently ignore errors
    }
}

/**
 * Enable Windows-specific restrictions (shortcuts, close apps, kill explorer).
 * @param {object} winhandler - must have winhandler.examwindow
 * @param {string[]} appsToClose - app names to kill
 */
export async function enableWindowsRestrictions(winhandler, appsToClose) {
    await killWindowsAppsToClose(appsToClose);
    if (platformDispatcher.skipElectronKiosk) return;
    try {
        const publicBase = platformDispatcher.publicBase;
        const executable1 = join(publicBase, 'disable-shortcuts.exe');
        childProcess.execFile(executable1, [], { detached: true, stdio: 'ignore', shell: false, windowsHide: true });
        log.info("platformrestrictions @ enableRestrictions: windows shortcuts disabled");
    } catch (err) { log.error(`platformrestrictions @ enableRestrictions (win shortcuts): ${err}`); }

    if (!winhandler) {
        log.warn(`platformrestrictions @ enableRestrictions: winhandler is not provided - skipping explorer.exe kill`);
    } else {
        let retryCount = 0;
        const maxRetries = 100;
        const killExplorerWhenWindowExists = () => {
            const win = winhandler.mainWin();
            if (win) {
                try {
                    childProcess.exec('taskkill /f /im explorer.exe', (error, stdout, stderr) => {
                        if (!error && stdout) log.info(`platformrestrictions @ enableRestrictions: closed explorer.exe`);
                    });
                } catch (err) {
                    // silently ignore errors
                }
            } else if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(killExplorerWhenWindowExists, 100);
            } else {
                log.warn(`platformrestrictions @ enableRestrictions: examwindow not found after ${maxRetries * 100}ms - skipping explorer.exe kill`);
            }
        };
        killExplorerWhenWindowExists();
    }
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
