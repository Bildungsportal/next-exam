/** Renderer-safe (no Node builtins). Main-process check lives in qemuAvailability.js. */
export const QEMU_DOWNLOAD_URL = 'https://www.qemu.org/download/';

/** Swal html: message + link to official QEMU download page. */
export function buildQemuMissingWarningHtml(message) {
    const text = String(message || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
    return `<p style="text-align:left;">${text}</p><p style="margin-top:12px;text-align:left;"><a href="${QEMU_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer">${QEMU_DOWNLOAD_URL}</a></p>`;
}
