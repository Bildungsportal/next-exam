import fs from 'fs';
import os from 'os';
import path from 'path';

const GIB = 1024 * 1024 * 1024;
const VM_RAM_MB_HIGH = 8192;
const VM_RAM_MB_LOW = 4096;
const LOCALVM_QMP_PORT = 47043;

const HV_GUEST = 'hv_relaxed,hv_spinlocks=0x1fff,hv_vapic,hv_time';

/** WHPX UEFI ISO boot; avoid host/max (VP exit 4 on APX hosts). */
export const WIN32_CPU_UEFI_BOOT = 'Skylake-Client,vendor=GenuineIntel,+nx,+popcnt';

const WIN32_CPU_RUNTIME_CANDIDATES = [
    `Skylake-Client-IBRS,vmx=off,${HV_GUEST}`,
    WIN32_CPU_UEFI_BOOT,
    `Haswell-noTSX,${HV_GUEST}`,
    `qemu64,${HV_GUEST}`,
];

let cachedWin32RuntimeCpuArg = null;
let cachedMemoryMb = null;

export function clearWin32WhpxCpuCache() {
    cachedWin32RuntimeCpuArg = null;
    cachedMemoryMb = null;
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

export function getQemuAccelArgs({ runtime = false } = {}) {
    if (process.platform === 'linux') return ['-enable-kvm'];
    if (process.platform === 'win32') {
        return runtime ? ['-accel', 'whpx,kernel-irqchip=off'] : ['-accel', 'whpx'];
    }
    if (process.platform === 'darwin') return ['-accel', 'hvf'];
    return [];
}

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
        return cachedWin32RuntimeCpuArg || WIN32_CPU_RUNTIME_CANDIDATES[0];
    }
    return `host,${HV_GUEST}`;
}

export function getQemuMemoryArg() {
    return ['-m', String(getQemuMemoryMb())];
}

export function getQemuSmpArgs() {
    if (process.platform === 'win32') return ['-smp', 'cores=4,threads=1'];
    return ['-smp', '4'];
}

export function getQemuRtcArgs() {
    if (process.platform === 'win32') {
        return ['-rtc', 'base=localtime,clock=vm'];
    }
    return [];
}

export function getQemuVgaDeviceArgs() {
    if (process.platform === 'win32') {
        return ['-vga', 'none', '-device', 'virtio-vga'];
    }
    return ['-vga', 'virtio'];
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
        const id = 'vmdisk0';
        const dev = boot ? `virtio-blk-pci,drive=${id},bootindex=1` : `virtio-blk-pci,drive=${id}`;
        return [
            '-drive', `file=${filePath},format=qcow2,if=none,id=${id},cache=writeback,aio=threads`,
            '-device', dev,
        ];
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

/** Win32: explicit OVMF pflash + nvram copy. Linux/mac: QEMU loads firmware for q35 automatically. */
export async function getQemuUefiInstallExtras({ binDir, qemuWorkDir, isoPath, virtioPath, answerIsoPath, qcow2Name }) {
    const cdrom = [...getQemuInstallCdromArgs(isoPath, virtioPath, answerIsoPath), '-boot', 'once=d'];
    if (process.platform !== 'win32') {
        return cdrom;
    }
    const { code, varsTemplate } = resolveSystemQemuFirmwarePaths(binDir);
    const nvramName = getQemuNvramVarsFilename(qcow2Name || 'win11.qcow2');
    const nvram = await ensureWritableNvramVars(qemuWorkDir, varsTemplate, nvramName);
    return [...getQemuUefiPflashArgs(code, nvram), ...cdrom];
}

/** Win32 only: manual pflash. Linux/mac: auto OVMF for q35; boot via -boot order=c in qemuService. */
export async function getQemuUefiRuntimeExtras({ binDir, qemuWorkDir, qcow2Name }) {
    if (process.platform !== 'win32') {
        return [];
    }
    const { code, varsTemplate } = resolveSystemQemuFirmwarePaths(binDir);
    const nvramName = getQemuNvramVarsFilename(qcow2Name);
    const nvram = await ensureWritableNvramVars(qemuWorkDir, varsTemplate, nvramName);
    return getQemuUefiPflashArgs(code, nvram);
}

/** Legacy BIOS -boot order=c conflicts with UEFI bootindex on Win32. */
export function getQemuLegacyBootOrderArgs() {
    if (process.platform === 'win32') {
        return [];
    }
    return ['-boot', 'order=c'];
}
