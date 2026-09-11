import { getQemuInstallInfo, QEMU_DOWNLOAD_URL } from './qemuInstallInfo.js';

export { QEMU_DOWNLOAD_URL } from './qemuInstallInfo.js';

/** Swal html: message + install hint + download link. */
export function buildQemuMissingWarningHtml(message, options = {}) {
    const text = String(message || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
    const info = options.installHint != null
        ? { installHint: options.installHint, downloadUrl: options.downloadUrl || QEMU_DOWNLOAD_URL }
        : getQemuInstallInfo(options.platform);
    const hint = String(info.installHint || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/\n/g, '<br>');
    const url = String(info.downloadUrl || QEMU_DOWNLOAD_URL)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
    return `<p style="text-align:left;">${text}</p>`
        + `<p style="margin-top:12px;text-align:left;font-size:0.95em;">${hint}</p>`
        + `<p style="margin-top:12px;text-align:left;"><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`;
}
