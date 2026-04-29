import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawn } from 'child_process';
import log from 'electron-log';
import crypto from 'crypto';

let vmProc = null;
let vmDisk = null;
let vmVncDisplay = null;
let vmOverlayPath = null;

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

function spawnLogged(cmd, args, options = {}) {
    log.info(`qemuService: spawn ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args, { ...options });
    proc.on('error', (e) => log.error(`qemuService: spawn error ${cmd}`, e));
    return proc;
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

function stopVm() {
    if (vmProc && !vmProc.killed) {
        try {
            vmProc.kill();
        } catch (e) {
            log.error('qemuService: stopVm kill failed', e);
        }
    }
    vmProc = null;
    vmDisk = null;
    vmVncDisplay = null;
    if (vmOverlayPath) {
        try {
            if (fs.existsSync(vmOverlayPath)) {
                fs.unlinkSync(vmOverlayPath);
            }
        } catch (e) {
            log.error('qemuService: failed to delete overlay', e);
        }
    }
    vmOverlayPath = null;
    return true;
}

async function startHeadless({ workdirectory, qcow2Name, vncDisplay = ':1', overlayName = null }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);

    if (!isSafeFilename(qcow2Name) || !qcow2Name.toLowerCase().endsWith('.qcow2')) {
        throw new Error('invalid qcow2Name');
    }

    const disk = diskPath(workdirectory, qcow2Name);
    if (!fs.existsSync(disk)) {
        throw new Error('disk not found');
    }

    const same =
        vmProc &&
        !vmProc.killed &&
        vmDisk === disk &&
        vmVncDisplay === vncDisplay;
    if (same) {
        return { ok: true, reused: true, disk: qcow2Name, vncDisplay };
    }

    stopVm();

    const overlayFilename = overlayName && isSafeFilename(overlayName) ? overlayName : `${qcow2Name}.overlay.qcow2`;
    const overlayPath = path.join(qemuDir, overlayFilename);
    if (!fs.existsSync(overlayPath)) {
        const res = await runToCompletion('qemu-img', ['create', '-f', 'qcow2', '-F', 'qcow2', '-b', disk, overlayPath], { cwd: qemuDir });
        if (res.exitCode !== 0) {
            throw new Error(`qemu-img overlay failed: ${res.stderr || res.stdout}`);
        }
    }

    const args = [
        '-enable-kvm',
        '-cpu', 'host',
        '-m', '8192',
        '-smp', '4',
        '-drive', `file=${overlayPath},if=virtio,cache=none,aio=native`,
        '-vga', 'std',
        '-display', 'none',
        '-vnc', vncDisplay,
        '-netdev', 'user,id=n0',
        '-device', 'virtio-net-pci,netdev=n0',
        '-device', 'usb-ehci',
        '-device', 'usb-tablet',
        '-boot', 'order=c',
    ];

    const platform = process.platform;
    if (platform === 'linux' || platform === 'win32' || platform === 'darwin') {
        // same commands for now (linux first); platform-specific tuning later
    }

    const proc = spawnLogged('qemu-system-x86_64', args, { cwd: qemuDir, detached: true, stdio: 'ignore' });
    try { proc.unref(); } catch (e) {}

    vmProc = proc;
    vmDisk = disk;
    vmVncDisplay = vncDisplay;
    vmOverlayPath = overlayPath;
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

async function downloadDiskFromTeacher({ serverip, serverApiPort, servername, token, filename, workdirectory }) {
    if (!serverip || !serverApiPort || !servername || !token) {
        throw new Error('invalid download args');
    }
    if (!isSafeFilename(filename) || !filename.toLowerCase().endsWith('.qcow2')) {
        throw new Error('invalid filename');
    }

    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);

    const dest = path.join(qemuDir, filename);
    if (fs.existsSync(dest)) {
        return { ok: true, skipped: true, path: dest };
    }
    const tmp = `${dest}.part`;

    const urlPath = `/server/data/qemu/${encodeURIComponent(servername)}/${encodeURIComponent(token)}/${encodeURIComponent(filename)}`;
    const options = {
        hostname: serverip,
        port: Number(serverApiPort),
        path: urlPath,
        method: 'GET',
        rejectUnauthorized: false,
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
            res.pipe(file);
            file.on('finish', () => {
                file.close(async () => {
                    try {
                        await fs.promises.rename(tmp, dest);
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
        req.end();
    });
}

export default {
    getQemuDir,
    startHeadless,
    stopVm,
    downloadDiskFromTeacher,
    verifyDiskSha256,
};

