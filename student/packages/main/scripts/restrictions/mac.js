/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * macOS-specific platform restrictions (enable/disable, toggleMacOSLockdown).
 */

import { join } from 'path';
import childProcess from 'child_process';
import { spawn } from 'child_process';
import { TouchBar, systemPreferences, powerMonitor } from 'electron';
import log from 'electron-log';
import platformDispatcher from '../platformDispatcher.js';

// stored refs for cleanup when disabling macOS restrictions
let workspaceNotificationId = null;
let logStreamProcess = null;
let currentWinhandler = null;

/** Single handler for all macOS restriction signals: log and re-focus exam window / inform teacher. */
function onMacRestrictionSignal(signalName) {
    log.info(`platformrestrictions @ mac: ${signalName} detected`);
    if (!currentWinhandler?.examwindow?.isDestroyed?.()) {
        if (currentWinhandler.multicastClient?.clientinfo) currentWinhandler.multicastClient.clientinfo.focus = false; // inform the teacher
        currentWinhandler.examwindow.moveTop();
        currentWinhandler.examwindow.setKiosk(true);
        currentWinhandler.examwindow.show();
        currentWinhandler.examwindow.focus();
        toggleMacOSLockdown(true) 
    }
}

const lockScreenHandler = () => onMacRestrictionSignal('lock-screen');
const unlockScreenHandler = () => onMacRestrictionSignal('unlock-screen');

/**
 * Enable macOS-specific restrictions (TouchBar, clipboard, close apps, workspace/lock monitoring).
 * @param {object} winhandler - must have winhandler.examwindow
 * @param {string[]} appsToClose - app names to kill
 */
export async function enableMacRestrictions(winhandler, appsToClose) {
    const { TouchBarLabel, TouchBarSpacer } = TouchBar;
    const textlabel = new TouchBarLabel({ label: "Next-Exam" });
    const touchBar = new TouchBar({
        items: [
            new TouchBarSpacer({ size: 'flexible' }),
            textlabel,
            new TouchBarSpacer({ size: 'flexible' }),
        ]
    });
    winhandler.examwindow?.setTouchBar(touchBar);
    currentWinhandler = winhandler;

    childProcess.exec('pbcopy < /dev/null');

    const killPromises = appsToClose.map(app => new Promise((resolve) => {
        childProcess.exec(`pkill -9 -f "${app}"`, () => {
            resolve();
        });
    }));

    await Promise.all(killPromises);


    // workspace/space switch and lock/unlock monitoring (macOS only)
    try {
        workspaceNotificationId = systemPreferences.subscribeWorkspaceNotification('NSWorkspaceActiveSpaceDidChangeNotification', () => onMacRestrictionSignal('desktop/space switch'));
    } catch (err) { log.error('platformrestrictions @ mac: subscribeWorkspaceNotification', err); }

    powerMonitor.on('lock-screen', lockScreenHandler);
    powerMonitor.on('unlock-screen', unlockScreenHandler);

    logStreamProcess = spawn('log', ['stream', '--predicate', 'subsystem == "com.apple.dock" AND category == "missioncontrol"']);
    logStreamProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('mode')) onMacRestrictionSignal('Mission Control');
    });
}

/**
 * Disable macOS-specific restrictions (touchbar, monitoring listeners and log process).
 */
export function disableMacRestrictions() {
    currentWinhandler = null;
    if (workspaceNotificationId != null) {
        try { systemPreferences.unsubscribeWorkspaceNotification(workspaceNotificationId); } catch (err) { log.error('platformrestrictions @ mac: unsubscribeWorkspaceNotification', err); }
        workspaceNotificationId = null;
        log.info('platformrestrictions @ mac: workspaceNotificationId disabled');
    }
    powerMonitor.off('lock-screen', lockScreenHandler);
    powerMonitor.off('unlock-screen', unlockScreenHandler);
    if (logStreamProcess) {
        logStreamProcess.kill();
        logStreamProcess = null;
        log.info('platformrestrictions @ mac: logStreamProcess disabled');
    }
}

/**
 * Disables/enables mission control, spaces and trackpad gestures.
 * @param {boolean} enable - true restores everything, false locks everything
 */
export function toggleMacOSLockdown(enable) {
    if (platformDispatcher.platform !== 'darwin') return;
    log.info(`platformrestrictions @ toggleMacOSLockdown: ${enable ? 'enable' : 'disable'} mission control lockdown`);

    const mcIds = [32, 33, 34, 35, 79, 80, 81, 82, 118, 119, 120, 121];
    const plistPath = join(platformDispatcher.homedirectory, 'Library/Preferences/com.apple.symbolichotkeys.plist');
    const backupPath = join(platformDispatcher.tempdirectory, 'next_exam_hotkeys_backup.plist');

    if (enable) {
        const hotkeyCommands = mcIds.map(id =>
            `defaults write com.apple.symbolichotkeys AppleSymbolicHotKeys -dict-add ${id} "<dict><key>enabled</key><false/></dict>"`
        ).join('; ');

        const gestureCommands = [
            `defaults write com.apple.dock showMissionControlGestureEnabled -bool false`,
            `defaults write com.apple.dock showAppExposeGestureEnabled -bool false`,
            `defaults write com.apple.dock showDesktopGestureEnabled -bool false`,
            `defaults write NSGlobalDomain AppleEnableSwipeNavigateWithScrolls -bool false`
        ].join('; ');

        const fullCommand = `
        if [ ! -f "${backupPath}" ]; then cp "${plistPath}" "${backupPath}"; fi;
        ${hotkeyCommands};
        ${gestureCommands};
        killall -9 cfprefsd;
        sleep 1;
        /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u;
        killall Dock
      `;

        childProcess.exec(fullCommand, (err) => {
            if (err) console.error('Lockdown Enable Error:', err);
        });

    } else {
        const gestureCommands = [
            `defaults write com.apple.dock showMissionControlGestureEnabled -bool true`,
            `defaults write com.apple.dock showAppExposeGestureEnabled -bool true`,
            `defaults write com.apple.dock showDesktopGestureEnabled -bool true`,
            `defaults write NSGlobalDomain AppleEnableSwipeNavigateWithScrolls -bool true`
        ].join('; ');

        const fullCommand = `
        if [ -f "${backupPath}" ]; then 
          cp "${backupPath}" "${plistPath}"; 
          rm "${backupPath}"; 
        fi;
        ${gestureCommands};
        killall -9 cfprefsd;
        sleep 1;
        /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u;
        killall Dock
      `;
        log.info('main @ toggleMacOSLockdown: Enable MissionContol');
        childProcess.exec(fullCommand, (err) => {
            if (err) console.error('Lockdown Disable Error:', err);
        });
    }
}
