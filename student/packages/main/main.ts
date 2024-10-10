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

import { app, BrowserWindow, powerSaveBlocker, nativeTheme, globalShortcut, Tray, Menu, dialog} from 'electron'

if (!app.requestSingleInstanceLock()) {  // allow only one instance of the app per client
    app.quit()
    process.exit(0)
 }

import { release } from 'os'
import WindowHandler from './scripts/windowhandler.js'
import CommHandler from './scripts/communicationhandler.js'
import IpcHandler from './scripts/ipchandler.js'
import config from './config.js';
import multicastClient from './scripts/multicastclient.js'
import path from 'path'
import fs from 'fs'
import fsExtra from "fs-extra"
import os from 'os'
import ip from 'ip'
import log from 'electron-log/main';
import { gateway4sync } from 'default-gateway';
import ps from 'ps-node'

const __dirname = import.meta.dirname;
config.electron = true

config.homedirectory = os.homedir();
config.workdirectory = path.join(config.homedirectory, config.clientdirectory);
config.tempdirectory = path.join(os.tmpdir(), 'exam-tmp');
config.examdirectory = config.workdirectory    // we need this variable setup even if we do not connect to a teacher instance


if (!fs.existsSync(config.workdirectory)){ fs.mkdirSync(config.workdirectory, { recursive: true }); }
if (!fs.existsSync(config.tempdirectory)){ fs.mkdirSync(config.tempdirectory, { recursive: true }); }


// Define the desktop path based on the platform
const desktopPath = process.platform === 'win32'
    ? path.join(process.env['USERPROFILE'], 'Desktop')
    : path.join(config.homedirectory, 'Desktop');


// Check if the desktop folder exists and create if it doesn't
if (!fs.existsSync(desktopPath)) {  fs.mkdirSync(desktopPath, { recursive: true }); }
// Define the path for the symbolic link
const linkPath = path.join(desktopPath, config.clientdirectory);
// Create the symbolic link
if (!fs.existsSync(linkPath)) { fs.symlinkSync(config.workdirectory, linkPath, 'junction'); }


try { //bind to the correct interface
    const { gateway, interface: iface} = gateway4sync(); 
    config.hostip = ip.address(iface)    // this returns the ip of the interface that has a default gateway..  should work in MOST cases.  probably provide "ip-options" in UI ?
    config.gateway = true
}
 catch (e) {
   log.error("main: unable to determine default gateway")
   config.hostip = ip.address() 
   log.info(`main: IP ${config.hostip}`)
   config.gateway = false
 }






app.commandLine.appendSwitch('lang', 'de')
fsExtra.emptyDirSync(config.tempdirectory)  // clean temp directory



log.initialize(); // initialize the logger for any renderer process
let logfile = `${config.workdirectory}/next-exam-student.log`
log.transports.file.resolvePathFn = (config) => { return logfile  }
log.eventLogger.startLogging();
log.errorHandler.startCatching();
log.warn(`-------------------`)
log.warn(`main: starting Next-Exam "${config.version} ${config.info}" (${process.platform})`)
log.info(`main: Logfilelocation at ${logfile}`)
log.info('main: Next-Exam Logger initialized...');


WindowHandler.init(multicastClient, config)  // mainwindow, examwindow, blockwindow
CommHandler.init(multicastClient, config)    // starts "beacon" intervall and fetches information from the teacher - acts on it (startexam, stopexam, sendfile, getfile)
IpcHandler.init(multicastClient, config, WindowHandler, CommHandler)  //controll all Inter Process Communication




let tray = null;

  ////////////////////////////////
 // APP handling (Backend) START
////////////////////////////////

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') {  app.setAppUserModelId(app.getName())}
//if (process.platform ==='darwin') {  app.dock.hide() }  // this bug states that it kinda messes up kiosk mode - https://github.com/electron/electron/issues/18207



// hide certificate warnings in console.. we know we use a self signed cert and do not validate it
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
const originalEmitWarning = process.emitWarning
process.emitWarning = (warning, options) => {
    if (warning && warning.includes && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {  return }
    return originalEmitWarning.call(process, warning, options)
}
 










 // Optionale zusätzliche Kontrolle über Konsolenfehler
app.commandLine.appendSwitch('log-level', '3'); // 3 = WARN, 2 = ERROR, 1 = INFO



app.on('certificate-error', (event, webContents, url, error, certificate, callback) => { // SSL/TSL: this is the self signed certificate support
    event.preventDefault(); // On certificate error we disable default behaviour (stop loading the page)
    callback(true);  // and we then say "it is all fine - true" to the callback
});

app.on('window-all-closed', () => {  // if window is closed
    clearInterval( CommHandler.updateStudentIntervall )
    //disableRestrictions()
    WindowHandler.mainwindow = null
    // if (process.platform !== 'darwin'){ app.quit() }
    app.quit()   
})

app.on('second-instance', () => {
    if (WindowHandler.mainwindow) {
        if (WindowHandler.mainwindow.isMinimized()) WindowHandler.mainwindow.restore() // Focus on the main window if the user tried to open another
        WindowHandler.mainwindow.focus()
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) { allWindows[0].focus() } 
    else { WindowHandler.createMainWindow() }
})

app.whenReady()
.then(async ()=>{
    nativeTheme.themeSource = 'light'  // verhindere dass theme einstellungen von windows übernommen werden

    if (config.hostip == "127.0.0.1") { config.hostip = false }
    if (config.hostip) {
        log.info(`main: HOSTIP: ${config.hostip}`)
        multicastClient.init(config.gateway) 
    }

    powerSaveBlocker.start('prevent-display-sleep')   // verhindere dass das gerät einschläft
   
    //WindowHandler.createSplashWin()
    WindowHandler.createMainWindow()

    // Tray-Icon erstellen
    const iconPath = path.join(__dirname, '../../public/icons','icon.png'); // Pfad zum Icon der App
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([ 
        { label: 'Wiederherstellen', click: function () { WindowHandler.mainwindow.show(); }   },
        { label: 'Verbindung trennen', click: function () {
            log.info("main.ts @ systemtray: removing registration ")
            CommHandler.resetConnection();
        }   },
        { label: 'Beenden', click: function () {WindowHandler.mainwindow.allowexit = true; app.quit(); }   }
    ]);

    tray.setToolTip('Next-Exam Student');
    tray.setContextMenu(contextMenu);

    // Klick auf das Tray-Icon zeigt das Fenster
    tray.on('click', () => {
        WindowHandler.mainwindow.isVisible() ?  WindowHandler.mainwindow.hide() :  WindowHandler.mainwindow.show();
    });

    checkParent()  // this checks if the app was started from within a browser (directly after download)

    //these are some shortcuts we try to capture
    globalShortcut.register('CommandOrControl+R', () => {});
    globalShortcut.register('F5', () => {});  //reload page
    globalShortcut.register('CommandOrControl+Shift+R', () => {});
    globalShortcut.register('Alt+F4', () => {console.log("Alt+F4")});  //exit app
      
    globalShortcut.register('CommandOrControl+W', () => {});
    globalShortcut.register('CommandOrControl+Q', () => {});  //quit
    globalShortcut.register('CommandOrControl+D', () => {});  //show desktop
    globalShortcut.register('CommandOrControl+L', () => {});  //lockscreen
    globalShortcut.register('CommandOrControl+P', () => {});  //change screen layout
 

    if (!config.development){
    }
    else { 
        globalShortcut.register('CommandOrControl+Shift+G', () => {  console.log("triggering scavenge GC"); if (global && global.gc){ global.gc({type:'mayor',execution: 'async'}); global.gc({type:'minor',execution: 'async'});  }});
        globalShortcut.register('CommandOrControl+Shift+D', () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) {
                win.webContents.toggleDevTools()
            }
        })
    }

    globalShortcut.register('Alt+Left', () => {
        console.log('Versuch, mit Alt+Left zurückzunavigieren, wurde blockiert.');
    });
})




//block starting the app from a browser 
function checkParent(){
    const parentPid = process.ppid; // Parent Process ID
    ps.lookup({ pid: parentPid }, (err, resultList) => {
      if (err) {throw new Error(err); }
      if (resultList.length > 0) {
        const parentProcess = resultList[0];
        const parentCommand = parentProcess.command.toLowerCase();

        // Überprüfe, ob der Elternprozess ein Browser ist
        if (parentCommand.includes('chrom') || parentCommand.includes('edge') || parentCommand.includes('fire') || parentCommand.includes('brave') || parentCommand.includes('opera')) {
            log.warn('main @ checkparent: Die App wurde direkt aus einem Browser gestartet:', parentCommand);

            dialog.showMessageBoxSync(WindowHandler.mainwindow, {
                type: 'question',
                buttons: ['OK'],
                title: 'Programm beenden',
                message: 'Unerlaubter Programmstart aus einem Webbrowser erkannt.\nNext-Exam wird beendet!',
                cancelId: 1
            });
          
            WindowHandler.mainwindow.closetriggered = true
            app.quit()
           
        } else {
          log.info('main @ checkparent: Parent Process Check OK');
        }
      } else { log.warn('main @ checkparent: Elternprozess nicht gefunden');  }
    });

}



//capture global keyboard shortcuts like alt+tab and send a signal to the frontend that a key combination has been detected 
    


  ////////////////////////////////
 // APP handling (Backend) END
////////////////////////////////