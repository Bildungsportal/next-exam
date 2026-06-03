import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawn } from 'child_process';
import log from 'electron-log';
import crypto from 'crypto';
import net from 'net';
import { startExamWebdav, stopExamWebdav, EXAM_WEBDAV_PORT, EXAM_WEBDAV_MOUNT_PATH } from './examWebdavServer.js';
import { NEXT_EXAM_API_SECRET, NEXT_EXAM_API_SECRET_HEADER } from '../../../../shared/nextExamApiSecret.js';
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
    getQemuRtcArgs,
    getQemuSmpArgs,
    getQemuQmpArgs,
    getQemuQmpChannel,
    getQemuUsbTabletArgs,
    getQemuVirtioDiskDriveArg,
    getQemuVgaDeviceArgs,
    getQemuLegacyBootOrderArgs,
    getQemuHeadlessVgaArgs,
    getQemuVncArgs,
} from '../../../../shared/qemuHostArgs.js';

let vmProc = null;
let vmDisk = null;
let vmVncDisplay = null;
let vmOverlayPath = null;
let vmQmpChannel = null;

function getQemuDir(workdirectory) {
    return path.join(workdirectory, 'QEMU');
}

async function ensureDir(dir) {
    await fs.promises.mkdir(dir, { recursive: true });
}

function diskPath(workdirectory, qcow2Name) {
    return path.join(getQemuDir(workdirectory), qcow2Name);
}

function isSafeFilename(name) {
    const base = path.basename(name);
    return base === name && !!base && !base.includes('..') && !base.includes('/') && !base.includes('\\');
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

function spawnLogged(cmd, args, options = {}) {
    log.info(`qemuService: spawn ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args, { ...options });
    proc.on('error', (e) => log.error(`qemuService: spawn error ${cmd}`, e));
    return proc;
}

async function importDisk({ workdirectory, sourcePath, onProgress = null }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);
    const src = path.resolve(String(sourcePath || ''));
    if (!src) {
        throw new Error('invalid qcow2 source');
    }
    const filename = path.basename(src);
    if (!filename || !filename.toLowerCase().endsWith('.qcow2')) {
        throw new Error('invalid qcow2 source');
    }
    const dest = path.resolve(path.join(qemuDir, filename));
    log.info(`qemuService @ importDisk: src=${src} dest=${dest}`);
    if (src === dest) {
        log.info(`qemuService @ importDisk: skipped (already in QEMU folder): ${filename}`);
        try { onProgress?.({ phase: 'skip', percent: 100, copied: 0, total: 0 }); } catch (e) {}
        return { ok: true, skipped: true, filename };
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
            return { ok: true, skipped: false, filename, linked: true };
        }
    } catch (e) {
        log.info(`qemuService @ importDisk: link failed, copying (${e?.message || e})`);
    }
    log.info(`qemuService @ importDisk: copying ${src} -> ${dest}`);
    await copyQcow2ToDest(src, dest, onProgress, {
        onLog: (msg) => log.info(`qemuService @ importDisk: ${msg}`),
    });
    log.info(`qemuService @ importDisk: copied: ${filename}`);
    return { ok: true, skipped: false, filename };
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

async function runToCompletion(cmd, args, options = {}) {
    return await new Promise((resolve, reject) => {
        const proc = spawnLogged(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (d) => { stdout += String(d); });
        proc.stderr?.on('data', (d) => { stderr += String(d); });
        proc.on('error', reject);
        proc.on('close', (code) => resolve({ exitCode: code, stdout, stderr }));
    });
}

function sleepMs(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function killQemuProcessesUsingWorkdir(qemuDir) {
    if (process.platform === 'win32') {
        const r = await runToCompletion('taskkill', ['/F', '/IM', 'qemu-system-x86_64.exe']);
        log.info(`qemuService @ killQemuProcessesUsingWorkdir: taskkill exit=${r.exitCode}`);
        return;
    }
    log.warn(`qemuService @ killQemuProcessesUsingWorkdir: killall qemu-system-x86_64 (TERM then KILL) cwdRef=${qemuDir}`);
    const term = await runToCompletion('killall', ['-TERM', 'qemu-system-x86_64']);
    log.info(`qemuService @ killQemuProcessesUsingWorkdir: killall -TERM exit=${term.exitCode}`);
    await sleepMs(600);
    const kill = await runToCompletion('killall', ['-KILL', 'qemu-system-x86_64']);
    log.info(`qemuService @ killQemuProcessesUsingWorkdir: killall -KILL exit=${kill.exitCode}`);
}

async function waitForTcpPortOpen({ host = '127.0.0.1', port, timeoutMs = 15000, stepMs = 250 }) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const ok = await new Promise((resolve) => {
            const socket = new net.Socket();
            const done = (result) => {
                try { socket.destroy(); } catch (e) {}
                resolve(result);
            };
            socket.setTimeout(Math.min(stepMs, 1000));
            socket.once('connect', () => done(true));
            socket.once('timeout', () => done(false));
            socket.once('error', () => done(false));
            try {
                socket.connect(port, host);
            } catch (e) {
                done(false);
            }
        });
        if (ok) return true;
        await new Promise((r) => setTimeout(r, stepMs));
    }
    return false;
}

function vncDisplayToPort(vncDisplay) {
    const s = String(vncDisplay || ':1').trim();
    const m = s.match(/^:(\d+)$/);
    const displayNum = m ? Number(m[1]) : 1;
    return 5900 + (Number.isFinite(displayNum) ? displayNum : 1);
}

async function qmpExecute(channel, cmd) {
    if (!channel?.kind) {
        throw new Error('missing qmp channel');
    }
    const connectOpts = channel.kind === 'tcp'
        ? { host: channel.host, port: channel.port }
        : { path: channel.path };
    return await new Promise((resolve, reject) => {
        const sock = net.createConnection(connectOpts);
        let buffer = '';
        let greeted = false;
        const done = (result) => {
            try { sock.end(); } catch (e) {}
            resolve(result);
        };
        sock.on('error', reject);
        sock.on('data', (d) => {
            buffer += String(d);
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                let msg = null;
                try { msg = JSON.parse(trimmed); } catch (e) { continue; }
                if (msg.QMP && !greeted) {
                    greeted = true;
                    sock.write(`${JSON.stringify({ execute: 'qmp_capabilities' })}\n`);
                    sock.write(`${JSON.stringify({ execute: cmd })}\n`);
                    continue;
                }
                if (msg.return != null || msg.error != null) {
                    done(msg);
                    return;
                }
            }
        });
    });
}

async function shutdownVmGracefully({ timeoutMs = 8000 } = {}) {
    if (!vmProc || vmProc.killed) {
        log.info('qemuService @ shutdownVmGracefully: no running VM');
        return { ok: true, alreadyStopped: true };
    }

    try {
        if (vmQmpChannel) {
            log.info('qemuService @ shutdownVmGracefully: sending ACPI powerdown via QMP');
            await qmpExecute(vmQmpChannel, 'system_powerdown');
        }
    } catch (e) {
        log.warn('qemuService: qmp system_powerdown failed', e);
    }

    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (!vmProc || vmProc.killed || vmProc.exitCode != null) {
            return { ok: true, alreadyStopped: false, graceful: true };
        }
        await new Promise((r) => setTimeout(r, 250));
    }

    log.warn('qemuService @ shutdownVmGracefully: timeout waiting for graceful shutdown');
    return { ok: true, alreadyStopped: false, graceful: false };
}

async function resetVmHard() {
    if (!vmProc || vmProc.killed) {
        throw new Error('no running VM');
    }
    if (!vmQmpChannel) {
        throw new Error('missing qmp channel');
    }
    log.warn('qemuService @ resetVmHard: system_reset via QMP');
    const res = await qmpExecute(vmQmpChannel, 'system_reset');
    if (res?.error) {
        throw new Error(String(res.error?.desc || 'qmp system_reset failed'));
    }
    return { ok: true };
}

// Win: QEMU may keep overlay/qcow2 open briefly after kill → EBUSY; taskkill + short retries.
async function _unlinkIfExists(p) {
    const filePath = String(p || '');
    if (!filePath) return true;
    let didTaskkill = false;
    for (let i = 0; i < 10; i++) {
        try {
            if (!fs.existsSync(filePath)) return true;
            await fs.promises.unlink(filePath);
            log.info(`qemuService: deleted ${filePath}`);
            return true;
        } catch (e) {
            const busy = e?.code === 'EBUSY' || e?.code === 'EPERM';
            if (!busy || i === 9) {
                log.error(`qemuService: failed to delete ${filePath}`, e);
                return false;
            }
            if (process.platform === 'win32' && !didTaskkill) {
                didTaskkill = true;
                try { await runToCompletion('taskkill', ['/F', '/IM', 'qemu-system-x86_64.exe']); } catch (err) {}
            }
            await new Promise((r) => setTimeout(r, 150 + i * 100));
        }
    }
    return false;
}

async function _waitForVmExit(timeoutMs = 8000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (!vmProc || vmProc.killed || vmProc.exitCode != null) {
            return true;
        }
        await new Promise((r) => setTimeout(r, 50));
    }
    return false;
}

async function _killVmProcessAndWait(killTimeoutMs = 8000) {
    if (vmProc && !vmProc.killed) {
        try {
            log.warn('qemuService @ _killVmProcessAndWait: killing QEMU process');
            vmProc.kill('SIGKILL');
        } catch (e) {
            log.error('qemuService: kill failed', e);
        }
    }
    return await _waitForVmExit(killTimeoutMs);
}

async function stopVmAsync({ graceful = true, shutdownTimeoutMs = 8000, killTimeoutMs = 8000 } = {}) {
    stopExamWebdav();
    if (!vmProc || vmProc.killed) {
        const overlayToDelete = vmOverlayPath;
        vmProc = null;
        vmDisk = null;
        vmVncDisplay = null;
        const overlayDeleted = await _unlinkIfExists(overlayToDelete);
        if (vmQmpChannel?.kind === 'unix') await _unlinkIfExists(vmQmpChannel.path);
        vmQmpChannel = null;
        if (overlayDeleted) vmOverlayPath = null;
        return { ok: true, alreadyStopped: true };
    }

    let gracefulOk = false;
    if (graceful) {
        try {
            const sd = await shutdownVmGracefully({ timeoutMs: shutdownTimeoutMs });
            gracefulOk = !!sd?.graceful;
        } catch (e) {
            log.warn('qemuService @ stopVmAsync: graceful shutdown failed', e);
        }
    }

    let exited = false;
    if (vmProc && !vmProc.killed && vmProc.exitCode == null) {
        exited = await _killVmProcessAndWait(killTimeoutMs);
    } else {
        exited = await _waitForVmExit(250);
    }
    if (!exited) {
        log.error('qemuService @ stopVmAsync: QEMU did not exit in time');
    }

    const overlayToDelete = vmOverlayPath;
    vmProc = null;
    vmDisk = null;
    vmVncDisplay = null;

    const overlayDeleted = await _unlinkIfExists(overlayToDelete);
    if (vmQmpChannel?.kind === 'unix') await _unlinkIfExists(vmQmpChannel.path);
    vmQmpChannel = null;
    if (overlayDeleted) vmOverlayPath = null;

    return { ok: true, exited: !!exited, graceful: gracefulOk };
}

function stopVm() {
    // Sync wrapper for legacy callers; prefer stopVmAsync in async IPC paths.
    void stopVmAsync({ graceful: false, killTimeoutMs: 2000 });
    return true;
}

// Student exam VM: headless + VNC only (no GTK); teacher bootDisk uses interactive display instead.
async function startHeadless({
    workdirectory,
    examdirectory,
    qcow2Name,
    vncDisplay = ':1',
    overlayName = null,
    blockInternet = false,
    forceFreshOverlay = false,
    displayWidth = null,
    displayHeight = null,
}) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);

    if (!isSafeFilename(qcow2Name) || !qcow2Name.toLowerCase().endsWith('.qcow2')) {
        throw new Error('invalid qcow2Name');
    }

    const disk = diskPath(workdirectory, qcow2Name);
    if (!fs.existsSync(disk)) {
        throw new Error('disk not found');
    }

    const w = Number(displayWidth);
    const h = Number(displayHeight);
    const vgaArgs = (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0)
        ? getQemuHeadlessVgaArgs({ width: w, height: h })
        : getQemuHeadlessVgaArgs();
    log.info(`qemuService @ startHeadless: starting (disk=${qcow2Name}, vnc=${vncDisplay}, display=${vgaArgs.join(' ')}, blockInternet=${blockInternet})`);
    await killQemuProcessesUsingWorkdir(qemuDir);
    await stopVmAsync({ graceful: false, killTimeoutMs: 8000 });

    const overlayFilename = overlayName && isSafeFilename(overlayName) ? overlayName : `${qcow2Name}.overlay.qcow2`;
    const overlayPath = path.join(qemuDir, overlayFilename);
    if (forceFreshOverlay && fs.existsSync(overlayPath)) {
        log.warn(`qemuService @ startHeadless: deleting existing overlay ${overlayFilename} (forceFreshOverlay)`);
        await _unlinkIfExists(overlayPath);
    }
    const { qemuImg, qemuSystem, binDir } = await getResolvedQemu();
    if (!fs.existsSync(overlayPath)) {
        log.info(`qemuService @ startHeadless: creating overlay ${overlayFilename}`);
        const res = await runToCompletion(qemuImg, ['create', '-f', 'qcow2', '-F', 'qcow2', '-b', disk, overlayPath], {
            cwd: binDir,
            env: buildQemuSpawnEnv(binDir),
        });
        if (res.exitCode !== 0) {
            throw new Error(`qemu-img overlay failed: ${res.stderr || res.stdout}`);
        }
    }

    startExamWebdav({
        rootDir: examdirectory,
        port: EXAM_WEBDAV_PORT,
        mountPath: EXAM_WEBDAV_MOUNT_PATH,
    });
    log.info(`qemuService @ startHeadless: exam WebDAV http://10.0.2.2:${EXAM_WEBDAV_PORT}${EXAM_WEBDAV_MOUNT_PATH} -> ${workdirectory}`);

    // restrict=on blocks general internet; guestfwd tunnels guest TCP to 10.0.2.2:EXAM_WEBDAV_PORT to host WebDAV (must listen before QEMU starts).
    const webdavGuestFwd = `guestfwd=tcp:10.0.2.2:${EXAM_WEBDAV_PORT}-tcp:127.0.0.1:${EXAM_WEBDAV_PORT}`;
    const netArgs = blockInternet
        ? ['-netdev', `user,id=net0,restrict=on,${webdavGuestFwd}`, '-device', 'virtio-net-pci,netdev=net0']
        : ['-netdev', 'user,id=n0', '-device', 'virtio-net-pci,netdev=n0'];

    const args = [
        ...getQemuAccelArgs(),
        ...getQemuMemoryArg(),
        ...getQemuSmpArgs(),
        ...getQemuRtcArgs(),
        ...getQemuMachineArgs(),
        '-cpu', getQemuCpuArg({ profile: 'runtime' }),
        ...getQemuVirtioDiskDriveArg(overlayPath),
        ...vgaArgs,
        '-display', 'none',
        ...getQemuVncArgs(vncDisplay),
        ...getQemuQmpArgs(qemuDir),
        ...netArgs,
        ...getQemuUsbTabletArgs(),
        ...getQemuLegacyBootOrderArgs(),
    ];

    const platform = process.platform;
    if (platform === 'linux' || platform === 'win32' || platform === 'darwin') {
        // same commands for now (linux first); platform-specific tuning later
    }

    const proc = spawnLogged(qemuSystem, args, {
        cwd: binDir,
        env: buildQemuSpawnEnv(binDir),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    // surface qemu startup failures (KVM/disk-lock/missing device) instead of only "vnc not ready"
    let stderrBuf = '';
    proc.stdout?.on('data', (d) => log.info('qemu(out):', String(d).trim()));
    proc.stderr?.on('data', (d) => {
        const s = String(d);
        stderrBuf += s;
        log.error('qemu(err):', s.trim());
    });

    const vncPort = vncDisplayToPort(vncDisplay);
    log.info(`qemuService @ startHeadless: waiting for VNC 127.0.0.1:${vncPort}`);
    const ready = await waitForTcpPortOpen({ host: '127.0.0.1', port: vncPort, timeoutMs: 15000, stepMs: 250 });
    if (!ready) {
        try { proc.kill(); } catch (e) {}
        // CPU virtualization disabled in BIOS/UEFI: KVM (linux) / HVF (mac) accelerator can't init
        if (/Could not access KVM kernel module|failed to initialize kvm|HV_ERROR|hvf|No accelerator found/i.test(stderrBuf)) {
            const err = new Error('qemu accelerator unavailable (CPU virtualization disabled)');
            err.code = 'virt-disabled';
            throw err;
        }
        throw new Error(`qemu vnc not ready on 127.0.0.1:${vncPort}`);
    }
    log.info(`qemuService @ startHeadless: VNC ready on 127.0.0.1:${vncPort}`);

    vmProc = proc;
    vmDisk = disk;
    vmVncDisplay = vncDisplay;
    vmOverlayPath = overlayPath;
    vmQmpChannel = getQemuQmpChannel(qemuDir);
    return { ok: true, reused: false, disk: qcow2Name, vncDisplay };
}

async function verifyDiskSha256({ workdirectory, qcow2Name, expectedSha256 }) {
    if (!expectedSha256 || typeof expectedSha256 !== 'string') {
        return { ok: false, match: false, error: 'missing expected hash' };
    }
    const disk = diskPath(workdirectory, qcow2Name);
    if (!fs.existsSync(disk)) {
        return { ok: false, match: false, error: 'disk not found' };
    }
    const actual = await sha256File(disk);
    return { ok: true, match: actual.toLowerCase() === expectedSha256.toLowerCase(), actual };
}

async function verifyDiskSize({ workdirectory, qcow2Name, expectedSizeBytes }) {
    if (typeof expectedSizeBytes !== 'number' || !Number.isFinite(expectedSizeBytes) || expectedSizeBytes <= 0) {
        return { ok: false, match: false, error: 'missing expected size' };
    }
    const disk = diskPath(workdirectory, qcow2Name);
    try {
        const st = await fs.promises.stat(disk);
        const actual = st.size;
        return { ok: true, match: actual === expectedSizeBytes, actual };
    } catch (e) {
        if (!fs.existsSync(disk)) {
            return { ok: false, match: false, error: 'disk not found' };
        }
        return { ok: false, match: false, error: String(e?.message || e) };
    }
}

async function downloadDiskFromTeacher({ serverip, serverApiPort, servername, studenttoken, filename, workdirectory, overwrite = false, onProgress = null }) {
    if (!serverip || !serverApiPort || !servername || !studenttoken) {
        throw new Error('invalid download args');
    }
    if (!isSafeFilename(filename) || !filename.toLowerCase().endsWith('.qcow2')) {
        throw new Error('invalid filename');
    }

    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);

    const dest = path.join(qemuDir, filename);
    if (!overwrite && fs.existsSync(dest)) {
        return { ok: true, skipped: true, path: dest };
    }
    const tmp = `${dest}.part`;

    const urlPath = `/server/data/qemu/${encodeURIComponent(servername)}`;
    const postBody = JSON.stringify({ filename });
    const options = {
        hostname: serverip,
        port: Number(serverApiPort),
        path: urlPath,
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
            [NEXT_EXAM_API_SECRET_HEADER]: NEXT_EXAM_API_SECRET,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postBody),
            Authorization: `Bearer ${studenttoken}`,
        },
    };

    return await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(tmp);
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                file.close(() => {
                    try { fs.unlinkSync(tmp); } catch (e) {}
                    reject(new Error(`download failed: ${res.statusCode} ${res.statusMessage || ''}`.trim()));
                });
                return;
            }
            const total = Number(res.headers['content-length'] || 0) || 0;
            let received = 0;
            let lastPct = -1;
            try { onProgress?.({ phase: 'start', filename, percent: 0, receivedBytes: 0, totalBytes: total || null }); } catch (e) {}
            res.on('data', (chunk) => {
                received += chunk.length;
                if (total > 0) {
                    const pct = Math.floor((received / total) * 100);
                    if (pct !== lastPct) {
                        lastPct = pct;
                        try { onProgress?.({ phase: 'downloading', filename, percent: pct, receivedBytes: received, totalBytes: total }); } catch (e) {}
                    }
                } else {
                    try { onProgress?.({ phase: 'downloading', filename, percent: null, receivedBytes: received, totalBytes: null }); } catch (e) {}
                }
            });
            res.pipe(file);
            file.on('finish', () => {
                file.close(async () => {
                    try {
                        if (overwrite && fs.existsSync(dest)) {
                            try { await fs.promises.unlink(dest); } catch (e) {}
                        }
                        await fs.promises.rename(tmp, dest);
                        try { onProgress?.({ phase: 'done', filename, percent: 100, receivedBytes: received, totalBytes: total || null }); } catch (e) {}
                        resolve({ ok: true, skipped: false, path: dest });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });
        req.on('error', (err) => {
            try { file.close(() => {}); } catch (e) {}
            try { fs.unlinkSync(tmp); } catch (e) {}
            reject(err);
        });
        req.write(postBody);
        req.end();
    });
}

async function killAllLocalQemu(workdirectory) {
    return await killQemuProcessesUsingWorkdir(getQemuDir(workdirectory));
}

export default {
    getQemuDir,
    startHeadless,
    shutdownVmGracefully,
    resetVmHard,
    stopVm,
    stopVmAsync,
    killAllLocalQemu,
    downloadDiskFromTeacher,
    verifyDiskSha256,
    verifyDiskSize,
    importDisk,
};

