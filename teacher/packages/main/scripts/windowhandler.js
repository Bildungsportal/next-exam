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

        this.bipwindow.once('ready-to-show', () => {
            this.bipwindow.show()
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
        const { width, height } = primaryDisplay ? primaryDisplay.workAreaSize : { width: 800, height: 800 };

        this.mainwindow = new BrowserWindow({
            title: 'Next-Exam-Teacher',
            backgroundColor: '#2e2c29',
            show: false,
            icon: join(__dirname, '../../public/icons/icon.png'),
            center:true,
            width: width,
            height: height,
            minWidth: 800,
            minHeight: 800,
            webPreferences: {
                preload: join(__dirname, '../preload/preload.mjs'),
                // nodeIntegration: false,  
                // contextIsolation: true,  // Isoliert den Preload- und Renderer-Prozess
                spellcheck: false
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
    
    
        // this.mainwindow.on('app-command', (e, cmd) => {
        //     // 'browser-backward' und 'browser-forward' sind die Befehle, die beim Klick auf die Maustasten gesendet werden
        //     if (cmd === 'browser-backward' || cmd === 'browser-forward') {
        //         log.warn("no indirect navigation allowed")
        //         e.preventDefault(); // Verhindern Sie das Standardverhalten
        //     }
        // });


        this.mainwindow.once('ready-to-show', () => {
            this.mainwindow?.show()
            this.mainwindow?.moveTop();
        })

        this.mainwindow.on('close', async  (e) => {   //ask before closing
            if (!this.config.development) {
                if (this.mainwindow.closetriggered) { app.quit(); return;}
                if (this.mainwindow?.webContents.getURL().includes("dashboard")){
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
                else {
                    this.mainwindow.closetriggered = true
                    app.quit()
                }
            }
            else {
                app.quit()
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
        this.authwindow.once('ready-to-show', () => {
            this.authwindow?.removeMenu() 
            this.authwindow?.setMinimizable(false)
            this.authwindow?.show()
            this.authwindow?.moveTop();
        })
    }
}

export default new WindowHandler()
 