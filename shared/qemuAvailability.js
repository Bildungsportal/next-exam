import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const PROBE_TIMEOUT_MS = 8000;
const VIRTIO_VGA_PROBE_MS = 1500;

/** LocalVM expects -vga virtio; requires QEMU built with virtio-vga support. */
export const QEMU_GUEST_VGA = 'virtio';
const SHARED_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(SHARED_DIR, '..');

const BINARIES = [
    { key: 'qemuSystem', base: 'qemu-system-x86_64' },
    { key: 'qemuImg', base: 'qemu-img' },
];

/** @type {{ qemuSystem: string, qemuImg: string, binDir: string } | null | undefined} */
let cachedResolved = undefined;

/** Reset cached paths (e.g. after QEMU install without app restart). */
export function clearQemuBinaryCache() {
    cachedResolved = undefined;
}

/** win | lin | mac for bundled public/qemu/<slug>/ */
export function getBundledQemuPlatformSlug() {
    if (process.platform === 'win32') return 'win';
    if (process.platform === 'darwin') return 'mac';
    if (process.platform === 'linux') return 'lin';
    return null;
}

/** Platform command names required for LocalVM (qemu-system-x86_64 + qemu-img). */
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

/** Bundled QEMU dirs: <app>/public/qemu/{win|lin|mac} (dev + packaged). */
export function listBundledQemuDirCandidates() {
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

/** Windows install dirs when QEMU is not bundled and not on PATH. */
function listWindowsQemuInstallDirs() {
    if (process.platform !== 'win32') {
        return [];
    }
    const dirs = new Set();
    const add = (d) => {
        if (!d || typeof d !== 'string') return;
        dirs.add(path.normalize(d.trim()));
    };
    add(process.env.QEMU_PREFIX);
    add(process.env.QEMU_INSTALL_DIR);
    add(process.env.QEMU_HOME);
    const pf = process.env.ProgramFiles;
    const pf86 = process.env['ProgramFiles(x86)'];
    if (pf) {
        add(path.join(pf, 'qemu'));
        add(path.join(pf, 'QEMU'));
    }
    if (pf86) {
        add(path.join(pf86, 'qemu'));
        add(path.join(pf86, 'QEMU'));
    }
    const pathEnv = process.env.PATH || '';
    for (const segment of pathEnv.split(';')) {
        const trimmed = segment.trim();
        if (trimmed && /qemu/i.test(trimmed)) {
            add(trimmed);
        }
    }
    return [...dirs].filter((dir) => {
        try {
            return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
        } catch (e) {
            return false;
        }
    });
}

/** Ordered probe paths: bundled public/qemu/<platform> first, then PATH, then system install. */
function probePathsForBinary(baseName) {
    const out = [];
    const seen = new Set();
    const push = (p) => {
        const n = path.normalize(p);
        if (seen.has(n)) return;
        seen.add(n);
        out.push(n);
    };
    for (const dir of listBundledQemuDirCandidates()) {
        for (const name of executableCandidates(baseName)) {
            push(path.join(dir, name));
        }
    }
    for (const name of executableCandidates(baseName)) {
        push(name);
    }
    if (process.platform === 'win32') {
        for (const dir of listWindowsQemuInstallDirs()) {
            for (const name of executableCandidates(baseName)) {
                push(path.join(dir, name));
            }
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
    for (const candidate of probePathsForBinary(baseName)) {
        if (await probeCommandOnce(candidate)) {
            return path.resolve(candidate);
        }
    }
    return null;
}

/** HW modules dir (Arch: /usr/lib/qemu); bundled copy → public/qemu/<platform>/lib/qemu */
export function resolveQemuModuleDir(binDir) {
    const bundled = path.join(binDir, 'lib', 'qemu');
    if (fs.existsSync(bundled)) {
        return bundled;
    }
    const fromEnv = process.env.QEMU_MODULE_DIR;
    if (fromEnv && fs.existsSync(fromEnv)) {
        return fromEnv;
    }
    return null;
}

/** env for spawn: QEMU_MODULE_DIR when lib/qemu exists (required for -vga virtio on modular builds). */
export function buildQemuSpawnEnv(binDir) {
    const env = { ...process.env };
    const modDir = resolveQemuModuleDir(binDir);
    if (modDir) {
        env.QEMU_MODULE_DIR = modDir;
    }
    return env;
}

/** True when -vga virtio works with QEMU_MODULE_DIR set. */
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
            '-machine', 'q35',
            '-m', '64',
            '-vga', QEMU_GUEST_VGA,
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
        proc.on('exit', () => {
            if (/virtio vga not available/i.test(stderr)) {
                finish(false);
                return;
            }
            finish(false);
        });
    });
}

/**
 * Resolve qemu-system-x86_64 + qemu-img (bundled public/qemu/{win|lin|mac} first).
 * @returns {Promise<{ ok: boolean, missing: string[], virtioVgaUnavailable?: boolean, qemuSystem?: string, qemuImg?: string, binDir?: string }>}
 */
export async function resolveQemuBinaries() {
    if (cachedResolved !== undefined) {
        if (!cachedResolved) {
            return { ok: false, missing: getQemuRequiredCommands() };
        }
        return {
            ok: true,
            missing: [],
            qemuSystem: cachedResolved.qemuSystem,
            qemuImg: cachedResolved.qemuImg,
            binDir: cachedResolved.binDir,
        };
    }

    const qemuSystem = await resolveBinaryPath('qemu-system-x86_64');
    const qemuImg = await resolveBinaryPath('qemu-img');
    if (!qemuSystem || !qemuImg) {
        cachedResolved = null;
        const missing = [];
        if (!qemuSystem) missing.push('qemu-system-x86_64');
        if (!qemuImg) missing.push('qemu-img');
        return { ok: false, missing };
    }

    const binDir = path.dirname(qemuSystem);
    const qemuModuleDir = resolveQemuModuleDir(binDir);
    const virtioVgaOk = await probeVirtioVgaAvailable(qemuSystem, binDir);
    if (!virtioVgaOk) {
        cachedResolved = null;
        const missing = qemuModuleDir ? ['virtio-vga'] : ['qemu modules (lib/qemu)'];
        return {
            ok: false,
            missing,
            virtioVgaUnavailable: true,
            qemuModuleDir,
        };
    }

    cachedResolved = { qemuSystem, qemuImg, binDir };
    return { ok: true, missing: [], qemuSystem, qemuImg, binDir };
}

/** True when both QEMU binaries are found and respond to --version. */
export async function checkQemuAvailability() {
    return await resolveQemuBinaries();
}
