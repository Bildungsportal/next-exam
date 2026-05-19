import { QEMU_GUEST_VGA } from './qemuAvailability.js';

/** Platform QEMU -accel argv (linux kvm, windows whpx, mac hvf). */
export function getQemuAccelArgs() {
    if (process.platform === 'linux') return ['-enable-kvm'];
    if (process.platform === 'win32') {
        // kernel-irqchip=off: WHPX on Win10/11 + legacy PIC (see QEMU docs/system/whpx.rst)
        return ['-accel', 'whpx,kernel-irqchip=off'];
    }
    if (process.platform === 'darwin') return ['-accel', 'hvf'];
    return [];
}

/**
 * -cpu for LocalVM. WHPX must not use host (VMX/APX/MPX → VP exit 4 / feature conflicts).
 * max,vmx=off + Hyper-V guest hints for Windows guests.
 */
export function getQemuCpuArg() {
    if (process.platform === 'win32') {
        return 'max,vmx=off,hv_relaxed,hv_spinlocks=0x1fff,hv_vapic,hv_time';
    }
    return 'host,hv_relaxed,hv_spinlocks=0x1fff,hv_vapic,hv_time';
}

/** Guest VGA; WHPX + virtio-vga often fails until vCPU runs — std is reliable for teacher preview on Windows. */
export function getQemuGuestVga() {
    if (process.platform === 'win32') return 'std';
    return QEMU_GUEST_VGA;
}

/** Teacher interactive window (not used on student headless+VNC). */
export function getQemuTeacherDisplayArgs() {
    if (process.platform === 'darwin') return ['-display', 'cocoa'];
    if (process.platform === 'win32') return ['-display', 'sdl'];
    return ['-display', 'gtk'];
}

/** Virtio system disk; WHPX + aio=native is a poor match on Windows hosts. */
export function getQemuVirtioDiskDriveArg(filePath) {
    if (process.platform === 'win32') {
        return ['-drive', `file=${filePath},if=virtio,cache=writeback,aio=threads`];
    }
    return ['-drive', `file=${filePath},if=virtio`];
}
