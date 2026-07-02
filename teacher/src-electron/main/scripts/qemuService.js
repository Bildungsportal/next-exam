import fs from 'fs';
import { createWriteStream } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';
import log from 'electron-log';
import crypto from 'crypto';
import {
    resolveQemuBinaries,
    buildQemuSpawnEnv,
    resolveQemuModuleDir,
} from '../../../../shared/qemuAvailability.js';
import { copyQcow2ToDest } from '../../../../shared/qemuQcow2Copy.js';
import {
    getQemuAccelArgs,
    getQemuCpuArg,
    getQemuMachineArgs,
    getQemuMemoryArg,
    getQemuTeacherBootMemoryArg,
    getQemuRtcArgs,
    getQemuSmpArgs,
    getQemuTeacherDisplayArgs,
    getQemuTeacherVgaArgs,
    getQemuUsbTabletArgs,
    getQemuVirtioDiskDriveArg,
    getQemuUefiInstallExtras,
    getQemuLegacyBootOrderArgs,
} from '../../../../shared/qemuHostArgs.js';

const DEFAULTS = {
    isoUrl: 'https://software-static.download.prss.microsoft.com/dbazure/888969d5-f34g-4e03-ac9d-1f9786c66749/26100.1.240331-1435.ge_release_CLIENT_IOT_LTSC_EVAL_x64FRE_en-us.iso',
    isoName: 'win11_iot.iso',
    virtioUrl: 'https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso',
    virtioName: 'virtio-win.iso',
    answerIsoName: 'autounattend.iso',
    diskName: 'win11-1.qcow2',
    diskSize: '64G',
    vncDisplay: ':1',
};

function getRepoPathRelative(...parts) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.join(__dirname, ...parts);
}

function getPackagedPublicPath(...parts) {
    return path.join(process.resourcesPath || '', 'app.asar.unpacked', 'public', ...parts);
}

function getCwdCandidate(...parts) {
    return path.join(process.cwd(), ...parts);
}

function getQemuDir(workdirectory) {
    return path.join(workdirectory, 'QEMU');
}

async function ensureDir(dir) {
    await fs.promises.mkdir(dir, { recursive: true });
}

const QEMU_DOWNLOAD_HEADERS = {
    'User-Agent': 'Next-Exam/2.0 (LocalVM QEMU downloader)',
    'Accept-Encoding': 'identity',
};

/** Min on-disk size before we treat a download as complete (avoids re-downloading after partial runs). */
const MIN_COMPLETE_BYTES = {
    [DEFAULTS.isoName]: 3 * 1024 * 1024 * 1024,
    [DEFAULTS.virtioName]: 100 * 1024 * 1024,
};

function existingDownloadSize(destPath) {
    try {
        const st = fs.statSync(destPath);
        return st.isFile() ? st.size : 0;
    } catch (e) {
        return 0;
    }
}

function isCompleteDownload(destPath, destBase) {
    const bytes = existingDownloadSize(destPath);
    const min = MIN_COMPLETE_BYTES[destBase];
    if (min) return bytes >= min;
    return bytes > 0;
}

/** Stream HTTP(S) body to tmpPath; pipeline waits until all bytes are flushed to disk. */
function downloadUrlToPath(url, tmpPath, ctx) {
    const { onProgress, destBase, tmpBase } = ctx;
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const client = u.protocol === 'https:' ? https : http;
        const req = client.get(u, { headers: QEMU_DOWNLOAD_HEADERS }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                const nextUrl = new URL(res.headers.location, url).href;
                log.info(`qemuService @ downloadUrlToPath: redirect ${res.statusCode} -> ${nextUrl}`);
                resolve({ redirect: nextUrl });
                return;
            }
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`download failed: ${res.statusCode} ${res.statusMessage || ''}`.trim()));
                return;
            }
            const total = Number(res.headers['content-length'] || 0) || 0;
            let received = 0;
            let lastPct = -1;
            let lastDiskPct = -1;
            const loggedMilestones = new Set();
            const reportProgress = (phase, percent) => {
                try {
                    onProgress?.({
                        phase,
                        file: phase === 'done' || phase === 'skip' ? destBase : tmpBase,
                        percent,
                    });
                } catch (e) {}
            };
            reportProgress('start', 0);

            const progressTap = new Transform({
                transform(chunk, _enc, cb) {
                    received += chunk.length;
                    if (total > 0) {
                        const pct = Math.min(100, Math.floor((received / total) * 100));
                        if (pct !== lastPct) {
                            lastPct = pct;
                            reportProgress('downloading', pct);
                        }
                        if (pct === 5 || pct === 25 || pct === 50 || pct === 75 || pct === 90) {
                            if (!loggedMilestones.has(pct)) {
                                loggedMilestones.add(pct);
                                const diskBytes = existingDownloadSize(tmpPath);
                                log.info(`qemuService @ downloadUrlToPath: ${tmpBase} ${pct}% (stream ${received}, disk ${diskBytes})`);
                            }
                        }
                    } else if (received - (lastDiskPct * 50 * 1024 * 1024) >= 50 * 1024 * 1024) {
                        const diskBytes = existingDownloadSize(tmpPath);
                        const approxPct = Math.min(99, Math.floor(diskBytes / (50 * 1024 * 1024)));
                        if (approxPct !== lastDiskPct) {
                            lastDiskPct = approxPct;
                            reportProgress('downloading', null);
                        }
                    }
                    cb(null, chunk);
                },
            });

            const out = createWriteStream(tmpPath, { flags: 'w' });
            pipeline(res, progressTap, out)
                .then(() => {
                    const partBytes = existingDownloadSize(tmpPath);
                    resolve({ redirect: null, received, total, partBytes });
                })
                .catch(reject);
        });
        req.on('error', reject);
    });
}

async function downloadFile(url, destPath, onProgress = null) {
    destPath = path.resolve(destPath);
    await ensureDir(path.dirname(destPath));
    const tmpPath = `${destPath}.part`;
    const tmpBase = path.basename(tmpPath);
    const destBase = path.basename(destPath);

    if (isCompleteDownload(destPath, destBase)) {
        const existingBytes = existingDownloadSize(destPath);
        log.info(`qemuService @ downloadFile: skip complete ${destPath} (${existingBytes} bytes)`);
        try { fs.unlinkSync(tmpPath); } catch (e) {}
        try { onProgress?.({ phase: 'skip', file: destBase, percent: 100 }); } catch (e) {}
        return { ok: true, skipped: true, path: destPath };
    }
    if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch (e) {}
    }
    try { fs.unlinkSync(tmpPath); } catch (e) {}

    log.info(`qemuService @ downloadFile: ${url} -> ${tmpPath} (rename to ${destPath} when done)`);
    let currentUrl = url;
    let downloadCompleted = false;
    try {
        for (let hop = 0; hop < 12; hop++) {
            const result = await downloadUrlToPath(currentUrl, tmpPath, { onProgress, destBase, tmpBase });
            if (result.redirect) {
                try { fs.unlinkSync(tmpPath); } catch (e) {}
                currentUrl = result.redirect;
                continue;
            }
            const partBytes = result.partBytes ?? existingDownloadSize(tmpPath);
            if (partBytes <= 0) {
                throw new Error(`download wrote no data (${tmpBase})`);
            }
            if (result.total > 0 && partBytes < result.total * 0.99) {
                throw new Error(
                    `download incomplete: expected ~${result.total} bytes, on disk ${partBytes} (${tmpBase})`
                );
            }
            if (result.received > 0 && partBytes < result.received * 0.99) {
                throw new Error(
                    `download incomplete: received ${result.received} bytes, on disk ${partBytes} (${tmpBase})`
                );
            }
            log.info(`qemuService @ downloadFile: received ${result.received} bytes, on disk ${partBytes} (${tmpBase})`);
            downloadCompleted = true;
            break;
        }
        if (!downloadCompleted) {
            throw new Error('download failed: too many redirects');
        }
        await fs.promises.rename(tmpPath, destPath);
        try { fs.unlinkSync(tmpPath); } catch (e) {}
        log.info(`qemuService @ downloadFile: done ${destPath}`);
        try { onProgress?.({ phase: 'done', file: destBase, percent: 100 }); } catch (e) {}
        return { ok: true, skipped: false, path: destPath };
    } catch (e) {
        log.error('qemuService @ downloadFile failed', e);
        try { fs.unlinkSync(tmpPath); } catch (err) {}
        throw e;
    }
}

async function sha256File(filePath) {
    return await new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const s = fs.createReadStream(filePath);
        s.on('error', reject);
        s.on('data', (chunk) => hash.update(chunk));
        s.on('end', () => resolve(hash.digest('hex')));
    });
}

async function getResolvedQemu() {
    const r = await resolveQemuBinaries();
    if (!r.ok) {
        if (r.virtioVgaUnavailable && !r.qemuModuleDir) {
            throw new Error(
                'QEMU HW-Module fehlen (z. B. /usr/lib/qemu). Linux: qemu-system-x86 Paket installieren.'
            );
        }
        throw new Error(`QEMU not available (missing: ${(r.missing || []).join(', ')})`);
    }
    log.info(`qemuService: using QEMU from ${r.binDir} modules=${resolveQemuModuleDir(r.binDir) || 'default'}`);
    return r;
}

function sleepMs(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/** True when a qemu-system-x86_64 process is already running (avoid taskkill if guest was closed cleanly). */
async function isQemuSystemProcessRunning() {
    if (process.platform === 'win32') {
        const r = await runToCompletion('tasklist', ['/FI', 'IMAGENAME eq qemu-system-x86_64.exe', '/NH']);
        return /qemu-system-x86_64\.exe/i.test(r.stdout || '');
    }
    const r = await runToCompletion('pgrep', ['-x', 'qemu-system-x86_64']);
    return r.exitCode === 0;
}

/** Stop stale QEMU so the qcow2 lock is free; skip kill when no process (clean shutdown). */
/** @returns {Promise<boolean>} true when a running guest was force-stopped */
async function killExistingQemuInstances() {
    if (process.platform === 'win32') {
        if (!(await isQemuSystemProcessRunning())) {
            log.info('qemuService @ killExistingQemuInstances: no qemu process, skip taskkill');
            return false;
        }
        const r = await runToCompletion('taskkill', ['/F', '/IM', 'qemu-system-x86_64.exe']);
        log.info(`qemuService @ killExistingQemuInstances: taskkill exit=${r.exitCode}`);
        return true;
    }
    if (!(await isQemuSystemProcessRunning())) {
        log.info('qemuService @ killExistingQemuInstances: no qemu process, skip killall');
        return false;
    }
    const term = await runToCompletion('killall', ['-TERM', 'qemu-system-x86_64']);
    log.info(`qemuService @ killExistingQemuInstances: killall -TERM exit=${term.exitCode}`);
    await sleepMs(600);
    const kill = await runToCompletion('killall', ['-KILL', 'qemu-system-x86_64']);
    log.info(`qemuService @ killExistingQemuInstances: killall -KILL exit=${kill.exitCode}`);
    return true;
}

function spawnLogged(cmd, args, options = {}) {
    log.info(`qemuService: spawn ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args, { ...options });
    proc.on('error', (e) => log.error(`qemuService: spawn error ${cmd}`, e));
    return proc;
}

/** Teacher SDL window: detached QEMU; stdio must be ignore (piped stderr fills and freezes the guest on Windows). */
async function spawnTeacherInteractiveQemu(qemuSystem, args, binDir) {
    const killedStale = await killExistingQemuInstances();
    await sleepMs(killedStale ? 800 : 200);
    return await new Promise((resolve, reject) => {
        log.info(`qemuService: spawn ${qemuSystem} ${args.join(' ')}`);
        const proc = spawn(qemuSystem, args, {
            cwd: binDir,
            env: buildQemuSpawnEnv(binDir),
            detached: true,
            stdio: 'ignore',
        });
        proc.on('error', reject);
        const timer = setTimeout(() => {
            try { proc.unref(); } catch (e) {}
            resolve({ pid: proc.pid });
        }, 1500);
        proc.on('exit', (code, signal) => {
            clearTimeout(timer);
            reject(new Error(`exit ${code}${signal ? ` signal ${signal}` : ''}`));
        });
    });
}

async function runToCompletion(cmd, args, options = {}) {
    const proc = spawnLogged(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => { stdout += String(d); });
    proc.stderr?.on('data', (d) => { stderr += String(d); });
    const exitCode = await new Promise((resolve) => proc.on('close', resolve));
    return { exitCode, stdout, stderr };
}

/** Student/teacher overlay qcow2 — not selectable base disks. */
function isQemuOverlayDiskName(name) {
    return /\.(overlay|teacher-boot\.overlay)\.qcow2$/i.test(String(name || ''));
}

function teacherBootOverlayFilename(baseQcow2) {
    return `${baseQcow2}.teacher-boot.overlay.qcow2`;
}

// Win: overlay delete may hit EBUSY until qemu exits; retry after killExistingQemuInstances.
async function unlinkIfExists(filePath) {
    const p = String(filePath || '');
    if (!p) return true;
    for (let i = 0; i < 8; i++) {
        try {
            if (!fs.existsSync(p)) return true;
            await fs.promises.unlink(p);
            return true;
        } catch (e) {
            if (i < 7) await sleepMs(400);
        }
    }
    return false;
}

async function listDisks({ workdirectory }) {
    const dir = getQemuDir(workdirectory);
    await ensureDir(dir);
    log.info(`qemuService @ listDisks: scanning ${dir}`);
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const names = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.qcow2') && !isQemuOverlayDiskName(e.name))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
    log.info(`qemuService @ listDisks: found ${names.length} disk(s) [${names.join(', ')}]`);
    return names;
}

async function hashDisk({ workdirectory, qcow2Name }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);
    const filename = path.basename(String(qcow2Name || ''));
    if (!filename || filename !== String(qcow2Name || '')) {
        throw new Error('invalid qcow2Name');
    }
    if (!filename.toLowerCase().endsWith('.qcow2')) {
        throw new Error('invalid qcow2Name');
    }
    const p = path.join(qemuDir, filename);
    await fs.promises.access(p, fs.constants.R_OK);
    return await sha256File(p);
}

async function statDisk({ workdirectory, qcow2Name }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);
    const filename = path.basename(String(qcow2Name || ''));
    if (!filename || filename !== String(qcow2Name || '')) {
        throw new Error('invalid qcow2Name');
    }
    if (!filename.toLowerCase().endsWith('.qcow2')) {
        throw new Error('invalid qcow2Name');
    }
    const p = path.join(qemuDir, filename);
    const st = await fs.promises.stat(p);
    return { size: st.size };
}

async function ensureAnswerIsoPresent(qemuDir) {
    const dest = path.join(qemuDir, DEFAULTS.answerIsoName);
    const candidatePackagedPublic = getPackagedPublicPath('qemu', DEFAULTS.answerIsoName);
    const candidates = [
        candidatePackagedPublic,
        // dev: depending on cwd, this can be teacher/public or repoRoot/teacher/public
        getCwdCandidate('public', 'qemu', DEFAULTS.answerIsoName),
        getCwdCandidate('teacher', 'public', 'qemu', DEFAULTS.answerIsoName),
    ];
    const candidate = candidates.find((p) => fs.existsSync(p)) || null;
    if (!candidate) {
        if (fs.existsSync(dest)) return dest;
        throw new Error(`missing ${DEFAULTS.answerIsoName} (expected in ${candidates.join(' or ')} or ${dest})`);
    }

    if (fs.existsSync(dest)) {
        try {
            const [dstHash, srcHash] = await Promise.all([sha256File(dest), sha256File(candidate)]);
            if (dstHash === srcHash) return dest;
            log.info(`qemuService @ ensureAnswerIsoPresent: updating cached ${DEFAULTS.answerIsoName} (hash mismatch)`);
        } catch (e) {
            // If hash fails for any reason, fall back to copying to be safe.
            log.warn(`qemuService @ ensureAnswerIsoPresent: hash check failed, refreshing cached ${DEFAULTS.answerIsoName}`, e);
        }
    } else {
        log.info(`qemuService @ ensureAnswerIsoPresent: caching ${DEFAULTS.answerIsoName} from ${candidate}`);
    }

    log.info(`qemuService @ ensureAnswerIsoPresent: using ${candidate}`);
    await fs.promises.copyFile(candidate, dest);
    return dest;
}

async function ensureDisk(qemuDir) {
    const diskPath = path.join(qemuDir, DEFAULTS.diskName);
    if (fs.existsSync(diskPath)) {
        log.warn(`qemuService @ ensureDisk: reusing existing disk ${diskPath} (no reinstall will run)`);
        return diskPath;
    }
    const { qemuImg, binDir } = await getResolvedQemu();
    const res = await runToCompletion(qemuImg, ['create', '-f', 'qcow2', diskPath, DEFAULTS.diskSize], {
        cwd: binDir,
        env: buildQemuSpawnEnv(binDir),
    });
    if (res.exitCode !== 0) {
        throw new Error(`qemu-img failed: ${res.stderr || res.stdout}`);
    }
    return diskPath;
}

async function installDefaultVm({ workdirectory, onProgress = null }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);

    log.info(`qemuService @ installDefaultVm: requested (workdirectory=${workdirectory})`);
    const isoPath = path.join(qemuDir, DEFAULTS.isoName);
    const virtioPath = path.join(qemuDir, DEFAULTS.virtioName);

    await downloadFile(DEFAULTS.isoUrl, isoPath, onProgress);
    await downloadFile(DEFAULTS.virtioUrl, virtioPath, onProgress);
    try { onProgress?.({ phase: 'creating-disk', file: DEFAULTS.diskName, percent: 0 }); } catch (e) {}
    const answerIsoPath = await ensureAnswerIsoPresent(qemuDir);
    const diskPath = await ensureDisk(qemuDir);
    try { onProgress?.({ phase: 'starting-qemu', file: DEFAULTS.diskName, percent: 0 }); } catch (e) {}
    log.info(`qemuService @ installDefaultVm: assets ready (iso=${isoPath}, virtio=${virtioPath}, answerIso=${answerIsoPath}, disk=${diskPath})`);

    const { qemuSystem, binDir } = await getResolvedQemu();
    const uefiExtras = await getQemuUefiInstallExtras({
        binDir,
        qemuWorkDir: qemuDir,
        isoPath,
        virtioPath,
        answerIsoPath,
        qcow2Name: DEFAULTS.diskName,
    });
    const args = [
        ...getQemuAccelArgs(),
        ...getQemuMemoryArg(),
        ...getQemuSmpArgs(),
        ...getQemuRtcArgs(),
        ...getQemuMachineArgs(),
        '-cpu', getQemuCpuArg({ profile: 'uefi-install' }),
        ...getQemuVirtioDiskDriveArg(diskPath, { boot: false }),
        ...uefiExtras,
        ...getQemuTeacherVgaArgs(),
        ...getQemuTeacherDisplayArgs(),
        ...getQemuUsbTabletArgs(),
        '-device', 'virtio-net-pci,netdev=n0',
        '-netdev', 'user,id=n0',
    ];
    const { pid } = await spawnTeacherInteractiveQemu(qemuSystem, args, binDir);
    log.info(`qemuService @ installDefaultVm: qemu started pid=${pid || 'unknown'}`);

    return { ok: true, qemuDir, diskName: DEFAULTS.diskName, vncDisplay: DEFAULTS.vncDisplay };
}

// Teacher boot: optional overlay qcow2 (immutable preview, same idea as student exam VM).
async function bootDisk({ workdirectory, qcow2Name, useOverlay = false }) {
    log.info(`qemuService @ bootDisk: qcow2=${qcow2Name} useOverlay=${!!useOverlay} workdirectory=${workdirectory}`);
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);
    const filename = path.basename(String(qcow2Name || ''));
    if (!filename || filename !== String(qcow2Name || '')) {
        throw new Error('invalid qcow2Name');
    }
    if (!filename.toLowerCase().endsWith('.qcow2') || isQemuOverlayDiskName(filename)) {
        throw new Error('invalid qcow2Name');
    }
    const diskPath = path.join(qemuDir, filename);
    await fs.promises.access(diskPath, fs.constants.R_OK);

    const { qemuSystem, qemuImg, binDir } = await getResolvedQemu();
    let drivePath = diskPath;
    if (useOverlay) {
        await killExistingQemuInstances();
        await sleepMs(400);
        const overlayPath = path.join(qemuDir, teacherBootOverlayFilename(filename));
        await unlinkIfExists(overlayPath);
        log.info(`qemuService @ bootDisk: creating overlay ${path.basename(overlayPath)}`);
        const res = await runToCompletion(qemuImg, ['create', '-f', 'qcow2', '-F', 'qcow2', '-b', diskPath, overlayPath], {
            cwd: binDir,
            env: buildQemuSpawnEnv(binDir),
        });
        if (res.exitCode !== 0) {
            throw new Error(`qemu-img overlay failed: ${res.stderr || res.stdout}`);
        }
        drivePath = overlayPath;
    }
    const args = [
        ...getQemuAccelArgs(),
        ...getQemuTeacherBootMemoryArg(),
        ...getQemuSmpArgs(),
        ...getQemuMachineArgs(),
        '-cpu', getQemuCpuArg({ profile: 'runtime' }),
        ...getQemuVirtioDiskDriveArg(drivePath),
        ...getQemuLegacyBootOrderArgs(),
        ...getQemuTeacherVgaArgs(),
        ...getQemuTeacherDisplayArgs(),
        ...getQemuUsbTabletArgs(),
    ];
    const { pid } = await spawnTeacherInteractiveQemu(qemuSystem, args, binDir);
    log.info(`qemuService @ bootDisk: qemu started pid=${pid || 'unknown'} overlay=${!!useOverlay}`);
    return { ok: true, useOverlay: !!useOverlay };
}

async function importDisk({ workdirectory, sourcePath, onProgress = null }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);
    const src = path.resolve(String(sourcePath || ''));
    if (!src) throw new Error('invalid sourcePath');
    const filename = path.basename(src);
    if (!filename.toLowerCase().endsWith('.qcow2')) throw new Error('invalid file type');
    const dest = path.resolve(path.join(qemuDir, filename));
    log.info(`qemuService @ importDisk: src=${src} dest=${dest}`);
    if (src === dest) {
        log.info(`qemuService @ importDisk: skipped (already in QEMU folder)`);
        try { onProgress?.({ phase: 'skip', percent: 100, copied: 0, total: 0 }); } catch (e) {}
        return { ok: true, filename, skipped: true };
    }
    if (fs.existsSync(dest)) {
        log.info(`qemuService @ importDisk: removing existing ${dest}`);
        await fs.promises.unlink(dest);
    }
    try {
        const srcStat = await fs.promises.stat(src);
        const destDirStat = await fs.promises.stat(path.dirname(dest));
        if (srcStat.dev === destDirStat.dev) {
            log.info(`qemuService @ importDisk: hardlink (same volume, ${srcStat.size} bytes)`);
            await fs.promises.link(src, dest);
            try { onProgress?.({ phase: 'linked', percent: 100, copied: srcStat.size, total: srcStat.size }); } catch (e) {}
            return { ok: true, filename, linked: true };
        }
    } catch (e) {
        log.info(`qemuService @ importDisk: link failed, copying (${e?.message || e})`);
    }
    const srcStat = await fs.promises.stat(src);
    log.info(`qemuService @ importDisk: copying ${srcStat.size} bytes…`);
    await copyQcow2ToDest(src, dest, onProgress, {
        onLog: (msg) => log.info(`qemuService @ importDisk: ${msg}`),
    });
    return { ok: true, filename };
}

export default {
    listDisks,
    hashDisk,
    statDisk,
    installDefaultVm,
    bootDisk,
    importDisk,
    getQemuDir,
    DEFAULTS,
};

