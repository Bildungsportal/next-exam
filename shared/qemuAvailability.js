import { spawn } from 'child_process';

const PROBE_TIMEOUT_MS = 8000;

/** Platform command names required for LocalVM (qemu-system-x86_64 + qemu-img). */
export function getQemuRequiredCommands() {
    if (process.platform === 'win32') {
        return ['qemu-system-x86_64', 'qemu-img'];
    }
    return ['qemu-system-x86_64', 'qemu-img'];
}

function commandCandidates(baseName) {
    if (process.platform === 'win32') {
        const lower = baseName.toLowerCase().endsWith('.exe') ? baseName : `${baseName}.exe`;
        return [baseName, lower];
    }
    return [baseName];
}

function probeCommandOnce(command) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { proc.kill(); } catch (e) {}
            resolve(ok);
        };
        const proc = spawn(command, ['--version'], { stdio: 'ignore', windowsHide: true });
        const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS);
        proc.on('error', () => finish(false));
        proc.on('close', (code) => finish(code === 0));
    });
}

async function probeCommand(baseName) {
    for (const cmd of commandCandidates(baseName)) {
        if (await probeCommandOnce(cmd)) {
            return true;
        }
    }
    return false;
}

/** True when both qemu-system-x86_64 and qemu-img are on PATH and respond to --version. */
export async function checkQemuAvailability() {
    const missing = [];
    for (const name of getQemuRequiredCommands()) {
        if (!(await probeCommand(name))) {
            missing.push(name);
        }
    }
    return { ok: missing.length === 0, missing };
}
