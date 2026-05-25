import { isElectronWindow } from '../types/platform.ts';
import { getLinuxKioskInfo } from './linuxCageKiosk.js';

/** UI buttons: .exe paths only, no Next-Exam-Student entry. */
export function filterKioskLauncherButtons(apps) {
    return (apps || []).filter((a) => {
        const p = String(a?.path || '').trim();
        if (!p || !/\.exe$/i.test(p)) return false;
        return !/next-exam-student/i.test(a.name || '') && !/next-exam-student\.exe$/i.test(p);
    });
}

/** Win Assigned Access session only — reads C:\\NextExam\\kiosk-launcher-apps.json via IPC. */
export async function loadWinKioskLauncherApps(signalBridge) {
    if (!isElectronWindow(window)) return [];
    const k = await getLinuxKioskInfo(signalBridge);
    if (!k.runningInCage || k.displayServer !== 'windows') return [];
    return filterKioskLauncherButtons(await signalBridge.invoke('get-kiosk-launcher-apps') || []);
}
