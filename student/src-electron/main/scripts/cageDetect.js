import { execSync } from 'child_process';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

export const CAGE_KIOSK_APPIMAGE = '/opt/next-exam/next-exam.AppImage';
export const CAGE_KIOSK_DESKTOP = '/usr/share/applications/next-exam-kiosk.desktop';

/** Returns true when the cage binary is on PATH. */
export function detectCageInstalled() {
    if (process.platform !== 'linux') return false;
    try {
        execSync('command -v cage', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        return true;
    } catch {
        return false;
    }
}

/** Walks the parent process chain for a comm name of cage. */
export function detectRunningInCage(maxDepth = 12) {
    if (process.platform !== 'linux') return false;
    let pid = process.ppid;
    const visited = new Set();
    while (pid > 1 && maxDepth-- > 0) {
        if (visited.has(pid)) return false;
        visited.add(pid);
        const info = getProcessInfoSync(pid);
        if (!info) return false;
        if (info.name === 'cage') return true;
        pid = info.ppid;
    }
    return false;
}

/** True when the kiosk AppImage was installed under /opt/next-exam. */
export function detectCageKioskAppImageInstalled() {
    return existsSync(CAGE_KIOSK_APPIMAGE);
}

/** True when the kiosk .desktop entry exists. */
export function detectCageKioskDesktopInstalled() {
    return existsSync(CAGE_KIOSK_DESKTOP);
}

/** AppImage squashfs is noexec; copy bundled script to a runnable temp path. */
export function resolveRunnableCageKioskInstallScript(bundledPath) {
    if (!existsSync(bundledPath)) return null;
    if (!process.env.APPIMAGE) return bundledPath;
    const dir = mkdtempSync(path.join(os.tmpdir(), 'next-exam-cage-install-'));
    const runnable = path.join(dir, 'install-cage-kiosk.sh');
    copyFileSync(bundledPath, runnable);
    chmodSync(runnable, 0o755);
    return runnable;
}

/** Show install UI while cage, AppImage, or kiosk desktop entry is still missing. */
export function needsCageKioskSetup() {
    if (process.platform !== 'linux') return false;
    return !detectCageInstalled() || !detectCageKioskAppImageInstalled() || !detectCageKioskDesktopInstalled();
}

/** Startup log lines for Linux Cage kiosk detection (electron-main platform block). */
export function getLinuxCageDetectionLogLines() {
    if (process.platform !== 'linux') return [];
    return [
        `main: Linux Cage kiosk: runningInCage=${detectRunningInCage()}`,
        `main: Linux Cage check: cageInstalled=${detectCageInstalled()} appImage=${detectCageKioskAppImageInstalled()} desktopEntry=${detectCageKioskDesktopInstalled()}`
    ];
}

function getProcessInfoSync(pid) {
    try {
        const statContent = readFileSync(`/proc/${pid}/stat`, 'utf8');
        const statMatch = statContent.match(/^\d+\s+\(([^)]+)\)\s+\S+\s+(\d+)/);
        if (!statMatch) return null;
        let name = statMatch[1].trim().toLowerCase();
        try {
            name = readFileSync(`/proc/${pid}/comm`, 'utf8').trim().toLowerCase();
        } catch {
            // use stat comm
        }
        const ppid = parseInt(statMatch[2], 10);
        if (Number.isNaN(ppid)) return null;
        return { ppid, name };
    } catch {
        return null;
    }
}
