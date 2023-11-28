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


import { app, BrowserWindow, dialog  } from 'electron'
import { join } from 'path'
import log from 'electron-log/main';


class WindowHandler {
    constructor () {
      this.mainwindow = null
      this.authwindow = null
      this.config = null
      this.multicastClient = null
      this.multicastServer = null
    }

    init (mc, config) {
        this.multicastClient = mc
        this.config = config

        /**
         * logger configuration and init
         */
        log.initialize({ preload: true }); // initialize the logger for any renderer process
        log.transports.file.resolvePathFn = (config) => {
            let logfile = `${this.config.workdirectory}/next-exam-teacher.log`
            console.log(`Logfile: ${logfile}`)
            return logfile
        }
        log.eventLogger.startLogging();


        log.info('Next-Exam Logger initialized...');

    }

    createWindow() {
        this.mainwindow = new BrowserWindow({
            title: 'Main window',
            icon: join(__dirname, '../../public/icons/icon.png'),
            center:true,
            width: 1000,
            height: 700,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                preload: join(__dirname, '../preload/preload.cjs')
            },
        })
    
        if (app.isPackaged || process.env["DEBUG"]) {
            this.mainwindow.removeMenu() 
            this.mainwindow.loadFile(join(__dirname, '../renderer/index.html'))
        } 
        else {
            const url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}`
            this.mainwindow.removeMenu() 
            this.mainwindow.loadURL(url)
        }
    
        if (this.config.showdevtools) { this.mainwindow.webContents.openDevTools()  }
    
        // Make all links open with the browser, not with the application
        // win.webContents.setWindowOpenHandler(({ url }) => {
        //     if (url.startsWith('https:')) shell.openExternal(url)
        //     return { action: 'deny' }
        // })
    
        this.mainwindow.webContents.session.setCertificateVerifyProc((request, callback) => {
            var { hostname, certificate, validatedCertificate, verificationResult, errorCode } = request;
            callback(0);
        });
    
    
        this.mainwindow.on('close', async  (e) => {   //ask before closing
            if (!this.config.development) {
                if (this.mainwindow?.webContents.getURL().includes("dashboard")){console.log("do not close running exam this way"); e.preventDefault(); return}
                let choice = dialog.showMessageBoxSync(this.mainwindow, {
                    type: 'question',
                    buttons: ['Ja', 'Nein'],
                    title: 'Programm beenden',
                    message: 'Sind sie sicher?',
                    cancelId: 1
                });
                if(choice == 1){
                    e.preventDefault();
                }
            }
        });
    }


    /**
     * Microsoft 365 Auth Window 
     */
    createMsauthWindow() {
        this.authwindow = new BrowserWindow({
            show: false,
            center:true,
            title: 'OAuth',
            width: 500,
            height: 800,
            minimizable: false,
            icon: join(__dirname, '../../public/icons/icon.png'),
            webPreferences: {
                preload: join(__dirname, '../preload/preload.cjs'),
            },
        });
    
        let url = `https://localhost:22422/server/control/oauth`
        this.authwindow.loadURL(url)
        if (this.config.showdevtools) { this.authwindow.webContents.openDevTools()  }
        this.authwindow.once('ready-to-show', () => {
            this.authwindow?.removeMenu() 
            this.authwindow?.setMinimizable(false)
            this.authwindow?.show()
            this.authwindow?.moveTop();
        })
    }
}

export default new WindowHandler()
 