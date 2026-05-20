/** Platform install hints + download URLs for LocalVM (renderer + main). */

export const QEMU_DOWNLOAD_URL = 'https://www.qemu.org/download/';

/** @param {string} [platform] process.platform */
export function getQemuInstallInfo(platform = process.platform) {
    if (platform === 'win32') {
        return {
            downloadUrl: 'https://qemu.weilnetz.de/w64/',
            installHint:
                'Windows-Installer (z. B. qemu-w64-setup).\n\nAlternativ: winget install SoftwareFreedomConservancy.QEMU',
            searchNote: 'Programme, PATH und typische Installationsordner',
        };
    }
    if (platform === 'linux') {
        return {
            downloadUrl: QEMU_DOWNLOAD_URL,
            installHint:
                'Debian/Ubuntu: sudo apt install qemu-system-x86 qemu-utils\nFedora: sudo dnf install qemu-system-x86 qemu-img',
            searchNote: '/usr/bin, PATH',
        };
    }
    if (platform === 'darwin') {
        return {
            downloadUrl: QEMU_DOWNLOAD_URL,
            installHint: 'Homebrew: brew install qemu',
            searchNote: '/opt/homebrew/bin, /usr/local/bin, PATH',
        };
    }
    return {
        downloadUrl: QEMU_DOWNLOAD_URL,
        installHint: 'Install qemu-system-x86_64 and qemu-img for your OS.',
        searchNote: 'PATH',
    };
}
