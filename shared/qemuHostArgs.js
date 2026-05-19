import fs from 'fs';
import os from 'os';
import path from 'path';

const GIB = 1024 * 1024 * 1024;
const VM_RAM_MB_HIGH = 8192;
const VM_RAM_MB_LOW = 4096;

const HV_GUEST = 'hv_relaxed,hv_spinlocks=0x1fff,hv_vapic,hv_time';

/** WHPX UEFI ISO boot (verified on Win11 IoT); no hv_* / no max|host (VP exit 4 on APX hosts). */
export const WIN32_CPU_UEFI_BOOT = 'Skylake-Client,vendor=GenuineIntel,+nx,+popcnt';

/** Running Windows guest in VM after install. */
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

/** Guest RAM (MiB): 8192 only if host has >8 GiB installed; else 4096; capped ~45% of host. */
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

/** linux kvm | win whpx | mac hvf; runtime adds kernel-irqchip=off on win when needed. */
export function getQemuAccelArgs({ runtime = false } = {}) {
    if (process.platform === 'linux') return ['-enable-kvm'];
    if (process.platform === 'win32') {
        if (runtime) return ['-accel', 'whpx,kernel-irqchip=off'];
        return ['-accel', 'whpx'];
    }
    if (process.platform === 'darwin') return ['-accel', 'hvf'];
    return [];
}

export function getQemuMachineArgs() {
    return ['-machine', 'q35'];
}

/** UEFI firmware for Win11 install/boot (OVMF next to system QEMU: <binDir>/../share). */
export function resolveBundledUefiFirmwarePaths(binDir) {
    const share = path.join(binDir, '..', 'share');
    return {
        code: path.join(share, 'edk2-x86_64-code.fd'),
        varsTemplate: path.join(share, 'edk2-i386-vars.fd'),
    };
}

/** Writable NVRAM copy under workdir/QEMU (required; do not write into share/). */
export async function ensureWritableNvramVars(qemuWorkDir, varsTemplatePath) {
    await fs.promises.mkdir(qemuWorkDir, { recursive: true });
    const dest = path.join(qemuWorkDir, 'nvram.vars');
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

/**
 * @param {'uefi-install'|'runtime'} profile
 */
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

/** WHPX: explicit topology; other platforms keep legacy -smp 4. */
export function getQemuSmpArgs() {
    if (process.platform === 'win32') {
        return ['-smp', 'cores=4,threads=1'];
    }
    return ['-smp', '4'];
}

/** Guest RTC aligned with host (Windows exam VMs). */
export function getQemuRtcArgs() {
    if (process.platform === 'win32') {
        return ['-rtc', 'base=localtime,clock=vm'];
    }
    return [];
}

/** Win32 UEFI: virtio-vga device; runtime/linux/mac: -vga virtio. */
export function getQemuVgaDeviceArgs({ profile = 'runtime' } = {}) {
    if (process.platform === 'win32') {
        return ['-vga', 'none', '-device', 'virtio-vga'];
    }
    return ['-vga', 'virtio'];
}

export function getQemuUsbTabletArgs({ profile = 'runtime' } = {}) {
    if (profile === 'runtime') {
        return ['-device', 'qemu-xhci', '-device', 'usb-tablet'];
    }
    return ['-device', 'usb-ehci,id=usb', '-device', 'usb-tablet'];
}

export function getQemuTeacherDisplayArgs() {
    if (process.platform === 'darwin') return ['-display', 'cocoa'];
    if (process.platform === 'win32') return ['-display', 'gtk'];
    return ['-display', 'gtk'];
}

export function getQemuVirtioDiskDriveArg(filePath) {
    if (process.platform === 'win32') {
        return ['-drive', `file=${filePath},if=virtio,cache=writeback,aio=threads`];
    }
    return ['-drive', `file=${filePath},if=virtio`];
}

/** Win32 UEFI install: pflash + cdroms + boot once from DVD. */
export async function getQemuWinUefiInstallExtras({ binDir, qemuWorkDir, isoPath, virtioPath, answerIsoPath }) {
    if (process.platform !== 'win32') return [];
    const { code, varsTemplate } = resolveBundledUefiFirmwarePaths(binDir);
    const nvram = await ensureWritableNvramVars(qemuWorkDir, varsTemplate);
    return [
        ...getQemuUefiPflashArgs(code, nvram),
        ...getQemuInstallCdromArgs(isoPath, virtioPath, answerIsoPath),
        '-boot', 'once=d',
    ];
}

/** Win32 UEFI boot of installed qcow2. */
export async function getQemuWinUefiRuntimeExtras({ binDir, qemuWorkDir }) {
    if (process.platform !== 'win32') return [];
    const { code, varsTemplate } = resolveBundledUefiFirmwarePaths(binDir);
    const nvram = await ensureWritableNvramVars(qemuWorkDir, varsTemplate);
    return getQemuUefiPflashArgs(code, nvram);
}
