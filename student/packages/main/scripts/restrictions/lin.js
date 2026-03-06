/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * Linux-specific platform restrictions (enable/disable).
 */

import childProcess from 'child_process';
import log from 'electron-log';
import platformDispatcher from '../platformDispatcher.js';

// unfortunately there is no convenient way for gnome-shell to un-set ALL shortcuts at once
// so we maintain an explicit list of schemas and keys that must be cleared in exam mode.
const gnomeShortcutConfig = {
    // window manager shortcuts (workspaces, window movement, app switcher, show desktop, etc.)
    wm: {
        schema: 'org.gnome.desktop.wm.keybindings',
        critical: [
            'activate-window-menu','maximize-horizontally','move-to-side-n','move-to-workspace-8','switch-applications','switch-to-workspace-3','switch-windows-backward',
            'always-on-top','maximize-vertically','move-to-side-s','move-to-workspace-9','switch-applications-backward','switch-to-workspace-4','toggle-above',
            'begin-move','minimize','move-to-side-w','move-to-workspace-down','switch-group','switch-to-workspace-5','toggle-fullscreen',
            'begin-resize','move-to-center','move-to-workspace-1','move-to-workspace-last','switch-group-backward','switch-to-workspace-6','toggle-maximized',
            'close','move-to-corner-ne','move-to-workspace-10','move-to-workspace-left','switch-input-source','switch-to-workspace-7','toggle-on-all-workspaces',
            'cycle-group','move-to-corner-nw','move-to-workspace-11','move-to-workspace-right','switch-input-source-backward','toggle-shaded',
            'cycle-group-backward','move-to-corner-se','move-to-workspace-12','move-to-workspace-up','switch-panels','switch-to-workspace-9','unmaximize',
            'cycle-panels','move-to-corner-sw','move-to-workspace-2','panel-main-menu','switch-panels-backward','switch-to-workspace-down',
            'cycle-panels-backward','move-to-monitor-down','move-to-workspace-3','panel-run-dialog','switch-to-workspace-1','switch-to-workspace-last',
            'cycle-windows','move-to-monitor-left','move-to-workspace-4','raise','switch-to-workspace-10','switch-to-workspace-left',
            'cycle-windows-backward','move-to-monitor-right','move-to-workspace-5','raise-or-lower','switch-to-workspace-11','switch-to-workspace-right',
            'lower','move-to-monitor-up','move-to-workspace-6','set-spew-mark','switch-to-workspace-12','switch-to-workspace-up',
            'maximize','move-to-side-e','move-to-workspace-7','show-desktop','switch-to-workspace-2','switch-windows'
        ],
        niceToHave: []
    },
    // shell level shortcuts (overview, app view, screenshots, notifications, etc.)
    shell: {
        schema: 'org.gnome.shell.keybindings',
        critical: [
            'focus-active-notification','open-application-menu','screenshot','screenshot-window','shift-overview-down',
            'shift-overview-up','switch-to-application-1','switch-to-application-2','switch-to-application-3','switch-to-application-4','switch-to-application-5',
            'switch-to-application-6','switch-to-application-7','switch-to-application-8','switch-to-application-9','show-screenshot-ui','show-screen-recording-ui',
            'toggle-application-view','toggle-message-tray','toggle-overview'
        ],
        niceToHave: []
    },
    // mutter compositor shortcuts that affect window tiling or monitor layout
    mutter: {
        schema: 'org.gnome.mutter.keybindings',
        critical: ['rotate-monitor','switch-monitor','tab-popup-cancel','tab-popup-select','toggle-tiled-left','toggle-tiled-right'],
        niceToHave: []
    },
    // wayland specific mutter shortcuts for switching virtual terminals or sessions (Ctrl+Alt+Fn)
    mutterWayland: {
        schema: 'org.gnome.mutter.wayland.keybindings',
        critical: [
            'switch-to-session-1','switch-to-session-2','switch-to-session-3','switch-to-session-4','switch-to-session-5','switch-to-session-6',
            'switch-to-session-7','switch-to-session-8','switch-to-session-9','switch-to-session-10','switch-to-session-11','switch-to-session-12'
        ],
        niceToHave: []
    },
    // common dash-to-dock extension shortcuts for switching or raising apps
    dashToDock: {
        schema: 'org.gnome.shell.extensions.dash-to-dock',
        critical: [
            'app-ctrl-hotkey-1','app-ctrl-hotkey-10','app-ctrl-hotkey-2','app-ctrl-hotkey-3','app-ctrl-hotkey-4','app-ctrl-hotkey-5',
            'app-ctrl-hotkey-6','app-ctrl-hotkey-7','app-ctrl-hotkey-8','app-ctrl-hotkey-9',
            'app-hotkey-1','app-hotkey-10','app-hotkey-2','app-hotkey-3','app-hotkey-4','app-hotkey-5','app-hotkey-6','app-hotkey-7','app-hotkey-8','app-hotkey-9',
            'app-shift-hotkey-1','app-shift-hotkey-10','app-shift-hotkey-2','app-shift-hotkey-3','app-shift-hotkey-4','app-shift-hotkey-5',
            'app-shift-hotkey-6','app-shift-hotkey-7','app-shift-hotkey-8','app-shift-hotkey-9','shortcut'
        ],
        niceToHave: []
    }
};

// optional diagnostics for reading current gsettings values when debugging GNOME restrictions
const isGnomeKeybindingDebugEnabled = process.env.NEXT_EXAM_DEBUG_GNOME === '1';

function logGsettingsValue(schema, key, phase) {
    if (!isGnomeKeybindingDebugEnabled) return;
    childProcess.execFile('gsettings', ['get', schema, key], (err, stdout) => {
        if (err) {
            log.debug(`platformrestrictions @ ${phase}: failed to read ${schema} ${key}: ${err.message}`);
            return;
        }
        log.debug(`platformrestrictions @ ${phase}: ${schema} ${key} = ${stdout.trim()}`);
    });
}

/**
 * Enable Linux-specific restrictions (KDE/GNOME, close apps, clipboard).
 * @param {object} configStore - shared store (configStore.linux.numberOfDesktops)
 * @param {string[]} appsToClose - app names to kill
 * @param {boolean} isKDE
 * @param {boolean} isGNOME
 */
export function enableLinuxRestrictions(configStore, appsToClose, isKDE, isGNOME) {
    try {
        appsToClose.forEach(app => {
            childProcess.exec(`pgrep -i "${app}"`, (pgrepError, stdout) => {
                if (!pgrepError && stdout && stdout.trim()) {
                    childProcess.exec(`pgrep -i "${app}" | xargs -r kill -9`, (killError) => {
                        if (!killError) log.info(`platformrestrictions @ enableRestrictions: closed ${app}`);
                    });
                }
            });
        });
    } catch (err) {
        // silently ignore errors
    }

    if (isKDE) {
        log.info("platformrestrictions @ enableRestrictions: enabling KDE restrictions");
        childProcess.execFile('kreadconfig5', ['--file', 'kwinrc', '--group', 'Desktops', '--key', 'Number'], (error, stdout, stderr) => {
            if (error) {
                log.error(`platformrestrictions @ enableRestrictions (kreadconfig): ${error.message}`);
                configStore.linux.numberOfDesktops = 1;
                return;
            }
            configStore.linux.numberOfDesktops = stdout.trim();
        });
        log.info("platformrestrictions @ enableRestrictions: reconfiguring kwin");
        childProcess.execFile('kwriteconfig5', ['--file', `${platformDispatcher.homedirectory}/.config/kwinrc`,'--group', 'ModifierOnlyShortcuts','--key','Meta','""']);
        childProcess.execFile('kwriteconfig5', ['--file','kwinrc','--group','Desktops','--key','Number','1']);
        childProcess.execFile('qdbus', ['org.kde.KWin','/KWin','reconfigure']);
        childProcess.execFile('qdbus', ['org.kde.KWin','/KWin','setCurrentDesktop','1']);
        log.info("platformrestrictions @ enableRestrictions: disabling effects");
        childProcess.execFile('qdbus', ['org.kde.KWin','/Effects','org.kde.kwin.Effects.unloadEffect', 'desktopgrid']);
        childProcess.execFile('qdbus', ['org.kde.KWin','/Effects','org.kde.kwin.Effects.unloadEffect', 'screenedge']);
        childProcess.execFile('qdbus', ['org.kde.KWin','/Effects','org.kde.kwin.Effects.unloadEffect', 'overview']);
        log.info("platformrestrictions @ enableRestrictions: additional tty's");
        childProcess.execFile('kwriteconfig5', ['--file', 'kxkbrc', '--group', 'Layout', '--key', 'Options', 'srvrkeys:none']);
        childProcess.execFile('dbus-send', ['--session', '--type=signal', '--dest=org.kde.keyboard', '/Layouts', 'org.kde.keyboard.reloadConfig']);
        log.info("platformrestrictions @ enableRestrictions: clearing clipboard history");
        childProcess.execFile('qdbus', ['org.kde.klipper' ,'/klipper', 'org.kde.klipper.klipper.clearClipboardHistory']);
        setTimeout(() => {
            log.info("platformrestrictions @ enableRestrictions: disabling global keyboardshortcuts");
            childProcess.execFile('qdbus', ['org.kde.kglobalaccel' ,'/kglobalaccel', 'org.kde.KGlobalAccel.blockGlobalShortcuts', 'true']);
        }, 2000);
    }

    if (isGNOME) {
        log.info("platformrestrictions @ enableRestrictions: enabling GNOME restrictions");
        try {
            const wmKeys = [...gnomeShortcutConfig.wm.critical, ...gnomeShortcutConfig.wm.niceToHave];
            for (let binding of wmKeys) {
                logGsettingsValue(gnomeShortcutConfig.wm.schema, binding, 'enable-gnome-wm-before-set');
                childProcess.execFile('gsettings', ['set', gnomeShortcutConfig.wm.schema, binding, `['']`]);
                logGsettingsValue(gnomeShortcutConfig.wm.schema, binding, 'enable-gnome-wm-after-set');
            }
            // Wayland: disable VT/TTY switch (Ctrl+Alt+F1..F12) via mutter keybindings
            const waylandKeys = [...gnomeShortcutConfig.mutterWayland.critical, ...gnomeShortcutConfig.mutterWayland.niceToHave];
            for (let binding of waylandKeys) {
                logGsettingsValue(gnomeShortcutConfig.mutterWayland.schema, binding, 'enable-gnome-wayland-before-set');
                childProcess.execFile('gsettings', ['set', gnomeShortcutConfig.mutterWayland.schema, binding, `['']`]);
                childProcess.execFile('dconf', ['write', `/org/gnome/mutter/wayland/keybindings/${binding}`, `['']`]);
                logGsettingsValue(gnomeShortcutConfig.mutterWayland.schema, binding, 'enable-gnome-wayland-after-set');
            }
            const shellKeys = [...gnomeShortcutConfig.shell.critical, ...gnomeShortcutConfig.shell.niceToHave];
            for (let binding of shellKeys) {
                logGsettingsValue(gnomeShortcutConfig.shell.schema, binding, 'enable-gnome-shell-before-set');
                childProcess.execFile('gsettings', ['set', gnomeShortcutConfig.shell.schema, binding, `['']`]);
                logGsettingsValue(gnomeShortcutConfig.shell.schema, binding, 'enable-gnome-shell-after-set');
            }
            const mutterKeys = [...gnomeShortcutConfig.mutter.critical, ...gnomeShortcutConfig.mutter.niceToHave];
            for (let binding of mutterKeys) {
                logGsettingsValue(gnomeShortcutConfig.mutter.schema, binding, 'enable-gnome-mutter-before-set');
                childProcess.execFile('gsettings', ['set', gnomeShortcutConfig.mutter.schema, binding, `['']`]);
                logGsettingsValue(gnomeShortcutConfig.mutter.schema, binding, 'enable-gnome-mutter-after-set');
            }
            const dockKeys = [...gnomeShortcutConfig.dashToDock.critical, ...gnomeShortcutConfig.dashToDock.niceToHave];
            for (let binding of dockKeys) {
                logGsettingsValue(gnomeShortcutConfig.dashToDock.schema, binding, 'enable-gnome-dock-before-set');
                childProcess.execFile('gsettings', ['set', gnomeShortcutConfig.dashToDock.schema, binding, `['']`]);
                logGsettingsValue(gnomeShortcutConfig.dashToDock.schema, binding, 'enable-gnome-dock-after-set');
            }
            childProcess.execFile('gsettings', ['set', 'org.gnome.mutter', 'overlay-key', `''`]);
            childProcess.exec('gsettings set org.gnome.mutter dynamic-workspaces false');
            childProcess.exec('gsettings set org.gnome.desktop.wm.preferences num-workspaces 1');
            // X11 only: disable TTY switch via setxkbmap (on Wayland we rely on mutter wayland keybindings above)
            if (!platformDispatcher.isWayland()) {
                configStore.linux.srvrkeysNoneSet = true;
                childProcess.exec('setxkbmap -option srvrkeys:none', (err) => {
                    if (err) log.warn('platformrestrictions @ enableRestrictions (GNOME): setxkbmap srvrkeys:none failed', err.message);
                });
            }
        } catch (err) {
            log.error(`platformrestrictions @ enableRestrictions (gsettings): ${err}`);
        }
    }

    try {
        childProcess.execFile('wl-copy', ['-c']);
        childProcess.exec('xclip -i /dev/null');
        childProcess.exec('xclip -selection clipboard');
        childProcess.exec('xsel -bc');
    } catch (err) { log.error(`platformrestrictions @ enableRestrictions (gsettings): ${err}`); }
}

/**
 * Disable Linux-specific restrictions and restore KDE/GNOME settings.
 * @param {object} configStore - shared store (configStore.linux.numberOfDesktops)
 */
export function disableLinuxRestrictions(configStore) {
    childProcess.execFile('wl-copy', ['-c']);
    childProcess.exec('xclip -i /dev/null');
    childProcess.exec('xclip -selection clipboard');
    childProcess.exec('xsel -bc');

    childProcess.exec('echo $XDG_CURRENT_DESKTOP', (error, stdout, stderr) => {
        if (error) {
            log.error(`platformrestrictions @ disableRestrictions (linux): exec error: ${error}`);
            return;
        }
        const desktop = stdout.trim();
        if (desktop === 'KDE') {
            log.info("platformrestrictions @ disableRestrictions (linux): KDE detected");
            childProcess.execFile('qdbus', ['org.kde.klipper' ,'/klipper', 'org.kde.klipper.klipper.clearClipboardHistory']);
            childProcess.execFile('qdbus', ['org.kde.kglobalaccel' ,'/kglobalaccel', 'blockGlobalShortcuts', 'false']);
            childProcess.execFile('qdbus', ['org.kde.KWin' ,'/Compositor', 'org.kde.kwin.Compositing.resume']);
            childProcess.exec('kstart5 kglobalaccel5&');
            childProcess.execFile('kwriteconfig5', ['--file',`${platformDispatcher.homedirectory}/.config/kwinrc`,'--group','ModifierOnlyShortcuts','--key','Meta','--delete']);
            childProcess.execFile('kwriteconfig5', ['--file','kwinrc','--group','Desktops','--key','Number', configStore.linux.numberOfDesktops]);
            childProcess.execFile('kwriteconfig5', ['--file', 'kxkbrc', '--group', 'Layout', '--key', 'Options', '']);
            childProcess.execFile('dbus-send', ['--session', '--type=signal', '--dest=org.kde.keyboard', '/Layouts', 'org.kde.keyboard.reloadConfig']);
            childProcess.execFile('qdbus', ['org.kde.KWin','/KWin','reconfigure']);
            const child = childProcess.exec('kstart5 plasmashell &', { detached: true, stdio: 'ignore' });
            child.unref();
        }

        if (desktop.includes('GNOME')) {
            log.info("platformrestrictions @ disableRestrictions (linux): GNOME detected");
            try {
                const wmKeys = [...gnomeShortcutConfig.wm.critical, ...gnomeShortcutConfig.wm.niceToHave];
                for (let binding of wmKeys) {
                    childProcess.execFile('gsettings', ['reset', gnomeShortcutConfig.wm.schema, `${binding}`]);
                }
                const waylandKeys = [...gnomeShortcutConfig.mutterWayland.critical, ...gnomeShortcutConfig.mutterWayland.niceToHave];
                for (let binding of waylandKeys) {
                    childProcess.execFile('gsettings', ['reset', gnomeShortcutConfig.mutterWayland.schema, binding]);
                    childProcess.execFile('dconf', ['reset', `/org/gnome/mutter/wayland/keybindings/${binding}`]);
                }
                const shellKeys = [...gnomeShortcutConfig.shell.critical, ...gnomeShortcutConfig.shell.niceToHave];
                for (let binding of shellKeys) {
                    childProcess.execFile('gsettings', ['reset', gnomeShortcutConfig.shell.schema, `${binding}`]);
                }
                const mutterKeys = [...gnomeShortcutConfig.mutter.critical, ...gnomeShortcutConfig.mutter.niceToHave];
                for (let binding of mutterKeys) {
                    childProcess.execFile('gsettings', ['reset', gnomeShortcutConfig.mutter.schema, `${binding}`]);
                }
                const dockKeys = [...gnomeShortcutConfig.dashToDock.critical, ...gnomeShortcutConfig.dashToDock.niceToHave];
                for (let binding of dockKeys) {
                    childProcess.execFile('gsettings', ['reset', gnomeShortcutConfig.dashToDock.schema, `${binding}`]);
                }
                childProcess.execFile('gsettings', ['reset', 'org.gnome.mutter', 'overlay-key']);
                // restore TTY switch if we had disabled it via setxkbmap (GNOME X11)
                if (configStore.linux.srvrkeysNoneSet) {
                    childProcess.exec("setxkbmap -option ''", (err) => {
                        if (err) log.warn('platformrestrictions @ disableRestrictions: setxkbmap restore failed', err.message);
                    });
                    configStore.linux.srvrkeysNoneSet = false;
                }
            } catch (err) {
                log.error(`platformrestrictions @ disableRestrictions (GNOME): ${err}`);
            }
        }
    });
}
