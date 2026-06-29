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
import { enableWindowsRestrictions, disableWindowsRestrictions, killWindowsAppsToClose } from './restrictions/win.js';
import { enableMacRestrictions, disableMacRestrictions, toggleMacOSLockdown as toggleMacOSLockdownImpl } from './restrictions/mac.js';
import { stopAssessmentSession } from './assessmentSession.js';

let clipboardInterval;
let configStore = {
    linux: {},
    windows: {},
    macos: {}
};

// Single source of truth for "apps that should not run during an exam".
// Used by (1) platformrestrictions for killing (pgrep/pkill/Get-Process) and
// (2) remotecheck/* for detection+reporting to the teacher when killing fails (no root).
// Matching on all consumers is case-insensitive substring on process name/cmdline,
// EXCEPT macOS pkill -f which is case-sensitive -> TitleCase duplicates are intentional.
// Sorted alphabetically (case-insensitive).
export const appsToClose = [
    'anydesk',
    'brave',
    'ChatGPT',
    'chatgpt',
    'chrome',
    'chrome-remote-desktop',
    'chromeremotedesktop',
    'chromium',
    'claude',
    'Claude',

    'discord',
    'Discord',
    'dropbox',
    'Dropbox',
    'dwagent',
    'DWAgent',
    'element-desktop',
    'Element',
    'firefox',
    'Firefox',
    'g2comm',
    'GeoGebra',
    'google-chrome',
    'Google Chrome',
    'gpt4all',
    'Grammarly',
    'librewolf',
    'lmstudio',
    'LM Studio',
    'logmein',
    'LogMeIn',
    'megasync',
    'MEGAsync',
    'Microsoft Edge',
    'Microsoft Teams',
    'ms-teams',
    'ms-teams_modulehost',
    'ms-teamsupdate',
    'msteams',
    'msteams_autostarter',
    'msedge',
    'mstsc',
    'NAV',
    'nextcloud',
    'Nextcloud',
    'nomachine',
    'NoMachine',
    'NortonSecurity',
    'ollama',
    'Ollama',
    'onedrive',
    'OneDrive',
    'opera',
    'parallels',
    'Parallels',
    'parsec',
    'Parsec',
    'pcvisit',
    'perplexity',
    'Perplexity',
    'realvnc',
    'RealVNC',
    'remoteutilities',
    'rustdesk',
    'RustDesk',
    'safari',
    'screenconnect',
    'ScreenConnect',
    'signal-desktop',
    'Signal',
    'skype',
    'skypeforlinux',
    'Skype',
    'slack',
    'Slack',
    'splashtop',
    'Splashtop',
    'steam',
    'Steam',
    'steamwebhelper',
    'SteamWebHelper',
    'support 15',
    'syncthing',
    'Teams',
    'teams',
    'teamviewer',
    'TeamViewer',
    'telegram-desktop',
    'Telegram',
    'tigervnc',
    'tor-browser',
    'Tor Browser',
    'viber',
    'Viber',
    'vivaldi',
    'Vivaldi',
    'vncviewer',
    'waterfox',
    'webex',
    'Webex',
    'whatsapp',
    'WhatsApp',
    'windsurf',
    'Windsurf',
    'zoho',
    'Zoho',
    'zoom',
    'zoom.us',
    'Zoom'
];






/** Win AA kiosk: kill appsToClose only (no explorer, shortcuts, or clipboard hooks). */
export async function killWinKioskExamApps() {
    if (config.development) return;
    if (platformDispatcher.platform !== 'win32' || !platformDispatcher.skipElectronKiosk) return;
    log.info('platformrestrictions @ killWinKioskExamApps: killing appsToClose in Assigned Access session');
    await killWindowsAppsToClose(appsToClose);
}

export async function enableRestrictions(winhandler) {
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

export async function disableRestrictions() {
    if (platformDispatcher.platform === 'darwin') {
        await stopAssessmentSession();
    }
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

export {  toggleMacOSLockdown };
