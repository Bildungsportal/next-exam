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


import { app, BrowserWindow, dialog, screen  } from 'electron'
import { join } from 'path'
import log from 'electron-log';

const __dirname = import.meta.dirname;



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
    }




    createBiPLoginWin(biptest) {
        this.bipwindow = new BrowserWindow({
            title: 'Next-Exam',
            icon: join(__dirname, '../../public/icons/icon.png'),
            center:true,
            width: 1200,
            height:920,
            alwaysOnTop: true,
            skipTaskbar:true,
            autoHideMenuBar: true,
           // resizable: false,
            minimizable: false,
           // movable: false,
           // frame: false,
            show: false,
           // transparent: true
        })
     
        if (biptest){   this.bipwindow.loadURL(`https://q.bildung.gv.at/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam`)   }
        else {          this.bipwindow.loadURL(`https://www.bildung.gv.at/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam`)   }

        // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
        this.bipwindow.webContents.once('did-finish-load', () => {
            if (this.bipwindow && !this.bipwindow.isVisible()) {
                this.bipwindow.show()
            }
        });

        this.bipwindow.webContents.on('did-navigate', (event, url) => {    // a pdf could contain a link ^^
            log.info("did-navigate")
            log.info(url)
        })
        this.bipwindow.webContents.on('will-navigate', (event, url) => {    // a pdf could contain a link ^^
            log.info("will-navigate")
            log.info(url)
        })

         this.bipwindow.webContents.on('new-window', (event, url) => {  // if a new window should open triggered by window.open()
            log.info("new-window")
            log.info(url)
            event.preventDefault();    // Prevent the new window from opening
        }); 
     
         
         this.bipwindow.webContents.setWindowOpenHandler(({ url }) => { // if a new window should open triggered by target="_blank"
            log.info("target: _blank")
            log.info(url)
            return { action: 'deny' };   // Prevent the new window from opening
        }); 

        this.bipwindow.webContents.on('will-redirect', (event, url) => {
            log.info('Redirecting to:', url);
            // Prüfen, ob die URL das gewünschte Format hat
            if (url.startsWith('bildungsportal://')) {
                event.preventDefault(); // Verhindert den Standard-Redirect
                const prefix = 'bildungsportal://token=';

                const token = url.substring(prefix.length);
                
    
                log.info('Captured Token:');
                log.info(token);
                this.mainwindow.webContents.send('bipToken', token);
                this.bipwindow.close();
            }
          });

    }















    createWindow() {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = { width: 1200, height: 800 };

        this.mainwindow = new BrowserWindow({
            title: 'Next-Exam-Teacher',
            backgroundColor: '#2e2c29',
            show: false,
            icon: join(__dirname, '../../public/icons/icon.png'),
            center:true,
            width: width,
            height: height,
            minWidth: 1200,
            minHeight: 800,
            webPreferences: {
                preload: join(__dirname, '../preload/preload.mjs'),
                // nodeIntegration: false,  
                // contextIsolation: true,  // Isoliert den Preload- und Renderer-Prozess
                spellcheck: false,
                webviewTag: true
            },
  
        })
        
        
        // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
        this.mainwindow.webContents.once('did-finish-load', () => {
            log.info('windowhandler @ createWindow: did-finish-load - showing window')
            if (this.mainwindow && !this.mainwindow.isVisible()) {
                this.mainwindow.show()
                this.mainwindow.moveTop();
            }
        })
        
        
        if (app.isPackaged || process.env["DEBUG"]) {
            const filePath = join(__dirname, '../renderer/index.html')
            log.info(`windowhandler @ createWindow: Loading file: ${filePath}`)
            this.mainwindow.removeMenu() 
            this.mainwindow.loadFile(filePath)
        } 
        else {
            const url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}`
            log.info(`windowhandler @ createWindow: Loading URL: ${url}`)
            this.mainwindow.removeMenu() 
            this.mainwindow.loadURL(url)
        }
    
        if (this.config.showdevtools) { this.mainwindow.webContents.openDevTools()  }
    
        this.mainwindow.webContents.session.setCertificateVerifyProc((request, callback) => {
            var { hostname, certificate, validatedCertificate, verificationResult, errorCode } = request;
            callback(0);
        });
    
        
        // Show window even if loading fails (Electron 39 compatibility)
        this.mainwindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            log.warn(`windowhandler @ createWindow: did-fail-load - Error ${errorCode}: ${errorDescription} for URL: ${validatedURL}`)
            // Still show the window even if loading failed
            if (this.mainwindow && !this.mainwindow.isVisible()) {
                log.info('windowhandler @ createWindow: Showing window after did-fail-load')
                this.mainwindow.show()
                this.mainwindow.moveTop();
            }
        })


        // Block navigation on mainwindow.webContents to avoid any navigation away from the app except for internal links
        this.mainwindow.webContents.on('will-navigate', (event, url) => {
            event.preventDefault(); // Prevent navigation away from the app
        });

        this.mainwindow.webContents.on('new-window', (event, url) => {
            event.preventDefault(); // Prevent new window from opening
        });

        this.mainwindow.webContents.setWindowOpenHandler(({ url }) => {
            return { action: 'deny' }; // Prevent new window from opening
        });


        this.mainwindow.on('close', async  (e) => {   //ask before closing
            if (!this.config.development && this.mainwindow?.webContents.getURL().includes("dashboard")) {
                // do not close a running exam by accident 
                log.info("windowhandler @ close: do not close running exam this way"); e.preventDefault(); 
                dialog.showMessageBoxSync(this.mainwindow, {
                    type: 'info', 
                    buttons: ['OK'], // Nur ein Button
                    defaultId: 0,
                    title: 'Prüfung läuft',
                    message: 'Beenden Sie zuerst die laufende Prüfung!'
                });
                return
            }
            else {
                app.quit()
                process.exit(0);
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
                preload: join(__dirname, '../preload/preload.mjs'),
            },
        });
    
        let url = `https://localhost:22422/server/control/oauth`
        this.authwindow.loadURL(url)
        if (this.config.showdevtools) { this.authwindow.webContents.openDevTools()  }
        // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
        this.authwindow.webContents.once('did-finish-load', () => {
            if (this.authwindow && !this.authwindow.isVisible()) {
                this.authwindow.removeMenu() 
                this.authwindow.setMinimizable(false)
                this.authwindow.show()
                this.authwindow.moveTop();
            }
        })
    }
}

export default new WindowHandler()
 