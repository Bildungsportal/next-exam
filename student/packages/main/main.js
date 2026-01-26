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
import platformDispatcher from './scripts/platformDispatcher.js';
import chalk from 'chalk';
import log from 'electron-log';
import { app, BrowserWindow, powerSaveBlocker, nativeTheme, globalShortcut, Tray, Menu, dialog, session} from 'electron'
import config from './config.js';
import multicastClient from './scripts/multicastclient.js'
import path from 'path'
import fs from 'fs'
import * as fsExtra from 'fs-extra';
import ip from 'ip'

import { gateway4sync } from 'default-gateway';
import WindowHandler from './scripts/windowhandler.js'
import CommHandler from './scripts/communicationhandler.js'
import IpcHandler from './scripts/ipchandler.js'
import { updateSystemTray } from './scripts/traymenu.js'
import JreHandler from './scripts/jre-handler.js';
import { checkParentProcess } from './scripts/checkparent.js';
import { toggleMacOSLockdown } from './scripts/platformrestrictions.js'
JreHandler.init()



app.commandLine.appendSwitch('lang', 'de');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('log-level', '3'); // 3 = WARN, 2 = ERROR, 1 = INFO


if (process.platform === 'linux'){
    app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder,OutOfProcessRasterization,CanvasOopRasterization'); // disable fragile GPU features
    app.commandLine.appendSwitch('disable-zero-copy'); 
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


WindowHandler.init(multicastClient, config)  // mainwindow, examwindow, blockwindow
CommHandler.init(multicastClient, config)    // starts "beacon" intervall and fetches information from the teacher - acts on it (startexam, stopexam, sendfile, getfile)
IpcHandler.init(multicastClient, config, WindowHandler, CommHandler)  //controll all Inter Process Communication

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
config.electron = true

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







/**
 * This function specifically checks for EPIPE errors and disables the console transport for the ElectronLogger if such an error occurs.
 * EPIPE errors typically happen when trying to write to a closed pipe, which can occur if the stdout stream is unexpectedly closed.
 */
process.stdout.on('error', (err) => { if (err.code === 'EPIPE') { log.transports.console.level = false } });

// filter GUEST_VIEW_MANAGER_CALL clone errors from stderr
// const originalStderrWrite = process.stderr.write;
// process.stderr.write = function(chunk, encoding, fd) {
//     const chunkStr = chunk?.toString() || '';
//     if (chunkStr.includes('GUEST_VIEW_MANAGER_CALL') && chunkStr.includes('object could not be cloned')) {
//         //return true; // drop this specific error - produced by geogebra webview
//     }
//     return originalStderrWrite.apply(this, arguments);
// };

process.on('uncaughtException', (err) => {
    if (err.code === 'EPIPE') {
        log.transports.console.level = false;
        log.warn('main @ uncaughtException: EPIPE Error: The stdout stream of the ElectronLogger will be disabled.');
    } 
    else if (err.message?.includes('Render frame was disposed')) return;
    else {  log.error('main @ uncaughtException:', err.message); }  // Log or display other errors
});

// Handle unhandled promise rejections to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    log.error('main @ unhandledRejection: Unhandled promise rejection:', reason);
    if (reason instanceof Error) {
        log.error('main @ unhandledRejection: Stack:', reason.stack);
    }
});

// Handle renderer process crashes (V8 fatal errors, etc.)
app.on('render-process-gone', (event, webContents, details) => {
    log.error('main @ render-process-gone: Renderer process crashed');
    log.error('main @ render-process-gone: Reason:', details.reason);
    log.error('main @ render-process-gone: Exit code:', details.exitCode);
    
    // Try to identify which window crashed
    const allWindows = BrowserWindow.getAllWindows();
    const crashedWindow = allWindows.find(win => win.webContents.id === webContents.id);
    
    if (crashedWindow) {
        log.error(`main @ render-process-gone: Window title: ${crashedWindow.getTitle()}`);
        
        // For exam window crashes, try to close it gracefully
        if (crashedWindow === WindowHandler.examwindow) {
            log.warn('main @ render-process-gone: Exam window crashed, attempting to close gracefully');
            try {
                if (!crashedWindow.isDestroyed()) {
                    crashedWindow.destroy();
                }
                WindowHandler.examwindow = null;
                WindowHandler.examDisplayId = null;
            } catch (err) {
                log.error('main @ render-process-gone: Error closing exam window:', err);
            }
        }
    }
    
    // Don't crash the main process - let it continue
    event.preventDefault();
});

// Handle child process crashes (workers, etc.)
app.on('child-process-gone', (event, details) => {
    log.error('main @ child-process-gone: Child process crashed');
    log.error('main @ child-process-gone: Type:', details.type);
    log.error('main @ child-process-gone: Reason:', details.reason);
    log.error('main @ child-process-gone: Exit code:', details.exitCode);
    
    // Don't crash the main process
    event.preventDefault();
});

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') {  app.setAppUserModelId(app.getName())}
//if (process.platform ==='darwin') {  app.dock.hide() }  // this bug states that it kinda messes up kiosk mode - https://github.com/electron/electron/issues/18207



// hide certificate warnings in console.. we know we use a self signed cert and do not validate it
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const originalEmitWarning = process.emitWarning
process.emitWarning = (warning, options) => {
    if (warning && warning.includes && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {  return }
    return originalEmitWarning.call(process, warning, options)
}

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => { // SSL/TLS: this is the self signed certificate support
    event.preventDefault(); // On certificate error we disable default behaviour (stop loading the page)
    callback(true);  // and we then say "it is all fine - true" to the callback
});

// Handle WebContents load failures to prevent app crashes
app.on('web-contents-created', (event, webContents) => {

    webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame, frameProcessId, frameRoutingId) => {
        // Log the error but don't crash the app
        log.warn(`main @ did-fail-load: Error ${errorCode} - ${errorDescription} for URL: ${validatedURL}`);

    });
    
    // Handle renderer process crashes for specific webContents (V8 fatal errors, etc.)
    webContents.on('render-process-gone', (event, details) => {
        log.error('main @ webContents render-process-gone: Renderer process crashed for specific webContents');
        log.error('main @ webContents render-process-gone: Reason:', details.reason);
        log.error('main @ webContents render-process-gone: Exit code:', details.exitCode);
        
        // Try to identify which window this webContents belongs to
        const allWindows = BrowserWindow.getAllWindows();
        const crashedWindow = allWindows.find(win => win.webContents.id === webContents.id);
        
        if (crashedWindow) {
            log.error(`main @ webContents render-process-gone: Window title: ${crashedWindow.getTitle()}`);
            log.error(`main @ webContents render-process-gone: Window URL: ${crashedWindow.webContents.getURL()}`);
            
            // For exam window crashes, try to close it gracefully
            if (crashedWindow === WindowHandler.examwindow) {
                log.warn('main @ webContents render-process-gone: Exam window crashed, attempting to close gracefully');
                try {
                    if (!crashedWindow.isDestroyed()) {
                        crashedWindow.destroy();
                    }
                    WindowHandler.examwindow = null;
                    WindowHandler.examDisplayId = null;
                } catch (err) {
                    log.error('main @ webContents render-process-gone: Error closing exam window:', err);
                }
            }
        }
        
        // Don't crash the main process - let it continue
        event.preventDefault();
    });
});

app.on('window-all-closed', () => {  // if window is closed
    clearInterval( CommHandler.updateStudentIntervall )
    WindowHandler.mainwindow = null
    app.quit()   
})

app.on('will-quit', () => {  // if window is closed
    toggleMacOSLockdown(false)
})

app.on('before-quit', async () => {
    try {
        await session.defaultSession.clearStorageData({}); // clear cookies, cache, localStorage etc.
    } catch (err) {
        log.error('main @ before-quit: Error clearing cache:', err);
    }
});

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

    nativeTheme.themeSource = 'light'  // prevent theme settings from being adopted from windows
    session.defaultSession.setUserAgent(`Next-Exam/${config.version} (${config.info}) ${process.platform}`);  // set user agent for all sessions
    session.defaultSession.setCertificateVerifyProc((request, callback) => { callback(0); });   // set certificate verification globally for all sessions
    
    toggleMacOSLockdown(true);
   
    /******* Create main window *******/
    WindowHandler.createMainWindow()


    if (config.hostip == "127.0.0.1") { config.hostip = false }
    if (config.hostip) { multicastClient.init(config.gateway)  } //multicast client only tracks other exam instances on the network

    const allowTray = !platformDispatcher._isGNOME(); // GNOME hides legacy tray
    if (!config.development){
        powerSaveBlocker.start('prevent-display-sleep')   // prevent the device from going to sleep
        if (allowTray) { updateSystemTray('de'); }        // skip tray on GNOME
        else { log.info('main @ tray: GNOME detected, skipping system tray'); }
        runParentProcessCheck();  // this checks if the app was started from within a browser (directly after download)
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

