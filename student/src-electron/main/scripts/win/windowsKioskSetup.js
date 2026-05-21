/**
 * Windows counterpart to Linux Cage kiosk setup.
 * - detectRunningInWindowsKiosk(): true when current OS user === kiosk username
 * - detectWindowsKioskInstalled(): true when provisioning artifacts exist
 * - needsWindowsKioskSetup(): inverse, used by UI install button
 * - initiateKioskSetup(appPath): platform switch + UAC elevation + PowerShell payload
 *
 * Shares public field names with cage (runningInCage etc.) so renderer logic is unchanged.
 */
import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import log from 'electron-log';

export const KIOSK_USERNAME = 'next-exam-kiosk';
export const KIOSK_INSTALL_DIR = 'C:\\NextExam';
export const KIOSK_INSTALL_EXE = 'C:\\NextExam\\next-exam.exe';

// resolve packaged vs dev path to the PowerShell payload
function resolveProvisioningScript() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'win32', 'install-windows-kiosk.ps1');
    }
    return path.join(process.cwd(), 'src-electron', 'resources', 'win32', 'install-windows-kiosk.ps1');
}

/** True when this process runs as the dedicated kiosk OS user. */
export function detectRunningInWindowsKiosk() {
    if (process.platform !== 'win32') return false;
    try {
        const u = (os.userInfo().username || '').toLowerCase();
        return u === KIOSK_USERNAME.toLowerCase();
    } catch {
        return false;
    }
}

/** True when the portable exe has been copied to the public install location. */
export function detectWindowsKioskInstalled() {
    if (process.platform !== 'win32') return false;
    return existsSync(KIOSK_INSTALL_EXE);
}

/** True when the local kiosk OS user already exists (best-effort, swallow errors). */
export function detectWindowsKioskUserExists() {
    if (process.platform !== 'win32') return false;
    try {
        // Get-LocalUser exits non-zero when missing; swallow stderr to avoid noise
        execSync(`powershell.exe -NoProfile -NonInteractive -Command "Get-LocalUser -Name '${KIOSK_USERNAME}' | Out-Null"`,
            { stdio: ['ignore', 'ignore', 'ignore'] });
        return true;
    } catch {
        return false;
    }
}

/** UI should offer install when not yet provisioned and not already running as kiosk user. */
export function needsWindowsKioskSetup() {
    if (process.platform !== 'win32') return false;
    if (detectRunningInWindowsKiosk()) return false;
    return !(detectWindowsKioskInstalled() && detectWindowsKioskUserExists());
}

/** True when this process already runs with administrator token (avoids unneeded UAC prompt). */
function isProcessElevated() {
    try {
        // net session requires admin; exit 0 means elevated
        execSync('net session', { stdio: ['ignore', 'ignore', 'ignore'] });
        return true;
    } catch {
        return false;
    }
}

/**
 * Main entry. Linux path is handled elsewhere (pkexec install-cage-kiosk.sh).
 * On Windows: relaunches the PowerShell payload via `Start-Process -Verb RunAs` (UAC).
 * Returns Promise<{ok:boolean,error?:string,skipped?:boolean}>.
 */
export async function initiateKioskSetup(appPath) {
    if (process.platform !== 'win32') {
        // Linux/macOS callers should use their own setup path; signal no-op here
        return { ok: false, skipped: true, error: 'initiateKioskSetup: non-win32 handled elsewhere' };
    }

    const exe = appPath || process.execPath;
    if (!existsSync(exe)) {
        return { ok: false, error: `appPath does not exist: ${exe}` };
    }
    const script = resolveProvisioningScript();
    if (!existsSync(script)) {
        return { ok: false, error: `provisioning script not found: ${script}` };
    }

    // single-quote-escape paths for PowerShell literal strings
    const psEscape = (s) => String(s).replace(/'/g, "''");
    const scriptArg = `'${psEscape(script)}'`;
    const appArg = `'${psEscape(exe)}'`;

    // inner command run elevated; -ExecutionPolicy Bypass needed because file is unsigned
    const inner = `& powershell -NoProfile -ExecutionPolicy Bypass -File ${scriptArg} -AppPath ${appArg}`;

    // when already elevated (rare for a portable app) skip Start-Process and run inline
    if (isProcessElevated()) {
        log.info('windowsKioskSetup: already elevated, running provisioning inline');
        return runPowerShellInline(inner);
    }

    // outer powershell uses Start-Process -Verb RunAs to trigger UAC; -Wait so we can capture exit code
    const launcher = `Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command',"${inner.replace(/"/g, '\\"')}" -Verb RunAs -Wait -PassThru | Select-Object -ExpandProperty ExitCode`;

    return new Promise((resolve) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', launcher], { windowsHide: true });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (c) => { stdout += String(c); });
        child.stderr?.on('data', (c) => { stderr += String(c); });
        child.on('error', (err) => resolve({ ok: false, error: err.message }));
        child.on('close', (code) => {
            // exit code 0 here means the LAUNCHER ran; UAC denial returns non-zero from Start-Process
            if (code !== 0) {
                resolve({ ok: false, error: `UAC launcher failed: ${stderr.trim() || `exit ${code}`}` });
                return;
            }
            // parse trailing ExitCode of the elevated child
            const childExit = parseInt(String(stdout).trim().split(/\s+/).pop(), 10);
            if (Number.isFinite(childExit) && childExit === 0) {
                resolve({ ok: true });
            } else {
                resolve({ ok: false, error: `elevated provisioning exited ${Number.isFinite(childExit) ? childExit : 'unknown'}: ${stderr.trim()}` });
            }
        });
    });
}

// fallback path when host is already admin (e.g. dev box with elevated electron)
function runPowerShellInline(inner) {
    return new Promise((resolve) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', inner], { windowsHide: true });
        let stderr = '';
        child.stderr?.on('data', (c) => { stderr += String(c); });
        child.on('error', (err) => resolve({ ok: false, error: err.message }));
        child.on('close', (code) => {
            if (code === 0) resolve({ ok: true });
            else resolve({ ok: false, error: stderr.trim() || `exit ${code}` });
        });
    });
}
