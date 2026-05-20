import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

const GIB = 1024 * 1024 * 1024;
const VM_RAM_MB_HIGH = 8192;
const VM_RAM_MB_LOW = 4096;
const LOCALVM_QMP_PORT = 47043;

const HV_GUEST = 'hv_relaxed,hv_spinlocks=0x1fff,hv_vapic,hv_time';

/** WHPX UEFI ISO boot; avoid host/max (VP exit 4 on APX hosts). */
export const WIN32_CPU_UEFI_BOOT = 'Skylake-Client,vendor=GenuineIntel,+nx,+popcnt';

const WIN32_CPU_RUNTIME_CANDIDATES = [
    WIN32_CPU_UEFI_BOOT,
    `Skylake-Client-IBRS,vmx=off,${HV_GUEST}`,
    `Haswell-noTSX,${HV_GUEST}`,
    `qemu64,${HV_GUEST}`,
];

let cachedWin32RuntimeCpuArg = null;
let cachedMemoryMb = null;
let cachedX86Accel = null;

export function clearWin32WhpxCpuCache() {
    cachedWin32RuntimeCpuArg = null;
    cachedMemoryMb = null;
    cachedX86Accel = null;
}

/** Cache accel from probeQemuX86Accel (hvf on Intel Mac, tcg on Apple Silicon x86_64). */
export function setCachedQemuX86Accel(accel) {
    cachedX86Accel = accel === 'tcg' ? 'tcg' : 'hvf';
}

/** Parse qemu-system-x86_64 -accel help; prefer hvf when listed else tcg. */
export async function probeQemuX86Accel(qemuSystem, binDir, env = process.env) {
    const text = await new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { proc.kill(); } catch (e) {}
            resolve(value);
        };
        const proc = spawn(qemuSystem, ['-accel', 'help'], {
            cwd: binDir,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        const onData = (d) => { out += String(d); };
        proc.stdout?.on('data', onData);
        proc.stderr?.on('data', onData);
        const timer = setTimeout(() => finish(out), 3000);
        proc.on('error', () => finish(''));
        proc.on('close', () => finish(out));
    });
    const accel = /\bhvf\b/i.test(text) ? 'hvf' : 'tcg';
    setCachedQemuX86Accel(accel);
    return accel;
}

/** Guest RAM (MiB): 8192 if host >8 GiB else 4096; cap ~45% host RAM. */
export function getQemuMemoryMb() {
    if (cachedMemoryMb !== null) return cachedMemoryMb;
    const totalMb = Math.floor(os.totalmem() / (1024 * 1024));
    let mb = os.totalmem() > 8 * GIB ? VM_RAM_MB_HIGH : VM_RAM_MB_LOW;
    const capMb = Math.max(2048, Math.floor(totalMb * 0.45));
    mb = Math.min(mb, capMb);
    cachedMemoryMb = mb;
    return mb;
}

export function getWin32RuntimeCpuCandidates() {
    return [...WIN32_CPU_RUNTIME_CANDIDATES];
}

export function setCachedWin32RuntimeCpuArg(cpuArg) {
    cachedWin32RuntimeCpuArg = cpuArg;
}

export function getQemuAccelArgs() {
    if (process.platform === 'linux') return ['-enable-kvm'];
    if (process.platform === 'win32') return ['-accel', 'whpx'];
    if (process.platform === 'darwin') {
        if (cachedX86Accel === 'tcg') return ['-accel', 'tcg,thread=multi'];
        return ['-accel', 'hvf'];
    }
    return [];
}

/** q35 on all hosts (fewer WHPX IRQ issues on Windows than pc/i440fx). */
export function getQemuMachineArgs() {
    return ['-machine', 'q35'];
}

const OVMF_FIRMWARE_JSON = '60-edk2-ovmf-x86_64-4m.json';

/** QEMU share dir: Windows <prefix>/share; Linux /usr/bin → /usr/share. */
function resolveQemuShareDir(binDir) {
    const candidates = [
        path.join(binDir, 'share'),
        path.join(binDir, '..', 'share'),
    ];
    for (const dir of candidates) {
        try {
            if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
                return dir;
            }
        } catch (e) {}
    }
    return candidates[0];
}

/** Resolve OVMF CODE + VARS template from distro layout (QEMU json descriptor or common paths). */
export function resolveSystemQemuFirmwarePaths(binDir) {
    const fromJson = _resolveOvmfFromQemuFirmwareJson(binDir);
    if (fromJson) return fromJson;

    const share = resolveQemuShareDir(binDir);
    const pairs = [
        [path.join(share, 'edk2-x86_64-code.fd'), path.join(share, 'edk2-x86_64-vars.fd')],
        [path.join(share, 'edk2-x86_64-code.fd'), path.join(share, 'edk2-i386-vars.fd')],
        ['/usr/share/edk2/x64/OVMF_CODE.4m.fd', '/usr/share/edk2/x64/OVMF_VARS.4m.fd'],
        ['/usr/share/edk2/x64/OVMF_CODE.fd', '/usr/share/edk2/x64/OVMF_VARS.fd'],
        ['/usr/share/OVMF/OVMF_CODE.fd', '/usr/share/OVMF/OVMF_VARS.fd'],
    ];
    for (const [code, varsTemplate] of pairs) {
        if (fs.existsSync(code) && fs.existsSync(varsTemplate)) {
            return { code, varsTemplate };
        }
    }
    throw new Error(
        'OVMF firmware not found (Linux: edk2-ovmf; Windows: QEMU installer share/). '
        + `UEFI Windows VMs need CODE+VARS pflash files. Searched under ${share}.`
    );
}

/** Read paths from share/qemu/firmware/*.json (Arch/Fedora/Debian). */
function _resolveOvmfFromQemuFirmwareJson(binDir) {
    const share = resolveQemuShareDir(binDir);
    const jsonPath = path.join(share, 'qemu', 'firmware', OVMF_FIRMWARE_JSON);
    if (!fs.existsSync(jsonPath)) return null;
    try {
        const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const code = j?.mapping?.executable?.filename;
        const varsTemplate = j?.mapping?.['nvram-template']?.filename;
        if (code && varsTemplate && fs.existsSync(code) && fs.existsSync(varsTemplate)) {
            return { code, varsTemplate };
        }
    } catch (e) {
        return null;
    }
    return null;
}

/** One OVMF vars file per qcow2 so install/imported disks keep their own UEFI boot entries. */
export function getQemuNvramVarsFilename(qcow2Name) {
    const base = path.basename(String(qcow2Name || ''));
    if (!base || !base.toLowerCase().endsWith('.qcow2')) {
        return 'nvram.vars';
    }
    return `${base}.nvram.vars`;
}

export async function ensureWritableNvramVars(qemuWorkDir, varsTemplatePath, destName = 'nvram.vars') {
    await fs.promises.mkdir(qemuWorkDir, { recursive: true });
    const dest = path.join(qemuWorkDir, destName);
    const legacy = path.join(qemuWorkDir, 'nvram.vars');
    if (!fs.existsSync(dest) && destName !== 'nvram.vars' && fs.existsSync(legacy)) {
        await fs.promises.copyFile(legacy, dest);
        return dest;
    }
    if (!fs.existsSync(dest)) {
        await fs.promises.copyFile(varsTemplatePath, dest);
    }
    return dest;
}

export function getQemuUefiPflashArgs(codePath, nvramPath) {
    return [
        '-drive', `if=pflash,format=raw,readonly=on,file=${codePath}`,
        '-drive', `if=pflash,format=raw,file=${nvramPath}`,
    ];
}

export function getQemuInstallCdromArgs(isoPath, virtioPath, answerIsoPath) {
    return [
        '-cdrom', isoPath,
        '-drive', `file=${virtioPath},media=cdrom`,
        '-drive', `file=${answerIsoPath},media=cdrom`,
    ];
}

export function getQemuCpuArg({ profile = 'runtime' } = {}) {
    if (process.platform === 'win32') {
        if (profile === 'uefi-install') return WIN32_CPU_UEFI_BOOT;
        // Runtime always Skylake without hv_*; WHPX probe cache must not override (hangs Linux-built images).
        return WIN32_CPU_UEFI_BOOT;
    }
    // Apple Silicon x86_64 QEMU has tcg only; -cpu host is invalid under tcg.
    if (process.platform === 'darwin' && cachedX86Accel === 'tcg') {
        return 'max';
    }
    return `host,${HV_GUEST}`;
}

export function getQemuMemoryArg() {
    return ['-m', String(getQemuMemoryMb())];
}

/** Teacher interactive boot on Win32: match manual line (-m 8192), not 45% cap. */
export function getQemuTeacherBootMemoryArg() {
    if (process.platform === 'win32') {
        return ['-m', '8192'];
    }
    return getQemuMemoryArg();
}

export function getQemuSmpArgs() {
    if (process.platform === 'win32') return ['-smp', 'cores=4,threads=1'];
    return ['-smp', '4'];
}

/** RTC omitted on Win32 WHPX boot (matches working manual line). */
export function getQemuRtcArgs() {
    return [];
}

export function getQemuVgaDeviceArgs() {
    return ['-vga', 'virtio'];
}

/** Teacher GTK/SDL: -vga virtio (legacy startvm.sh); Full HD via viogpudo + guest display settings. */
export function getQemuTeacherVgaArgs() {
    return getQemuVgaDeviceArgs();
}

/** Student headless VNC: virtio-vga + EDID (-vga none avoids extra std VGA). */
export function getQemuHeadlessVgaArgs({ width = 1920, height = 1080 } = {}) {
    return ['-vga', 'none', '-device', `virtio-vga,max_outputs=1,edid=on,xres=${width},yres=${height}`];
}

/** Headless VNC listen (no resize= — not supported on all QEMU builds, breaks with "invalid parameter resize"). */
export function getQemuVncArgs(vncDisplay = ':1') {
    return ['-vnc', String(vncDisplay || ':1')];
}

export function getQemuUsbTabletArgs() {
    return ['-device', 'qemu-xhci', '-device', 'usb-tablet'];
}

export function getQemuTeacherDisplayArgs() {
    if (process.platform === 'darwin') return ['-display', 'cocoa'];
    if (process.platform === 'win32') return ['-display', 'sdl'];
    return ['-display', 'gtk'];
}

export function getQemuVirtioDiskDriveArg(filePath, { boot = true } = {}) {
    if (process.platform === 'win32') {
        // if=virtio + -boot order=c on pc; avoid cache=none (QEMU 11 false "not qcow2" on WHPX).
        return ['-drive', `file=${filePath},if=virtio,cache=writeback`];
    }
    return ['-drive', `file=${filePath},if=virtio`];
}

/** QMP for graceful shutdown: Windows only supports TCP here (no unix qmp.sock). */
export function getQemuQmpChannel(qemuWorkDir) {
    if (process.platform === 'win32') {
        return { kind: 'tcp', host: '127.0.0.1', port: LOCALVM_QMP_PORT };
    }
    return { kind: 'unix', path: path.join(qemuWorkDir, 'qmp.sock') };
}

export function getQemuQmpArgs(qemuWorkDir) {
    const ch = getQemuQmpChannel(qemuWorkDir);
    if (ch.kind === 'tcp') {
        return ['-qmp', `tcp:127.0.0.1:${ch.port},server=on,wait=off`];
    }
    return ['-qmp', `unix:${ch.path},server=on,wait=off`];
}

/** ISO install: CD boot once; Win32 uses SeaBIOS pc like Linux (autounattend is MBR). */
export async function getQemuUefiInstallExtras({ binDir, qemuWorkDir, isoPath, virtioPath, answerIsoPath, qcow2Name }) {
    return [...getQemuInstallCdromArgs(isoPath, virtioPath, answerIsoPath), '-boot', 'once=d'];
}

/** Runtime: no OVMF pflash on Win32 (Linux/mac use q35 auto-OVMF or empty). */
export async function getQemuUefiRuntimeExtras() {
    return [];
}

/** Disk boot after install / imported qcow2 (pc + SeaBIOS on Win32). */
export function getQemuLegacyBootOrderArgs() {
    return ['-boot', 'order=c'];
}
