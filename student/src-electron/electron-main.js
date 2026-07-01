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
 * This is the ELECTRON main file that actually opens the electron window
 */
import platformDispatcher from './main/scripts/platformDispatcher.js';
import { getLinuxCageDetectionLogLines } from './main/scripts/cageDetect.js';
import { getWindowsKioskDetectionLogLines, syncAllowedKioskAppsClientinfo } from './main/scripts/win/windowsKioskSetup.js';
import chalk from 'chalk';
import log from 'electron-log';
import { app, BrowserWindow, powerSaveBlocker, nativeTheme, globalShortcut, Menu, dialog, session, desktopCapturer } from 'electron'
import config from './main/config.js';
import multicastClient from './main/scripts/multicastclient.js'
import path from 'path'
import fs from 'fs'
import { wipeKioskUserFiles } from './main/scripts/win/windowsKioskSetup.js'
import * as fsExtra from 'fs-extra';
import ip from 'ip'
import { gateway4sync } from 'default-gateway';
import WindowHandler from './main/scripts/windowhandler.js'
import CommHandler from './main/scripts/communicationhandler.js'
import IpcHandler from './main/scripts/ipchandler.js'
import { updateSystemTray } from './main/scripts/traymenu.js'
import JreHandler from './main/scripts/jre-handler.js';
import { checkParentProcess } from './main/scripts/checkparent.js';

// toggleMacOSLockdown disabled while macOS Automatic Assessment mode is active
import { stopProxy } from './main/scripts/vncproxy.js';
import { stopAssessmentSession } from './main/scripts/assessmentSession.js';
import { initErrorHandling } from './main/scripts/errorHandling.js';
import { syncClientDisplayInfo } from './main/scripts/displayInfo.js';



app.commandLine.appendSwitch('lang', 'de');
// Chromium stack for main-process fetch ignores NODE_TLS_REJECT_UNAUTHORIZED (Electron 38+).
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('log-level', '3'); // 3 = WARN, 2 = ERROR, 1 = INFO

if (process.platform === 'linux'){
    app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder,OutOfProcessRasterization,CanvasOopRasterization'); // disable fragile GPU features
    app.commandLine.appendSwitch('disable-zero-copy');
    // Fallback when chrome-sandbox is not configured (e.g. Debian without unprivileged_userns_clone)
    //app.commandLine.appendSwitch('no-sandbox');
}
else if (process.platform === 'darwin'){
    app.commandLine.appendSwitch('enable-features', 'Metal,CanvasOopRasterization');  // macos only
}





log.initialize(); // initialize the logger for any renderer process
log.eventLogger.startLogging();
log.errorHandler.startCatching();
log.transports.file.resolvePathFn = () => { return platformDispatcher.logfile  }

log.transports.console.format = (message) => {
    // Always return an array, not strings!
    switch (message.level) {
      case 'info': return [chalk.green(message.data.join ? message.data.join(' ') : String(message.data))];
      case 'warn': return [chalk.yellow(message.data.join ? message.data.join(' ') : String(message.data))];
      case 'error': return [chalk.red(message.data.join ? message.data.join(' ') : String(message.data))];
      case 'debug': return [chalk.blue(message.data.join ? message.data.join(' ') : String(message.data))];
      case 'verbose': return [chalk.magenta(message.data.join ? message.data.join(' ') : String(message.data))];
      default:     return [String(message.data)];
    }
};

log.verbose()
log.verbose(`main: -------------------`)
log.verbose(`main: starting Next-Exam Student "${config.version} ${config.info}" (${process.platform})${config.development ? ' (devmode on)' : ''}`)
log.verbose(`main: -------------------`)
log.info(`main: Logfilelocation at ${platformDispatcher.logfile}`)
platformDispatcher.messages.forEach(message => { log.debug(message) });

// log electron version and other platform information
log.debug(`main: Electron version: ${process.versions.electron}`)
log.debug(`main: Chromium version: ${process.versions.chrome}`)
log.debug(`main: Node version: ${process.versions.node}`)
log.debug(`main: V8 version: ${process.versions.v8}`)
log.debug(`main: OS: ${process.platform} ${process.arch}`)
log.debug(`main: Arch: ${process.arch}`)
log.debug(`main: Desktop: ${platformDispatcher.desktopName}`)
log.debug(`main: Display server: ${platformDispatcher.displayServer}`)
for (const line of getLinuxCageDetectionLogLines()) log.debug(line);
for (const line of getWindowsKioskDetectionLogLines()) log.debug(line);
syncAllowedKioskAppsClientinfo(multicastClient.clientinfo);
if (platformDispatcher.runningUnderMacRosetta) {
    log.warn('main: Intel (x64) build running under Rosetta on Apple Silicon — install the arm64 build');
}





WindowHandler.init(multicastClient, config)  // mainwindow, examwindow
CommHandler.init(multicastClient, config)    // starts "beacon" intervall and fetches information from the teacher - acts on it (startexam, stopexam, sendfile, getfile)
IpcHandler.init(multicastClient, config, WindowHandler, CommHandler)  //controll all Inter Process Communication
initErrorHandling(log, WindowHandler);
JreHandler.init();

// Prevents Electron from creating the default menu
Menu.setApplicationMenu(null);


if (!app.requestSingleInstanceLock()) {  // allow only one instance of the app per client
    log.warn("main @ singleinstance: next-exam already running.")
    app.quit()
    process.exit(0)
}

app.on('second-instance', () => {
    log.warn("main @ singleinstance: prevented second start of next-exam. Restoring existing Next-Exam window.")
    if (WindowHandler.mainwindow) {
        if (WindowHandler.mainwindow.isMinimized() || !WindowHandler.mainwindow.isVisible()) {
            WindowHandler.mainwindow.show()
            WindowHandler.mainwindow.restore()
        } 
        WindowHandler.mainwindow.focus() // Focus on the main window if the user tried to open another
    }
})


/**
 * additional config settings and path checks
 */

const __dirname = import.meta.dirname;

config.homedirectory = platformDispatcher.homedirectory;
config.workdirectory = platformDispatcher.workdirectory;
config.tempdirectory = platformDispatcher.tempdirectory;
config.examdirectory = config.workdirectory    // we need this variable setup even if we do not connect to a teacher instance


if (!fs.existsSync(config.workdirectory)){ fs.mkdirSync(config.workdirectory, { recursive: true }); }
if (!fs.existsSync(config.tempdirectory)){ fs.mkdirSync(config.tempdirectory, { recursive: true }); }
if (!fs.existsSync(platformDispatcher.desktopPath)) {  fs.mkdirSync(platformDispatcher.desktopPath, { recursive: true }); }  // Check if the desktop folder exists and create if it doesn't

// Create the symbolic link to the workdirectory on the desktop
const linkPath = path.join(platformDispatcher.desktopPath, config.clientdirectory);  // Define the path for the symbolic link
try {fs.unlinkSync(linkPath) }catch(e){}
try {   if (!fs.existsSync(linkPath)) { fs.symlinkSync(config.workdirectory, linkPath, 'junction'); }}
catch(e){log.error("main @ create-symlink: can't create symlink")}


try { //bind to the correct interface
    const { gateway, interface: iface} = gateway4sync(); 
    config.hostip = ip.address(iface)    // this returns the ip of the interface that has a default gateway..  should work in MOST cases.  probably provide "ip-options" in UI ?
    config.gateway = true
}
 catch (e) {
   log.error("main @ gateway4sync: unable to determine default gateway")
   config.hostip = ip.address() 
   log.info(`main: IP ${config.hostip}`)
   config.gateway = false
 }


fsExtra.emptyDirSync(config.tempdirectory)  // clean temp directory







if (process.platform === 'win32') app.setAppUserModelId(app.getName());

app.on('window-all-closed', async () => {  // last window closed – clear storage here to avoid Linux segfault in before-quit
    clearInterval( CommHandler.updateStudentIntervall )
    if (WindowHandler.checkWindowInterval?.stop) WindowHandler.checkWindowInterval.stop()
    if (CommHandler.updateScheduler?.stop) CommHandler.updateScheduler.stop()
    if (multicastClient.refreshExamsScheduler?.stop) multicastClient.refreshExamsScheduler.stop()
    // ensure any running vncproxy-helper child is terminated before quit
    try { stopProxy() } catch (err) { log.warn('main @ window-all-closed: stopProxy failed', err) }
    WindowHandler.mainwindow = null

    try {
        await session.defaultSession.clearStorageData({}); // clear cookies, cache, localStorage etc. while session still valid
    } catch (err) {
        log.error('main @ window-all-closed: Error clearing storage:', err);
    }
    app.quit();
});

app.on('will-quit', () => {  // if window is closed
    if (process.platform === 'darwin') {
        stopAssessmentSession().catch((err) => log.warn('main @ will-quit: stopAssessmentSession', err));
    }
    if (process.platform === 'win32' && platformDispatcher.runningInCage) {
        wipeKioskUserFiles({ workdirectory: config.workdirectory }); // win32 kiosk: wipe workdir + standard user folders before quit so the next student starts fresh.
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) { allWindows[0].focus() } 
    else { WindowHandler.createMainWindow() }
})

/**
 * Check if the app was started from within a browser and quit if detected
 */
async function runParentProcessCheck() {
    try {
        const result = await checkParentProcess();
        if (!result.success) {
            log.error('main @ checkParent:', result.error);
            return;
        }

        if (result.foundBrowser) {
            log.warn('main @ checkParent: The app was started directly from a browser');
            dialog.showMessageBoxSync(WindowHandler.mainwindow, {
                type: 'question',
                buttons: ['OK'],
                title: 'Terminate Program',
                message: 'Unerlaubter Programmstart aus einem Webbrowser erkannt.\nNext-Exam wird beendet!',
            });
            WindowHandler.mainwindow.allowexit = true;
            app.quit();
        } else {
            log.info('main @ checkparent: Parent Process Check OK');
        }
    } catch (error) {
        log.error('main @ checkParent error:', error);
    }
}

app.whenReady()
.then(async ()=>{

    syncClientDisplayInfo(multicastClient.clientinfo);

    nativeTheme.themeSource = 'light'  // prevent theme settings from being adopted from windows
    session.defaultSession.setUserAgent(`Next-Exam/${config.version} (${config.info}) ${process.platform} mit SEB-Kompatibilitätsmodus`);  // set user agent for all sessions
    session.defaultSession.setCertificateVerifyProc((request, callback) => { callback(0); });   // set certificate verification globally for all sessions
    
    // Kiosk (Linux cage OR Win32 AssignedAccess): no system picker available; auto-grant the
    // first source. Linux cage limits to windows (cage shows one window). Win32 grants screen.
    // Non-kiosk: useSystemPicker:true so the OS dialog appears as usual.
    if (platformDispatcher.runningInCage) {
        const types = process.platform === 'linux' ? ['window'] : ['screen'];
        session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
            desktopCapturer.getSources({ types }).then((sources) => {
                if (!sources.length) {
                    log.warn(`main @ setDisplayMediaRequestHandler (kiosk ${types[0]}): no sources`);
                    callback(null);
                    return;
                }
                let picked = sources[0];
                if (process.platform === 'linux') {
                    const nextExam = sources.find((s) => /next-exam|next exam/i.test(s.name));
                    if (nextExam) picked = nextExam;
                }
                callback({ video: picked });
            }).catch((err) => {
                log.warn('main @ setDisplayMediaRequestHandler (kiosk):', err?.message || err);
                callback(null);
            });
        }, { useSystemPicker: false });
    } else {
        // Non-kiosk: system picker must win. On macOS, never override the picker by forcing sources[0].
        if (process.platform === 'darwin') {
            session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
                callback(null);
            }, { useSystemPicker: true });
        } else {
            // Use system picker when available; fallback to first screen (non-macOS).
            session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
                desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
                    try {
                        if (sources.length > 0) {
                            callback({ video: sources[0] });
                        } else {
                            log.warn('main @ setDisplayMediaRequestHandler: no screen sources available');
                            callback(null);
                        }
                    } catch (e) {
                        log.warn('main @ setDisplayMediaRequestHandler: exception in handler', e?.message || e);
                        callback(null);
                    }
                }).catch((err) => {
                    log.warn('main @ setDisplayMediaRequestHandler:', err?.message || err);
                    callback(null);
                });
            }, { useSystemPicker: true });
        }
    }
    
    /******* Create main window *******/
    WindowHandler.createMainWindow()


    if (config.hostip == "127.0.0.1") { config.hostip = false }
    if (config.hostip) { multicastClient.init(config.gateway)  } //multicast client only tracks other exam instances on the network

    const allowTray = !platformDispatcher._isGNOME(); // GNOME hides legacy tray
    if (!config.development){
        powerSaveBlocker.start('prevent-display-sleep')   // prevent the device from going to sleep
        if (allowTray) { updateSystemTray('de'); }        // skip tray on GNOME
        else { log.info('main @ tray: GNOME detected, skipping system tray'); }
        
        if (!platformDispatcher.runningInCage) {  // Skip in Win/Linux kiosk
            runParentProcessCheck();  // check if the app was started from within a browser and quit if detected
        }
    }
    if (config.development){
        globalShortcut.register('CommandOrControl+Shift+G', () => {  if (global && global.gc){ global.gc({type:'mayor',execution: 'async'}); global.gc({type:'minor',execution: 'async'});  }});
        globalShortcut.register('CommandOrControl+Shift+T', () => {  const win = BrowserWindow.getFocusedWindow(); if (win) { win.webContents.toggleDevTools() }});
    }

    //these are some shortcuts we try to capture
    globalShortcut.register('CommandOrControl+R', () => {});
    globalShortcut.register('F5', () => {});  //reload page
    globalShortcut.register('CommandOrControl+Shift+R', () => {});
    globalShortcut.register('Alt+F4', () => {});  //exit app
    globalShortcut.register('CommandOrControl+W', () => {});
    globalShortcut.register('CommandOrControl+Q', () => {});  //quit
    globalShortcut.register('CommandOrControl+D', () => {});  //show desktop
    globalShortcut.register('CommandOrControl+L', () => {});  //lockscreen
    globalShortcut.register('CommandOrControl+P', () => {});  //change screen layout
    globalShortcut.register('Alt+Left', () => {  return false });  // Navigation attempt blocked
})
