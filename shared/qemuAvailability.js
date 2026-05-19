import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
    clearWin32WhpxCpuCache,
    getQemuAccelArgs,
    getQemuMachineArgs,
    getQemuVgaDeviceArgs,
    getWin32RuntimeCpuCandidates,
    setCachedWin32RuntimeCpuArg,
} from './qemuHostArgs.js';
import { getQemuInstallInfo } from './qemuInstallInfo.js';
import { getWindowsHypervisorPlatformState } from './qemuWinPlatform.js';

const PROBE_TIMEOUT_MS = 8000;
const VIRTIO_VGA_PROBE_MS = 1500;
const WHPX_CPU_PROBE_MS = 2500;

const BINARIES = [
    { key: 'qemuSystem', base: 'qemu-system-x86_64' },
    { key: 'qemuImg', base: 'qemu-img' },
];

/** @type {{ qemuSystem: string, qemuImg: string, binDir: string, deep: boolean } | null | undefined} */
let cachedResolved = undefined;

export function clearQemuBinaryCache() {
    cachedResolved = undefined;
    clearWin32WhpxCpuCache();
}

export function getQemuRequiredCommands() {
    return BINARIES.map((b) => b.base);
}

function executableCandidates(baseName) {
    const names = [baseName];
    if (process.platform === 'win32') {
        const exe = baseName.toLowerCase().endsWith('.exe') ? baseName : `${baseName}.exe`;
        if (!names.includes(exe)) names.push(exe);
    }
    return names;
}

/** Scan Program Files* for qemu/QEMU install folders (Windows installer default). */
function scanWindowsProgramFilesQemuDirs() {
    if (process.platform !== 'win32') return [];
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
    const dirs = [];
    for (const root of roots) {
        let entries = [];
        try {
            entries = fs.readdirSync(root, { withFileTypes: true });
        } catch (e) {
            continue;
        }
        for (const ent of entries) {
            if (!ent.isDirectory() || !/qemu/i.test(ent.name)) continue;
            dirs.push(path.join(root, ent.name));
        }
    }
    return dirs;
}

/** Windows: env vars, PATH segments containing qemu, Program Files\\qemu. */
function listWindowsQemuInstallDirs() {
    if (process.platform !== 'win32') return [];
    const dirs = new Set();
    const add = (d) => {
        if (!d || typeof d !== 'string') return;
        dirs.add(path.normalize(d.trim()));
    };
    add(process.env.QEMU_PREFIX);
    add(process.env.QEMU_INSTALL_DIR);
    add(process.env.QEMU_HOME);
    for (const d of scanWindowsProgramFilesQemuDirs()) add(d);
    const pathEnv = process.env.PATH || '';
    for (const segment of pathEnv.split(';')) {
        const trimmed = segment.trim();
        if (trimmed && /qemu/i.test(trimmed)) add(trimmed);
    }
    return [...dirs].filter((dir) => {
        try {
            return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
        } catch (e) {
            return false;
        }
    });
}

function listUnixSystemBinDirs() {
    if (process.platform === 'linux') {
        return ['/usr/bin', '/usr/local/bin', '/usr/libexec', '/snap/bin'];
    }
    if (process.platform === 'darwin') {
        return ['/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin'];
    }
    return [];
}

/** Dirs to search before bare command names (system install, not bundle). */
function listSystemQemuSearchDirs() {
    const dirs = new Set();
    if (process.platform === 'win32') {
        for (const d of listWindowsQemuInstallDirs()) dirs.add(d);
        return [...dirs];
    }
    for (const d of listUnixSystemBinDirs()) {
        try {
            if (fs.existsSync(d) && fs.statSync(d).isDirectory()) dirs.add(d);
        } catch (e) {}
    }
    return [...dirs];
}

/** where.exe on Windows (PATH); empty elsewhere. */
function whereWindowsExecutables(baseName) {
    if (process.platform !== 'win32') return Promise.resolve([]);
    return new Promise((resolve) => {
        const names = executableCandidates(baseName).join(' ');
        const proc = spawn('where.exe', names.split(/\s+/), {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        let out = '';
        proc.stdout?.on('data', (d) => { out += String(d); });
        proc.on('error', () => resolve([]));
        proc.on('close', () => {
            resolve(out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
        });
    });
}

function probePathsForBinary(baseName) {
    const out = [];
    const seen = new Set();
    const push = (p) => {
        const n = path.normalize(p);
        if (seen.has(n)) return;
        seen.add(n);
        out.push(n);
    };
    for (const dir of listSystemQemuSearchDirs()) {
        for (const name of executableCandidates(baseName)) {
            push(path.join(dir, name));
        }
    }
    for (const name of executableCandidates(baseName)) {
        push(name);
    }
    return out;
}

function isExistingExecutableFile(candidate) {
    try {
        const st = fs.statSync(candidate);
        return st.isFile() && st.size > 0;
    } catch (e) {
        return false;
    }
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
        const binDir = path.dirname(path.resolve(command));
        const proc = spawn(command, ['--version'], {
            stdio: 'ignore',
            windowsHide: true,
            cwd: fs.existsSync(binDir) ? binDir : undefined,
        });
        const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS);
        proc.on('error', () => finish(false));
        proc.on('close', (code) => finish(code === 0));
    });
}

async function resolveBinaryPath(baseName) {
    const candidates = [...probePathsForBinary(baseName)];
    for (const p of await whereWindowsExecutables(baseName)) {
        const n = path.normalize(p);
        if (!candidates.includes(n)) {
            candidates.unshift(n);
        }
    }
    for (const candidate of candidates) {
        if (!isExistingExecutableFile(candidate)) {
            continue;
        }
        if (await probeCommandOnce(candidate)) {
            return path.resolve(candidate);
        }
    }
    return null;
}

/** HW modules: <prefix>/lib/qemu, Linux /usr/lib/qemu, QEMU_MODULE_DIR env. */
export function resolveQemuModuleDir(binDir) {
    const candidates = [
        path.join(binDir, 'lib', 'qemu'),
        '/usr/lib/qemu',
        '/usr/lib64/qemu',
    ];
    if (process.env.QEMU_MODULE_DIR) {
        candidates.unshift(process.env.QEMU_MODULE_DIR);
    }
    for (const dir of candidates) {
        if (dir && fs.existsSync(dir)) {
            return dir;
        }
    }
    return null;
}

export function buildQemuSpawnEnv(binDir) {
    const env = { ...process.env };
    const modDir = resolveQemuModuleDir(binDir);
    if (modDir) {
        env.QEMU_MODULE_DIR = modDir;
    }
    const binNorm = path.normalize(binDir);
    if (!env.PATH?.toLowerCase().includes(binNorm.toLowerCase())) {
        env.PATH = `${binDir}${path.delimiter}${env.PATH || ''}`;
    }
    return env;
}

async function probeVirtioVgaAvailable(qemuSystem, binDir) {
    return await new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { proc.kill(); } catch (e) {}
            resolve(ok);
        };
        const proc = spawn(qemuSystem, [
            ...getQemuAccelArgs(),
            '-machine', 'q35',
            '-m', '64',
            ...getQemuVgaDeviceArgs(),
            '-display', 'none',
        ], {
            cwd: binDir,
            env: buildQemuSpawnEnv(binDir),
            stdio: ['ignore', 'ignore', 'pipe'],
            windowsHide: true,
        });
        let stderr = '';
        proc.stderr?.on('data', (d) => { stderr += String(d); });
        const timer = setTimeout(() => finish(true), VIRTIO_VGA_PROBE_MS);
        proc.on('error', () => finish(false));
        proc.on('exit', (code) => {
            if (/virtio vga not available/i.test(stderr)) {
                finish(false);
                return;
            }
            finish(code === 0 || proc.killed);
        });
    });
}

async function probeWhpxCpuArg(qemuSystem, binDir, cpuArg) {
    return await new Promise((resolve) => {
        let settled = false;
        let stderr = '';
        const finish = (ok) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { proc.kill(); } catch (e) {}
            resolve(ok);
        };
        const proc = spawn(qemuSystem, [
            ...getQemuAccelArgs({ runtime: true }),
            ...getQemuMachineArgs(),
            '-cpu', cpuArg,
            '-m', '128',
            '-smp', '1',
            '-display', 'none',
            '-vga', 'std',
        ], {
            cwd: binDir,
            env: buildQemuSpawnEnv(binDir),
            stdio: ['ignore', 'ignore', 'pipe'],
            windowsHide: true,
        });
        proc.stderr?.on('data', (d) => { stderr += String(d); });
        const timer = setTimeout(() => finish(!/Unexpected VP exit/i.test(stderr)), WHPX_CPU_PROBE_MS);
        proc.on('error', () => finish(false));
        proc.on('exit', () => finish(!/Unexpected VP exit/i.test(stderr)));
    });
}

async function resolveWin32RuntimeCpu(qemuSystem, binDir) {
    for (const cpuArg of getWin32RuntimeCpuCandidates()) {
        if (await probeWhpxCpuArg(qemuSystem, binDir, cpuArg)) {
            setCachedWin32RuntimeCpuArg(cpuArg);
            return cpuArg;
        }
    }
    const fallback = getWin32RuntimeCpuCandidates().at(-1);
    setCachedWin32RuntimeCpuArg(fallback);
    return fallback;
}

function buildUnavailableResult(missing, hypervisorPlatform, extra = {}) {
    const install = getQemuInstallInfo();
    return {
        ok: false,
        missing,
        hypervisorPlatform,
        downloadUrl: install.downloadUrl,
        installHint: install.installHint,
        searchNote: install.searchNote,
        ...extra,
    };
}

function deferredHypervisorPlatform() {
    return {
        supported: process.platform === 'win32',
        enabled: true,
        state: 'deferred',
        source: 'quick',
    };
}

function buildOkResult(resolved, hypervisorPlatform, install, { quick = false } = {}) {
    return {
        ok: true,
        missing: [],
        qemuSystem: resolved.qemuSystem,
        qemuImg: resolved.qemuImg,
        binDir: resolved.binDir,
        hypervisorPlatform,
        downloadUrl: install.downloadUrl,
        installHint: install.installHint,
        quick,
    };
}

/** Win32 WHPX probes (virtio-vga + CPU); skipped for disk-picker quick check. */
async function runDeepQemuProbes(qemuSystem, binDir, hypervisorPlatform) {
    if (process.platform === 'win32' && hypervisorPlatform.supported && !hypervisorPlatform.enabled) {
        cachedResolved = null;
        return buildUnavailableResult(['HypervisorPlatform'], hypervisorPlatform);
    }

    if (process.platform === 'win32') {
        const qemuModuleDir = resolveQemuModuleDir(binDir);
        const virtioVgaOk = await probeVirtioVgaAvailable(qemuSystem, binDir);
        if (!virtioVgaOk) {
            cachedResolved = null;
            const missing = qemuModuleDir ? ['virtio-vga'] : ['qemu modules (lib/qemu)'];
            return buildUnavailableResult(missing, hypervisorPlatform, {
                virtioVgaUnavailable: true,
                qemuModuleDir,
            });
        }
        await resolveWin32RuntimeCpu(qemuSystem, binDir);
    }

    return null;
}

/**
 * Resolve system qemu-system-x86_64 + qemu-img (not bundled by default).
 * @param {{ deep?: boolean }} opts deep=false: binaries only (disk dialog); deep=true: WHPX/virtio/cpu probes
 */
export async function resolveQemuBinaries({ deep = true } = {}) {
    const install = getQemuInstallInfo();

    if (cachedResolved && cachedResolved.deep && !deep) {
        const hp = deferredHypervisorPlatform();
        return buildOkResult(cachedResolved, hp, install, { quick: true });
    }

    if (cachedResolved === null) {
        const hp = deep && process.platform === 'win32'
            ? await getWindowsHypervisorPlatformState()
            : deferredHypervisorPlatform();
        return buildUnavailableResult(getQemuRequiredCommands(), hp);
    }

    if (!cachedResolved) {
        const qemuSystem = await resolveBinaryPath('qemu-system-x86_64');
        const qemuImg = await resolveBinaryPath('qemu-img');
        if (!qemuSystem || !qemuImg) {
            cachedResolved = null;
            const missing = [];
            if (!qemuSystem) missing.push('qemu-system-x86_64');
            if (!qemuImg) missing.push('qemu-img');
            const hp = deep && process.platform === 'win32'
                ? await getWindowsHypervisorPlatformState()
                : deferredHypervisorPlatform();
            return buildUnavailableResult(missing, hp);
        }
        cachedResolved = {
            qemuSystem,
            qemuImg,
            binDir: path.dirname(qemuSystem),
            deep: false,
        };
    }

    if (!deep) {
        return buildOkResult(cachedResolved, deferredHypervisorPlatform(), install, { quick: true });
    }

    if (cachedResolved.deep) {
        const hp = process.platform === 'win32'
            ? await getWindowsHypervisorPlatformState()
            : deferredHypervisorPlatform();
        return buildOkResult(cachedResolved, hp, install);
    }

    const { qemuSystem, qemuImg, binDir } = cachedResolved;
    const hypervisorPlatform = process.platform === 'win32'
        ? await getWindowsHypervisorPlatformState()
        : deferredHypervisorPlatform();
    const probeFail = await runDeepQemuProbes(qemuSystem, binDir, hypervisorPlatform);
    if (probeFail) {
        return probeFail;
    }

    cachedResolved = { qemuSystem, qemuImg, binDir, deep: true };
    return buildOkResult(cachedResolved, hypervisorPlatform, install);
}

export async function checkQemuAvailability(opts = {}) {
    return await resolveQemuBinaries(opts);
}

export { getQemuInstallInfo } from './qemuInstallInfo.js';
export { getWindowsHypervisorPlatformState, requestEnableWindowsHypervisorPlatform } from './qemuWinPlatform.js';
