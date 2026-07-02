/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>
 */

// Windows Assigned Access: load allowed .exe shortcuts for the exam header launcher bar via IPC.
// filterKioskLauncherButtons drops Next-Exam-Student so the kiosk session cannot relaunch itself.

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

/** Win Assigned Access session — reads C:\\NextExam\\kiosk-launcher-apps.json via IPC. */
export async function loadWinKioskLauncherApps(signalBridge) {
    if (!isElectronWindow(window)) return [];
    const k = await getLinuxKioskInfo(signalBridge);
    if (!k.runningInCage || k.displayServer !== 'windows') return [];
    return filterKioskLauncherButtons(await signalBridge.invoke('get-kiosk-launcher-apps') || []);
}
