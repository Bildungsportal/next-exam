import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

/** LocalVM: system QEMU only unless NEXT_EXAM_USE_BUNDLED_QEMU=1 (dev). */
const USE_BUNDLED_QEMU = process.env.NEXT_EXAM_USE_BUNDLED_QEMU === '1';

const SHARED_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(SHARED_DIR, '..');

const BINARIES = [
    { key: 'qemuSystem', base: 'qemu-system-x86_64' },
    { key: 'qemuImg', base: 'qemu-img' },
];

/** @type {{ qemuSystem: string, qemuImg: string, binDir: string } | null | undefined} */
let cachedResolved = undefined;

export function clearQemuBinaryCache() {
    cachedResolved = undefined;
    clearWin32WhpxCpuCache();
}

export function getBundledQemuPlatformSlug() {
    if (process.platform === 'win32') return 'win';
    if (process.platform === 'darwin') return 'mac';
    if (process.platform === 'linux') return 'lin';
    return null;
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

function listBundledQemuDirCandidates() {
    if (!USE_BUNDLED_QEMU) return [];
    const slug = getBundledQemuPlatformSlug();
    if (!slug) return [];
    const rel = ['public', 'qemu', slug];
    const dirs = new Set();
    const add = (base) => {
        if (!base) return;
        dirs.add(path.join(path.resolve(base), ...rel));
    };
    add(path.join(REPO_ROOT, 'teacher'));
    add(path.join(REPO_ROOT, 'student'));
    add(process.cwd());
    add(path.join(process.cwd(), 'teacher'));
    add(path.join(process.cwd(), 'student'));
    if (process.resourcesPath) {
        add(path.join(process.resourcesPath, 'app.asar.unpacked'));
        add(process.resourcesPath);
    }
    return [...dirs].filter((dir) => {
        try {
            return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
        } catch (e) {
            return false;
        }
    });
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
    for (const dir of listBundledQemuDirCandidates()) {
        for (const name of executableCandidates(baseName)) {
            push(path.join(dir, name));
        }
    }
    return out;
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
        if (!candidates.includes(path.normalize(p))) {
            candidates.unshift(path.normalize(p));
        }
    }
    for (const candidate of candidates) {
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
            ...getQemuVgaDeviceArgs({ profile: 'runtime' }),
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

/**
 * Resolve system qemu-system-x86_64 + qemu-img (not bundled by default).
 */
export async function resolveQemuBinaries() {
    const hypervisorPlatform = await getWindowsHypervisorPlatformState();
    const install = getQemuInstallInfo();

    if (cachedResolved !== undefined) {
        if (!cachedResolved) {
            return buildUnavailableResult(getQemuRequiredCommands(), hypervisorPlatform);
        }
        return {
            ok: true,
            missing: [],
            qemuSystem: cachedResolved.qemuSystem,
            qemuImg: cachedResolved.qemuImg,
            binDir: cachedResolved.binDir,
            hypervisorPlatform,
            downloadUrl: install.downloadUrl,
            installHint: install.installHint,
        };
    }

    const qemuSystem = await resolveBinaryPath('qemu-system-x86_64');
    const qemuImg = await resolveBinaryPath('qemu-img');
    if (!qemuSystem || !qemuImg) {
        cachedResolved = null;
        const missing = [];
        if (!qemuSystem) missing.push('qemu-system-x86_64');
        if (!qemuImg) missing.push('qemu-img');
        return buildUnavailableResult(missing, hypervisorPlatform);
    }

    if (process.platform === 'win32' && hypervisorPlatform.supported && !hypervisorPlatform.enabled) {
        cachedResolved = null;
        return buildUnavailableResult(['HypervisorPlatform'], hypervisorPlatform);
    }

    const binDir = path.dirname(qemuSystem);
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

    if (process.platform === 'win32') {
        await resolveWin32RuntimeCpu(qemuSystem, binDir);
    }

    cachedResolved = { qemuSystem, qemuImg, binDir };
    return {
        ok: true,
        missing: [],
        qemuSystem,
        qemuImg,
        binDir,
        hypervisorPlatform,
        downloadUrl: install.downloadUrl,
        installHint: install.installHint,
    };
}

export async function checkQemuAvailability() {
    return await resolveQemuBinaries();
}

export { getQemuInstallInfo } from './qemuInstallInfo.js';
export { getWindowsHypervisorPlatformState, requestEnableWindowsHypervisorPlatform } from './qemuWinPlatform.js';
