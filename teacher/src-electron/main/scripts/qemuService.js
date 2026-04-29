import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import https from 'https';
import log from 'electron-log';
import crypto from 'crypto';

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

function getQemuDir(workdirectory) {
    return path.join(workdirectory, 'QEMU');
}

async function ensureDir(dir) {
    await fs.promises.mkdir(dir, { recursive: true });
}

async function downloadFile(url, destPath) {
    await ensureDir(path.dirname(destPath));
    const tmpPath = `${destPath}.part`;

    if (fs.existsSync(destPath)) {
        return { ok: true, skipped: true, path: destPath };
    }

    return await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(tmpPath);
        const req = https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close(() => {
                    try { fs.unlinkSync(tmpPath); } catch (e) {}
                    downloadFile(res.headers.location, destPath).then(resolve, reject);
                });
                return;
            }
            if (res.statusCode !== 200) {
                file.close(() => {
                    try { fs.unlinkSync(tmpPath); } catch (e) {}
                    reject(new Error(`download failed: ${res.statusCode} ${res.statusMessage || ''}`.trim()));
                });
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close(async () => {
                    try {
                        await fs.promises.rename(tmpPath, destPath);
                        resolve({ ok: true, skipped: false, path: destPath });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });
        req.on('error', (err) => {
            try { file.close(() => {}); } catch (e) {}
            try { fs.unlinkSync(tmpPath); } catch (e) {}
            reject(err);
        });
    });
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

function spawnLogged(cmd, args, options = {}) {
    log.info(`qemuService: spawn ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args, { ...options });
    proc.on('error', (e) => log.error(`qemuService: spawn error ${cmd}`, e));
    return proc;
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

async function listDisks({ workdirectory }) {
    const dir = getQemuDir(workdirectory);
    await ensureDir(dir);
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.qcow2'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
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

async function ensureAnswerIsoPresent(qemuDir) {
    const dest = path.join(qemuDir, DEFAULTS.answerIsoName);
    if (fs.existsSync(dest)) return dest;

    const candidate = getRepoPathRelative('../../../scripts/qemu', DEFAULTS.answerIsoName);
    if (!fs.existsSync(candidate)) {
        throw new Error(`missing ${DEFAULTS.answerIsoName} (expected in ${candidate} or ${dest})`);
    }
    await fs.promises.copyFile(candidate, dest);
    return dest;
}

async function ensureDisk(qemuDir) {
    const diskPath = path.join(qemuDir, DEFAULTS.diskName);
    if (fs.existsSync(diskPath)) return diskPath;
    const res = await runToCompletion('qemu-img', ['create', '-f', 'qcow2', diskPath, DEFAULTS.diskSize], { cwd: qemuDir });
    if (res.exitCode !== 0) {
        throw new Error(`qemu-img failed: ${res.stderr || res.stdout}`);
    }
    return diskPath;
}

async function installDefaultVm({ workdirectory }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);

    const isoPath = path.join(qemuDir, DEFAULTS.isoName);
    const virtioPath = path.join(qemuDir, DEFAULTS.virtioName);

    await downloadFile(DEFAULTS.isoUrl, isoPath);
    await downloadFile(DEFAULTS.virtioUrl, virtioPath);
    const answerIsoPath = await ensureAnswerIsoPresent(qemuDir);
    const diskPath = await ensureDisk(qemuDir);

    const args = [
        '-enable-kvm',
        '-m', '8192',
        '-smp', '4',
        '-cpu', 'host',
        '-machine', 'q35',
        '-drive', `file=${diskPath},if=virtio,cache=none,aio=native`,
        '-drive', `file=${isoPath},media=cdrom,if=none,id=winiso,readonly=on`,
        '-device', 'ide-cd,bus=ide.0,drive=winiso',
        '-drive', `file=${virtioPath},media=cdrom,if=none,id=virtiocd,readonly=on`,
        '-device', 'ide-cd,bus=ide.1,drive=virtiocd',
        '-drive', `file=${answerIsoPath},media=cdrom,if=none,id=answercd,readonly=on`,
        '-device', 'ide-cd,bus=ide.2,drive=answercd',
        '-vga', 'std',
        '-boot', 'once=d',
        '-device', 'usb-ehci',
        '-device', 'usb-tablet',
        '-device', 'virtio-net-pci,netdev=n0',
        '-netdev', 'user,id=n0',
    ];

    const platform = process.platform;
    if (platform === 'linux' || platform === 'win32' || platform === 'darwin') {
        // same commands for now (linux first); platform-specific tuning later
    }

    const proc = spawnLogged('qemu-system-x86_64', args, { cwd: qemuDir, detached: true, stdio: 'ignore' });
    try { proc.unref(); } catch (e) {}

    return { ok: true, qemuDir, diskName: DEFAULTS.diskName, vncDisplay: DEFAULTS.vncDisplay };
}

async function bootDisk({ workdirectory, qcow2Name }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);
    const filename = path.basename(String(qcow2Name || ''));
    if (!filename || filename !== String(qcow2Name || '')) {
        throw new Error('invalid qcow2Name');
    }
    if (!filename.toLowerCase().endsWith('.qcow2')) {
        throw new Error('invalid qcow2Name');
    }
    const diskPath = path.join(qemuDir, filename);
    await fs.promises.access(diskPath, fs.constants.R_OK);

    const args = [
        '-enable-kvm',
        '-m', '8192',
        '-smp', '4',
        '-cpu', 'host',
        '-drive', `file=${diskPath},if=virtio`,
        '-vga', 'virtio',
        '-device', 'qemu-xhci',
        '-device', 'usb-tablet',
        '-boot', 'order=c',
    ];

    const platform = process.platform;
    if (platform === 'linux' || platform === 'win32' || platform === 'darwin') {
        // same commands for now (linux first); platform-specific tuning later
    }

    const proc = spawnLogged('qemu-system-x86_64', args, { cwd: qemuDir, detached: true, stdio: 'ignore' });
    try { proc.unref(); } catch (e) {}
    return { ok: true };
}

async function importDisk({ workdirectory, sourcePath }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);
    const src = String(sourcePath || '');
    if (!src) throw new Error('invalid sourcePath');
    const filename = path.basename(src);
    if (!filename.toLowerCase().endsWith('.qcow2')) throw new Error('invalid file type');
    const dest = path.join(qemuDir, filename);
    await fs.promises.copyFile(src, dest);
    return { ok: true, filename };
}

export default {
    listDisks,
    hashDisk,
    installDefaultVm,
    bootDisk,
    importDisk,
    getQemuDir,
    DEFAULTS,
};

