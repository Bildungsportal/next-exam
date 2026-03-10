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

import childProcess from 'child_process';
import { clipboard, globalShortcut } from 'electron';
import config from '../config.js';
import log from 'electron-log';
import { SchedulerService } from './schedulerservice.ts';
import platformDispatcher from './platformDispatcher.js';
import { enableLinuxRestrictions, disableLinuxRestrictions } from './restrictions/lin.js';
import { enableWindowsRestrictions, disableWindowsRestrictions } from './restrictions/win.js';
import { enableMacRestrictions, disableMacRestrictions, toggleMacOSLockdown as toggleMacOSLockdownImpl } from './restrictions/mac.js';

let clipboardInterval;
let configStore = {
    linux: {},
    windows: {},
    macos: {}
};

// list of apps we do not want to run in background
const appsToClose = [
    'Grammarly',
    'GeoGebra',
    'whatsapp',
    'Google Chrome',
    'chrome',
    'google-chrome',
    'Microsoft Edge',
    'msedge',
    'firefox',
    'safari',
    'brave',
    'opera',
    'chatgpt',
    'ChatGPT',
    'NortonSecurity',
    'NAV',
    'Teams',
    'ms-teams',
    'zoom.us',
    'Microsoft Teams',
    'discord',
    'zoom',
    'teams',
    'teamviewer',
    'skypeforlinux',
    'skype',
    'anydesk',
    'claude'
];

async function enableRestrictions(winhandler) {
    if (config.development) { return; }

    log.info("platformrestrictions @ enableRestrictions: enabling platform restrictions");

    globalShortcut.register('CommandOrControl+V', () => { console.log('no clipboard'); });
    globalShortcut.register('CommandOrControl+Shift+V', () => { console.log('no clipboard'); });
    globalShortcut.register('CommandOrControl+X', () => { console.log('no clipboard'); });
    globalShortcut.register('CommandOrControl+C', () => { console.log('no clipboard'); });

    clipboard.clear();
    clipboardInterval = new SchedulerService(() => { clipboard.clear(); }, 1000);
    clipboardInterval.start();

    if (platformDispatcher.platform === 'linux') {
        enableLinuxRestrictions(configStore, appsToClose);
    }

    if (platformDispatcher.platform === 'win32') {
        await enableWindowsRestrictions(winhandler, appsToClose);
    }

    if (platformDispatcher.platform === 'darwin') {
        await enableMacRestrictions(winhandler, appsToClose);
    }
}

function disableRestrictions() {
    if (config.development) { return; }
    log.info("platformrestrictions @ disableRestrictions: removing restrictions...");

    if (clipboardInterval) {
        clipboardInterval.stop();
    }

    globalShortcut.unregister('CommandOrControl+V', () => { console.log('activate clipboard'); });
    globalShortcut.unregister('CommandOrControl+Shift+V', () => { console.log('activate clipboard'); });
    globalShortcut.unregister('CommandOrControl+C', () => { console.log('activate clipboard'); });
    globalShortcut.unregister('CommandOrControl+X', () => { console.log('activate clipboard'); });

    if (platformDispatcher.platform === 'linux') {
        disableLinuxRestrictions(configStore);
    }

    if (platformDispatcher.platform === 'win32') {
        disableWindowsRestrictions();
    }

    if (platformDispatcher.platform === 'darwin') {
        disableMacRestrictions();
    }
}

function toggleMacOSLockdown(enable) {
    toggleMacOSLockdownImpl(enable);
}

export { enableRestrictions, disableRestrictions, toggleMacOSLockdown };
