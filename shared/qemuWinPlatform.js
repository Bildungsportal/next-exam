import { spawn } from 'child_process';

const FEATURE = 'HypervisorPlatform';

/** Parse Get-WindowsOptionalFeature State on win32; enabled=true for Enabled|EnablePending. */
export async function getWindowsHypervisorPlatformState() {
    if (process.platform !== 'win32') {
        return { supported: false, enabled: true, state: 'n/a' };
    }
    const script = `(Get-WindowsOptionalFeature -Online -FeatureName ${FEATURE} -ErrorAction Stop).State`;
    return await new Promise((resolve) => {
        const proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        proc.stdout?.on('data', (d) => { stdout += String(d); });
        proc.on('error', () => resolve({ supported: true, enabled: false, state: 'error' }));
        proc.on('close', (code) => {
            const state = stdout.trim();
            if (code !== 0 || !state) {
                resolve({ supported: true, enabled: false, state: state || 'unknown' });
                return;
            }
            const enabled = state === 'Enabled' || state === 'EnablePending';
            resolve({ supported: true, enabled, state });
        });
    });
}

/** Opens elevated PowerShell to enable HypervisorPlatform (admin required; reboot may be needed). */
export function requestEnableWindowsHypervisorPlatform() {
    if (process.platform !== 'win32') {
        return { ok: false, error: 'not win32' };
    }
    const inner = `Enable-WindowsOptionalFeature -Online -FeatureName ${FEATURE} -All -NoRestart`;
    const escaped = inner.replace(/'/g, "''");
    const args = [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        `Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','${escaped}'`,
    ];
    try {
        spawn('powershell.exe', args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
        return { ok: true };
    } catch (e) {
        return { ok: false, error: String(e?.message || e) };
    }
}
