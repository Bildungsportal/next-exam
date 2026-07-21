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


/**
 * most of the keyboard restrictions could be handled by "iohook" for all platforms
 * unfortunalety it's not yet released for node v16.x and electron v16.x  (also it's "big sur" intel only on macs)
 * https://wilix-team.github.io/iohook/installation.html
 *
 * "node-global-key-listener" would be another solution for windows and macos (although it requires "accessability" permissions on mac)
 * but for now it seems the module can not run in a final electron build
 * https://github.com/LaunchMenu/node-global-key-listener/issues/18
 *
 * hardcoding the keyboardshortcuts we want to capture into iohook(or n-g-k-l) and manually compiling it for mac and windows could be done - (but not until i get paid for this amount of work ;-)
 */


/**
 * the next best solution i came up with is to kill all of the shells - starting with explorer.exe because its absolutely impossible to
 * deactivate this nasty "windows" button or 3FingerSlideUp Gesture in windows 11 - you could edit the registry and reboot but thats obviously not what we want
 */

import {clipboard, globalShortcut} from 'electron';
import config from '../../../src/utils/config.js';
import log from 'electron-log';
import {SchedulerService} from './schedulerservice.ts';
import platformDispatcher from './platformDispatcher.js';
import {disableLinuxRestrictions, enableLinuxRestrictions, killLinuxAppsToClose} from './restrictions/lin.js';
import {
    disableWindowsRestrictions,
    enableWindowsRestrictions,
    killWindowsAppsToClose,
    killWindowsExplorer
} from './restrictions/win.js';
import {clearMacClipboard, killMacAppsToClose} from './restrictions/mac.js';
import {updateRemoteAssistant} from './remoteAssistantScan.js';
import {isElectronWindow, isIOS} from "../../../src/types/platform.ts";
import {stopAssessmentSession} from './assessmentSession.js';
import {appsToClose} from './appsToClose.js';

let clipboardInterval;
let configStore = {
    linux: {},
    windows: {},
    macos: {}
};

/** Kill appsToClose on the current platform (default list). Safe to call without full enableRestrictions. */
export async function killAppsToClose(apps = appsToClose, clientinfo) {
    if (config.development) return;
    log.info('platformrestrictions @ killAppsToClose: killing appsToClose list');
    const p = platformDispatcher.platform;
    if (p === 'win32') await killWindowsAppsToClose(apps);
    else if (p === 'darwin') await killMacAppsToClose(apps);
    else if (p === 'linux') await killLinuxAppsToClose(apps);
    if (clientinfo) {
        await updateRemoteAssistant(clientinfo, { logTag: 'platformrestrictions' });
    }
}

/** Win AA kiosk: kill appsToClose only (no explorer, shortcuts, or clipboard hooks). */
export async function killWinKioskExamApps(clientinfo) {
    if (config.development) return;
    if (platformDispatcher.platform !== 'win32' || !platformDispatcher.skipElectronKiosk) return;
    log.info('platformrestrictions @ killWinKioskExamApps: killing appsToClose in Assigned Access session');
    await killAppsToClose(appsToClose, clientinfo);
}

export async function enableRestrictions(winhandler) {
    if (config.development) { return; }

    log.info("platformrestrictions @ enableRestrictions: enabling platform restrictions");

    const clientinfo = winhandler?.multicastClient?.clientinfo;
    if (platformDispatcher.platform === 'win32') {
        killWindowsExplorer();
    }
    await killAppsToClose(appsToClose, clientinfo);

    globalShortcut.register('CommandOrControl+V', () => { console.log('no clipboard'); });
    globalShortcut.register('CommandOrControl+Shift+V', () => { console.log('no clipboard'); });
    globalShortcut.register('CommandOrControl+X', () => { console.log('no clipboard'); });
    globalShortcut.register('CommandOrControl+C', () => { console.log('no clipboard'); });

    clipboard.clear();
    clipboardInterval = new SchedulerService(() => { clipboard.clear(); }, 1000);
    clipboardInterval.start();

    if (platformDispatcher.platform === 'linux') {
        enableLinuxRestrictions(configStore);
    }

    if (platformDispatcher.platform === 'win32') {
        await enableWindowsRestrictions();
    }

    if (platformDispatcher.platform === 'darwin') {
        clearMacClipboard();
    }
}

export async function disableRestrictions() {
    if (platformDispatcher.platform === 'darwin') {
        await stopAssessmentSession();
    }
    if (config.development) { return; }
    log.info("platformrestrictions @ disableRestrictions: removing restrictions...");

    if (clipboardInterval) {
        clipboardInterval.stop();
    }
    if (isElectronWindow(window)) {
        globalShortcut.unregister('CommandOrControl+V', () => {
            console.log('activate clipboard');
        });
        globalShortcut.unregister('CommandOrControl+Shift+V', () => {
            console.log('activate clipboard');
        });
        globalShortcut.unregister('CommandOrControl+C', () => {
            console.log('activate clipboard');
        });
        globalShortcut.unregister('CommandOrControl+X', () => {
            console.log('activate clipboard');
        });
    }
    if (platformDispatcher.platform === 'linux') {
        disableLinuxRestrictions(configStore);
    }

    if (platformDispatcher.platform === 'win32') {
        disableWindowsRestrictions();
    }

    if (isIOS(window)) {
        disableIOSRestrictions();
    }
}
