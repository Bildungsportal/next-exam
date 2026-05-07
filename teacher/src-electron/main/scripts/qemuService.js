import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import http from 'http';
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

async function downloadFile(url, destPath, onProgress = null) {
    await ensureDir(path.dirname(destPath));
    const tmpPath = `${destPath}.part`;

    if (fs.existsSync(destPath)) {
        log.info(`qemuService @ downloadFile: skip exists ${destPath}`);
        try { onProgress?.({ phase: 'skip', file: path.basename(destPath), percent: 100 }); } catch (e) {}
        return { ok: true, skipped: true, path: destPath };
    }

    log.info(`qemuService @ downloadFile: ${url} -> ${destPath}`);
    return await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(tmpPath);
        const u = new URL(url);
        const client = u.protocol === 'http:' ? http : https;
        const req = client.get(u, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                log.info(`qemuService @ downloadFile: redirect ${res.statusCode} -> ${res.headers.location}`);
                file.close(() => {
                    try { fs.unlinkSync(tmpPath); } catch (e) {}
                    downloadFile(res.headers.location, destPath, onProgress).then(resolve, reject);
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
            const total = Number(res.headers['content-length'] || 0) || 0;
            let received = 0;
            let lastPct = -1;
            const loggedMilestones = new Set();
            try { onProgress?.({ phase: 'start', file: path.basename(destPath), percent: 0 }); } catch (e) {}
            res.on('data', (chunk) => {
                received += chunk.length;
                if (total > 0) {
                    const pct = Math.floor((received / total) * 100);
                    if (pct !== lastPct) {
                        lastPct = pct;
                        try { onProgress?.({ phase: 'downloading', file: path.basename(destPath), percent: pct }); } catch (e) {}
                    }
                    if (pct === 5 || pct === 25 || pct === 50 || pct === 75 || pct === 90) {
                        if (!loggedMilestones.has(pct)) {
                            loggedMilestones.add(pct);
                            log.info(`qemuService @ downloadFile: ${path.basename(destPath)} ${pct}%`);
                        }
                    }
                }
            });
            res.pipe(file);
            file.on('finish', () => {
                file.close(async () => {
                    try {
                        await fs.promises.rename(tmpPath, destPath);
                        log.info(`qemuService @ downloadFile: done ${destPath}`);
                        try { onProgress?.({ phase: 'done', file: path.basename(destPath), percent: 100 }); } catch (e) {}
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
    if (fs.existsSync(diskPath)) return diskPath;
    const res = await runToCompletion('qemu-img', ['create', '-f', 'qcow2', diskPath, DEFAULTS.diskSize], { cwd: qemuDir });
    if (res.exitCode !== 0) {
        throw new Error(`qemu-img failed: ${res.stderr || res.stdout}`);
    }
    return diskPath;
}

function getAccelArgs() {
    const platform = process.platform;
    if (platform === 'linux') return ['-enable-kvm'];
    if (platform === 'win32') return ['-accel', 'whpx'];
    if (platform === 'darwin') return ['-accel', 'hvf'];
    return [];
}

async function installDefaultVm({ workdirectory, onProgress = null }) {
    const qemuDir = getQemuDir(workdirectory);
    await ensureDir(qemuDir);

    log.info(`qemuService @ installDefaultVm: requested (workdirectory=${workdirectory})`);
    const isoPath = path.join(qemuDir, DEFAULTS.isoName);
    const virtioPath = path.join(qemuDir, DEFAULTS.virtioName);

    await downloadFile(DEFAULTS.isoUrl, isoPath, onProgress);
    await downloadFile(DEFAULTS.virtioUrl, virtioPath, onProgress);
    const answerIsoPath = await ensureAnswerIsoPresent(qemuDir);
    const diskPath = await ensureDisk(qemuDir);
    log.info(`qemuService @ installDefaultVm: assets ready (iso=${isoPath}, virtio=${virtioPath}, answerIso=${answerIsoPath}, disk=${diskPath})`);

    const args = [
        ...getAccelArgs(),
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

    const proc = spawnLogged('qemu-system-x86_64', args, { cwd: qemuDir, detached: true, stdio: 'ignore' });
    try { proc.unref(); } catch (e) {}
    log.info(`qemuService @ installDefaultVm: qemu started pid=${proc?.pid || 'unknown'}`);

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
        ...getAccelArgs(),
        '-m', '8192',
        '-smp', '4',
        '-cpu', 'host',
        '-machine', 'q35',
        '-drive', `file=${diskPath},if=virtio`,
        '-vga', 'virtio',
        '-device', 'qemu-xhci',
        '-device', 'usb-tablet',
        '-device', 'virtio-net-pci,netdev=n0',
        '-netdev', 'user,id=n0',
        '-boot', 'order=c',
    ];

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
    statDisk,
    installDefaultVm,
    bootDisk,
    importDisk,
    getQemuDir,
    DEFAULTS,
};

