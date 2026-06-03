import { buildQemuMissingWarningHtml } from './qemuMissingWarningHtml.js';

export const QEMU_IPC = {
    CHECK_AVAILABLE: 'qemu-check-available',
    OPEN_INSTALL_PAGE: 'qemu-open-install-page',
    REQUEST_ENABLE_HYPERVISOR: 'qemu-request-enable-hypervisor-platform',
};

/** True when qemu-check-available blocked on missing HypervisorPlatform. */
export function isHypervisorPlatformMissing(check) {
    return Array.isArray(check?.missing) && check.missing.includes('HypervisorPlatform');
}

/** True when qemu failed because CPU virtualization (VT-x/AMD-V) is disabled in BIOS/UEFI. */
export function isVirtualizationDisabled(check) {
    return check?.reason === 'virt-disabled';
}

/** Swal: CPU virtualization disabled in BIOS/UEFI -> info dialog, no action button. */
export async function showVirtualizationDisabledDialog({ swal, t, i18nPrefix, cancelKey = 'cancel' }) {
    const p = (key) => t(`${i18nPrefix}.${key}`);
    await swal.fire({
        icon: 'warning',
        title: p('qemuVirtDisabledTitle'),
        html: buildQemuMissingWarningHtml(p('qemuVirtDisabledText')),
        confirmButtonText: p(cancelKey),
    });
}

/** Swal: system QEMU missing → open download page. */
export async function showQemuMissingDialog({ swal, t, invoke, i18nPrefix, check = {} }) {
    const p = (key) => t(`${i18nPrefix}.${key}`);
    const result = await swal.fire({
        icon: 'warning',
        title: p('qemuMissingTitle'),
        html: buildQemuMissingWarningHtml(p('qemuMissingText'), {
            installHint: check.installHint,
            downloadUrl: check.downloadUrl,
        }),
        showCancelButton: true,
        confirmButtonText: p('qemuMissingOpenDownload'),
        cancelButtonText: p('qemuMissingConfirm'),
    });
    if (result.isConfirmed) {
        try {
            await invoke(QEMU_IPC.OPEN_INSTALL_PAGE);
        } catch (e) {
            console.error('qemuLocalVmDialogs @ showQemuMissingDialog', e);
        }
    }
}

/** Swal: Windows Hypervisor Platform off → elevated enable offer + PowerShell hint in i18n text. */
export async function showHypervisorPlatformDialog({
    swal,
    t,
    invoke,
    i18nPrefix,
    cancelKey = 'cancel',
}) {
    const p = (key) => t(`${i18nPrefix}.${key}`);
    const result = await swal.fire({
        icon: 'warning',
        title: p('qemuHypervisorTitle'),
        html: buildQemuMissingWarningHtml(p('qemuHypervisorText')),
        showCancelButton: true,
        confirmButtonText: p('qemuHypervisorEnable'),
        cancelButtonText: p(cancelKey),
    });
    if (result.isConfirmed) {
        try {
            await invoke(QEMU_IPC.REQUEST_ENABLE_HYPERVISOR);
        } catch (e) {
            console.error('qemuLocalVmDialogs @ showHypervisorPlatformDialog', e);
        }
    }
}

/** Probe via IPC; show dialog and return false when LocalVM cannot run. */
export async function ensureQemuAvailableForLocalVmUi({
    swal,
    t,
    invoke,
    i18nPrefix,
    cancelKey = 'cancel',
}) {
    let check;
    try {
        check = await invoke(QEMU_IPC.CHECK_AVAILABLE, { deep: false });
    } catch (e) {
        console.error('qemuLocalVmDialogs @ ensureQemuAvailableForLocalVmUi', e);
        await showQemuMissingDialog({ swal, t, invoke, i18nPrefix, check: {} });
        return false;
    }
    if (check?.ok) {
        return true;
    }
    if (isHypervisorPlatformMissing(check)) {
        await showHypervisorPlatformDialog({ swal, t, invoke, i18nPrefix, cancelKey });
    } else {
        await showQemuMissingDialog({ swal, t, invoke, i18nPrefix, check: check || {} });
    }
    return false;
}

/** Route qemu-not-available / check payload to the right dialog. */
export async function showLocalVmQemuIssueDialog({
    swal,
    t,
    invoke,
    i18nPrefix,
    check = {},
    cancelKey = 'cancel',
}) {
    if (isVirtualizationDisabled(check)) {
        await showVirtualizationDisabledDialog({ swal, t, i18nPrefix, cancelKey });
        return;
    }
    if (isHypervisorPlatformMissing(check)) {
        await showHypervisorPlatformDialog({ swal, t, invoke, i18nPrefix, cancelKey });
        return;
    }
    await showQemuMissingDialog({ swal, t, invoke, i18nPrefix, check });
}
