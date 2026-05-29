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


import log from 'electron-log';
import chalk from 'chalk';
import { app, BrowserWindow, powerSaveBlocker, nativeTheme, globalShortcut, Menu } from 'electron'
import platformDispatcher from './main/scripts/platformDispatcher.js';
import config from './main/config.js';
import server from './server/src/server.js';
import multicastClient from './main/scripts/multicastclient.js';
import WindowHandler from './main/scripts/windowhandler.js';
import IpcHandler from './main/scripts/ipchandler.js';

// So Electron single-instance lock uses a different userData than student (lock key = userData + execPath)
app.setName('next-exam-teacher');

log.initialize(); // initialize the logger for any renderer process
if (!config.workdirectory) config.workdirectory = platformDispatcher.workdirectory
if (!config.tempdirectory) config.tempdirectory = platformDispatcher.tempdirectory
let logfile = platformDispatcher.logfile

log.eventLogger.startLogging();
log.errorHandler.startCatching();

log.transports.file.resolvePathFn = () => { return logfile  }
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
log.verbose(`main: -------------------`)
log.verbose(`main: starting Next-Exam Teacher "${config.version} ${config.info}" (${process.platform})${config.development ? ' (devmode on)' : ''}`)
log.verbose(`main: -------------------`)
log.info(`main: Logfilelocation at ${logfile}`)
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


// Minimal macOS application menu to enable standard shortcuts like Cmd+C / Cmd+V / Cmd+Q
if (process.platform === 'darwin') {
    const template = [
        {
            label: app.name,
            submenu: [
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'copy' },
                { role: 'paste' }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
} else {
    // Prevents Electron from creating the default menu on non-macOS platforms
    Menu.setApplicationMenu(null);
}
app.commandLine.appendSwitch('enable-features', 'Metal,CanvasOopRasterization');
// app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('lang', 'de');
app.commandLine.appendSwitch('allow-file-access-from-files');


if (config.workdirectory) {
    app.commandLine.appendSwitch('user-data-dir', config.workdirectory);
}

WindowHandler.init(multicastClient, config)  // mainwindow, examwindow
IpcHandler.init(multicastClient, config, WindowHandler)  //controll all Inter Process Communication


/**
 * This function specifically checks for EPIPE errors and disables the console transport for the ElectronLogger if such an error occurs.
 * EPIPE errors typically happen when trying to write to a closed pipe, which can occur if the stdout stream is unexpectedly closed.
 */
process.stdout.on('error', (err) => { if (err.code === 'EPIPE') { log.transports.console.level = false } });

process.on('uncaughtException', (err) => {
    if (err.code === 'EPIPE') {
        log.transports.console.level = false;
        log.warn('main: EPIPE Error: Der stdout-Stream des ElectronLoggers wird deaktiviert.');
    } 
    else {  log.error('main:', err.message); }  // Andere Fehler protokollieren oder anzeigen
});

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())


if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

 // Chromium stack for main-process fetch ignores NODE_TLS_REJECT_UNAUTHORIZED (Electron 38+).
app.commandLine.appendSwitch('ignore-certificate-errors');

 // Optional additional control over console errors
app.commandLine.appendSwitch('log-level', '3'); // 3 = WARN, 2 = ERROR, 1 = INFO

// hide certificate warnings in console.. we know we use a self signed cert and do not validate it
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
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
        
        // Handle specific error codes
        if (errorCode === -3) {
            // -3 is ERR_ABORTED, often related to blob URLs or PDF viewers
            log.warn(`main @ did-fail-load: Aborted load for blob URL or PDF viewer - this is usually safe to ignore`);
            return;
        }
        
        // For other error codes, log but continue
        if (errorCode !== -3) {
            log.error(`main @ did-fail-load: Unexpected error ${errorCode} - ${errorDescription}`);
        }
    });
});

app.on('window-all-closed', () => {
    WindowHandler.mainwindow = null
    app.quit()
})

app.on('second-instance', () => {
    if (WindowHandler.mainwindow) {
        if (WindowHandler.mainwindow.isMinimized()) WindowHandler.mainwindow.restore()
        WindowHandler.mainwindow.focus() // Focus on the main window if the user tried to open another
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) { allWindows[0].focus()} // if there is a window - focus
    else { WindowHandler.createWindow() }       // if not create new
})

app.whenReady().then(()=>{    
    server.listen(config.serverApiPort, () => {  // start express API
        log.info(`main @ ready: Express listening on https://${config.hostip}:${config.serverApiPort}`)
    }) 
})
.then(async ()=>{
    nativeTheme.themeSource = 'light'  // make sure it doesn't apply dark system themes (we have dark icons in editor)
    
    if (config.hostip == "127.0.0.1") { config.hostip = false }
    if (config.hostip) { multicastClient.init(config.gateway)  } //multicast client only tracks other exam instances on the network
    powerSaveBlocker.start('prevent-display-sleep')

    WindowHandler.createWindow()

    globalShortcut.register('CommandOrControl+Shift+H', () => {  const win = BrowserWindow.getFocusedWindow(); if (win) { win.webContents.toggleDevTools() }});
    globalShortcut.register('Alt+Left', () => {  return false });  // Navigation attempt blocked

})