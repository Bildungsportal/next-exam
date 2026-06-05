import { spawn } from 'child_process';

const FEATURE = 'HypervisorPlatform';

function runPowerShell(script) {
    return new Promise((resolve) => {
        const proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (d) => { stdout += String(d); });
        proc.stderr?.on('data', (d) => { stderr += String(d); });
        proc.on('error', (e) => resolve({ code: -1, stdout: '', stderr: String(e?.message || e) }));
        proc.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
    });
}

/** DISM optional feature state; needs elevation on many hosts (fails without admin). */
async function getOptionalFeatureState() {
    const script = [
        '$ErrorActionPreference = "Stop"',
        `try { (Get-WindowsOptionalFeature -Online -FeatureName ${FEATURE}).State }`,
        'catch { "" }',
    ].join('; ');
    const { code, stdout, stderr } = await runPowerShell(script);
    const state = stdout.trim();
    if (!state) {
        return { state: '', elevatedRequired: /erhöhte|elevated|740/i.test(stderr) };
    }
    return { state, elevatedRequired: false };
}

/** Works without admin when a hypervisor is active (WHPX-relevant). */
async function getHypervisorPresentCim() {
    const script = '(Get-CimInstance -ClassName Win32_ComputerSystem).HypervisorPresent';
    const { stdout } = await runPowerShell(script);
    const v = stdout.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
}

/**
 * Hypervisor Platform / WHPX readiness on win32.
 * Primary: optional feature Enabled|EnablePending (needs admin to query on many PCs).
 * Fallback: Win32_ComputerSystem.HypervisorPresent (no admin).
 */
export async function getWindowsHypervisorPlatformState() {
    if (process.platform !== 'win32') {
        return { supported: false, enabled: true, state: 'n/a', source: 'n/a' };
    }

    const optional = await getOptionalFeatureState();
    if (optional.state === 'Enabled' || optional.state === 'EnablePending') {
        return { supported: true, enabled: true, state: optional.state, source: 'optionalFeature' };
    }

    const hypervisorPresent = await getHypervisorPresentCim();
    if (hypervisorPresent === true) {
        const state = optional.state || 'HypervisorPresent';
        return { supported: true, enabled: true, state, source: 'cimHypervisorPresent' };
    }

    if (optional.state === 'Disabled' || optional.state === 'DisabledWithPayloadRemoved') {
        return { supported: true, enabled: false, state: optional.state, source: 'optionalFeature' };
    }

    if (hypervisorPresent === false) {
        return { supported: true, enabled: false, state: optional.state || 'false', source: 'cimHypervisorPresent' };
    }

    return {
        supported: true,
        enabled: false,
        state: optional.state || (optional.elevatedRequired ? 'queryNeedsElevation' : 'unknown'),
        source: 'unknown',
    };
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
