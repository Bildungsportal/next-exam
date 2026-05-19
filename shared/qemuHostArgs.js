/** Platform QEMU -accel argv (linux kvm, windows whpx, mac hvf). */
export function getQemuAccelArgs() {
    if (process.platform === 'linux') return ['-enable-kvm'];
    if (process.platform === 'win32') return ['-accel', 'whpx'];
    if (process.platform === 'darwin') return ['-accel', 'hvf'];
    return [];
}

/** -cpu model; Windows WHPX must not expose VMX (host,-vmx) or VP exit code 4. */
export function getQemuCpuArg() {
    if (process.platform === 'win32') {
        return 'host,-vmx,hv_relaxed,hv_spinlocks=0x1fff,hv_vapic,hv_time';
    }
    return 'host,hv_relaxed,hv_spinlocks=0x1fff,hv_vapic,hv_time';
}
