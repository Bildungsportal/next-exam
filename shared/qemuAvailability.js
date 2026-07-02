import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import log from 'electron-log';
import {
    clearWin32WhpxCpuCache,
    getQemuAccelArgs,
    probeQemuX86Accel,
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
    cachedWindowsQemuInstallDirs = null;
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

let cachedWindowsQemuInstallDirs = null;

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
    if (cachedWindowsQemuInstallDirs) {
        return cachedWindowsQemuInstallDirs;
    }
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
    cachedWindowsQemuInstallDirs = [...dirs].filter((dir) => {
        try {
            return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
        } catch (e) {
            return false;
        }
    });
    return cachedWindowsQemuInstallDirs;
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

function findQemuImgInBinDir(binDir) {
    for (const name of executableCandidates('qemu-img')) {
        const p = path.join(binDir, name);
        if (isExistingExecutableFile(p)) {
            return path.resolve(p);
        }
    }
    return null;
}

async function resolveBinaryPath(baseName, { quick = false } = {}) {
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
        if (quick) {
            return path.resolve(candidate);
        }
        if (await probeCommandOnce(candidate)) {
            return path.resolve(candidate);
        }
    }
    return null;
}

/** Resolve qemu-system + qemu-img; quick=stat only (disk dialog), no --version spawn per candidate. */
async function resolveQemuBinaryPair({ quick = false } = {}) {
    log.info(`qemuAvailability @ resolveQemuBinaryPair: start quick=${quick} platform=${process.platform}`);
    if (quick && process.platform === 'win32') {
        const whereHits = await whereWindowsExecutables('qemu-system-x86_64');
        log.info(`qemuAvailability @ resolveQemuBinaryPair: where.exe hits=${whereHits.length}`);
        for (const p of whereHits) {
            if (!isExistingExecutableFile(p)) continue;
            const binDir = path.dirname(path.resolve(p));
            const qemuImg = findQemuImgInBinDir(binDir);
            if (qemuImg) {
                log.info(`qemuAvailability @ resolveQemuBinaryPair: found via where ${p}`);
                return { qemuSystem: path.resolve(p), qemuImg, binDir };
            }
        }
        const installDirs = listWindowsQemuInstallDirs();
        log.info(`qemuAvailability @ resolveQemuBinaryPair: scanning install dirs=${installDirs.length}`);
        for (const dir of installDirs) {
            for (const name of executableCandidates('qemu-system-x86_64')) {
                const systemPath = path.join(dir, name);
                if (!isExistingExecutableFile(systemPath)) continue;
                const qemuImg = findQemuImgInBinDir(dir);
                if (qemuImg) {
                    log.info(`qemuAvailability @ resolveQemuBinaryPair: found in ${dir}`);
                    return { qemuSystem: path.resolve(systemPath), qemuImg, binDir: dir };
                }
            }
        }
        log.warn('qemuAvailability @ resolveQemuBinaryPair: no QEMU binaries found (win32 quick)');
        return { qemuSystem: null, qemuImg: null, binDir: null };
    }

    const qemuSystem = await resolveBinaryPath('qemu-system-x86_64', { quick });
    if (!qemuSystem) {
        return { qemuSystem: null, qemuImg: null, binDir: null };
    }
    const binDir = path.dirname(qemuSystem);
    let qemuImg = findQemuImgInBinDir(binDir);
    if (!qemuImg) {
        qemuImg = await resolveBinaryPath('qemu-img', { quick });
    }
    log.info(`qemuAvailability @ resolveQemuBinaryPair: system=${qemuSystem} img=${qemuImg}`);
    return { qemuSystem, qemuImg, binDir };
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
            ...getQemuMachineArgs(),
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
            ...getQemuAccelArgs(),
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

/** Darwin: qemu-system-x86_64 on arm64 has tcg only (no hvf); probe before other checks. */
async function ensureDarwinX86AccelProbed(qemuSystem, binDir) {
    if (process.platform !== 'darwin') return;
    const accel = await probeQemuX86Accel(qemuSystem, binDir, buildQemuSpawnEnv(binDir));
    log.info(`qemuAvailability @ ensureDarwinX86AccelProbed: accel=${accel}`);
}

/** Win32 WHPX probes (virtio-vga + CPU); skipped for disk-picker quick check. */
async function runDeepQemuProbes(qemuSystem, binDir, hypervisorPlatform) {
    log.info(`qemuAvailability @ runDeepQemuProbes: start binDir=${binDir}`);
    await ensureDarwinX86AccelProbed(qemuSystem, binDir);
    if (process.platform === 'win32' && hypervisorPlatform.supported && !hypervisorPlatform.enabled) {
        cachedResolved = null;
        return buildUnavailableResult(['HypervisorPlatform'], hypervisorPlatform);
    }

    if (process.platform === 'win32') {
        const qemuModuleDir = resolveQemuModuleDir(binDir);
        log.info('qemuAvailability @ runDeepQemuProbes: probing virtio-vga…');
        const virtioVgaOk = await probeVirtioVgaAvailable(qemuSystem, binDir);
        log.info(`qemuAvailability @ runDeepQemuProbes: virtio-vga ok=${virtioVgaOk}`);
        if (!virtioVgaOk) {
            cachedResolved = null;
            const missing = qemuModuleDir ? ['virtio-vga'] : ['qemu modules (lib/qemu)'];
            return buildUnavailableResult(missing, hypervisorPlatform, {
                virtioVgaUnavailable: true,
                qemuModuleDir,
            });
        }
        log.info('qemuAvailability @ runDeepQemuProbes: probing WHPX CPU models…');
        const cpu = await resolveWin32RuntimeCpu(qemuSystem, binDir);
        log.info(`qemuAvailability @ runDeepQemuProbes: WHPX CPU=${cpu}`);
    }

    log.info('qemuAvailability @ runDeepQemuProbes: done');
    return null;
}

/**
 * Resolve system qemu-system-x86_64 + qemu-img (not bundled by default).
 * @param {{ deep?: boolean }} opts deep=false: binaries only (disk dialog); deep=true: WHPX/virtio/cpu probes
 */
export async function resolveQemuBinaries({ deep = true } = {}) {
    const install = getQemuInstallInfo();
    log.info(`qemuAvailability @ resolveQemuBinaries: deep=${deep} cached=${cachedResolved ? (cachedResolved.deep ? 'deep' : 'quick') : String(cachedResolved)}`);

    if (cachedResolved && cachedResolved.deep && !deep) {
        log.info('qemuAvailability @ resolveQemuBinaries: cache hit (deep), quick return');
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
        const { qemuSystem, qemuImg, binDir } = await resolveQemuBinaryPair({ quick: !deep });
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
            binDir: binDir || path.dirname(qemuSystem),
            deep: false,
        };
    }

    if (!deep) {
        await ensureDarwinX86AccelProbed(cachedResolved.qemuSystem, cachedResolved.binDir);
        log.info(`qemuAvailability @ resolveQemuBinaries: quick ok binDir=${cachedResolved.binDir}`);
        return buildOkResult(cachedResolved, deferredHypervisorPlatform(), install, { quick: true });
    }

    if (cachedResolved.deep) {
        log.info('qemuAvailability @ resolveQemuBinaries: cache hit (deep)');
        const hp = process.platform === 'win32'
            ? await getWindowsHypervisorPlatformState()
            : deferredHypervisorPlatform();
        return buildOkResult(cachedResolved, hp, install);
    }

    log.info('qemuAvailability @ resolveQemuBinaries: running deep probes…');
    const { qemuSystem, qemuImg, binDir } = cachedResolved;
    const hypervisorPlatform = process.platform === 'win32'
        ? await getWindowsHypervisorPlatformState()
        : deferredHypervisorPlatform();
    log.info(`qemuAvailability @ resolveQemuBinaries: hypervisor enabled=${hypervisorPlatform.enabled} source=${hypervisorPlatform.source}`);
    const probeFail = await runDeepQemuProbes(qemuSystem, binDir, hypervisorPlatform);
    if (probeFail) {
        log.warn(`qemuAvailability @ resolveQemuBinaries: deep failed missing=${probeFail.missing?.join(',')}`);
        return probeFail;
    }

    cachedResolved = { qemuSystem, qemuImg, binDir, deep: true };
    log.info(`qemuAvailability @ resolveQemuBinaries: deep ok binDir=${binDir}`);
    return buildOkResult(cachedResolved, hypervisorPlatform, install);
}

export async function checkQemuAvailability(opts = {}) {
    const deep = opts.deep === false || opts.quick === true ? false : (opts.deep !== false);
    return await resolveQemuBinaries({ deep });
}

export { getQemuInstallInfo } from './qemuInstallInfo.js';
export { getWindowsHypervisorPlatformState, requestEnableWindowsHypervisorPlatform } from './qemuWinPlatform.js';
