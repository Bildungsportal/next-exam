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


import fs from 'fs';
import { app, BrowserWindow, dialog, screen } from 'electron'
import { join } from 'path'
import path from 'path'
import { fileURLToPath } from 'node:url'
import log from 'electron-log'
import i18n from '../../../src/locales/locales.js'

const { t } = i18n.global
const __dirname = import.meta.dirname

// Base path for public assets (icons, etc.): packaged = app.asar.unpacked/public, dev = project public
export function getPublicBase() {
  if (app.isPackaged) {
    const unpacked = join(process.resourcesPath, 'app.asar.unpacked', 'public');
    return fs.existsSync(unpacked) ? unpacked : join(process.resourcesPath, 'app.asar.unpacked');
  }
  return join(__dirname, '../../public');
}




// Renderer built into public/ (one copy); when packaged use app.asar.unpacked/public
export function getRendererIndexPath() {
  if (app.isPackaged) {
    const unpacked = join(process.resourcesPath, 'app.asar.unpacked', 'public', 'index.html');
    if (fs.existsSync(unpacked)) return unpacked;
  }
  const publicPath = join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicPath)) return publicPath;
  const distRendererPath = join(__dirname, 'dist', 'renderer', 'index.html');
  if (fs.existsSync(distRendererPath)) return distRendererPath;
  const quasarPath = join(__dirname, 'index.html');
  if (fs.existsSync(quasarPath)) return quasarPath;
  return join(__dirname, '../renderer/index.html');
}

class WindowHandler {
    constructor () {
      this.mainwindow = null
      this.authwindow = null
      this.config = null
      this.multicastClient = null
      this.multicastServer = null
      this.bipAuthPending = null
  
    }

    init (mc, config) {
        this.multicastClient = mc
        this.config = config
    }

    getBiPUrl(biptest) {
        if (this.config.bipDemo) {
            return this.config.bipApiUrl;
        } else if (biptest) {
            return `https://q.bildung.gv.at`;
        } else {
            return `https://bildung.gv.at`;
        }
    }

    createBiPLoginWin(biptest) {
        if (this.bipwindow && !this.bipwindow.isDestroyed()) {
            this.bipwindow.close()
        }
        this.bipwindow = new BrowserWindow({
            title: 'Next-Exam',
            icon: join(getPublicBase(), 'icons', 'icon.png'),
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
        
        this.bipwindow.loadURL(this.getBiPUrl(biptest)+`/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam`)

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
            // Check whether the URL has the expected format
            if (url.startsWith('bildungsportal://')) {
                event.preventDefault(); // Prevents the default redirect
                const prefix = 'bildungsportal://token=';

                const token = url.substring(prefix.length);
                
    
                log.info('Captured Token:');
                log.info(token);
                if (this.bipAuthPending) {
                    this.bipAuthPending.resolve(token)
                    this.clearBipAuthPendingState()
                } else {
                    this.mainwindow.webContents.send('bipToken', token);
                }
                this.bipwindow.close();
            }
          });

        this.bipwindow.on('closed', () => {
            this.bipwindow = null
            this.abortBipAuthPending('BIP_AUTH_CANCELLED')
        })
    }

    /** Clears pending auth wait without rejecting (success path). */
    clearBipAuthPendingState() {
        if (!this.bipAuthPending) return
        if (this.bipAuthPending.timeout) clearTimeout(this.bipAuthPending.timeout)
        this.bipAuthPending = null
    }

    /** Rejects pending BiP auth wait (window closed, timeout, superseded). */
    abortBipAuthPending(code = 'BIP_AUTH_CANCELLED') {
        if (!this.bipAuthPending) return
        const pending = this.bipAuthPending
        this.bipAuthPending = null
        if (pending.timeout) clearTimeout(pending.timeout)
        pending.reject(new Error(code))
    }

    /** Opens BiP login and resolves with captured token (signature verify flow). */
    waitForBipAuthToken(biptest, timeoutMs = 300000) {
        return new Promise((resolve, reject) => {
            if (this.bipAuthPending) {
                const winAlive = this.bipwindow && !this.bipwindow.isDestroyed()
                if (!winAlive) {
                    this.abortBipAuthPending('BIP_AUTH_CANCELLED')
                } else {
                    this.bipwindow.focus()
                    reject(new Error('BIP_AUTH_PENDING'))
                    return
                }
            }
            const timeout = setTimeout(() => {
                if (!this.bipAuthPending) return
                this.bipAuthPending = null
                try {
                    if (this.bipwindow && !this.bipwindow.isDestroyed()) {
                        this.bipwindow.close()
                    }
                } catch {
                    // ignore close errors
                }
                reject(new Error('BIP_LOGIN_TIMEOUT'))
            }, timeoutMs)
            this.bipAuthPending = {
                timeout,
                resolve: (token) => {
                    clearTimeout(timeout)
                    this.clearBipAuthPendingState()
                    resolve(token)
                },
                reject: (err) => {
                    clearTimeout(timeout)
                    this.bipAuthPending = null
                    reject(err)
                },
            }
            this.createBiPLoginWin(biptest)
        })
    }










    installVueJsDevTools(win) {
        if (!app.isPackaged) {
            // Dev-only: keep optional dependency out of release builds.
            import('electron-devtools-installer')
                .then((m) => m.installExtension(m.VUEJS_DEVTOOLS))
                .then((name) => log.info(`windowhandler @ devtools: Added Extension: ${name.name}`))
                .catch((err) => log.warn(`windowhandler @ devtools: install skipped: ${err?.message || err}`));
        }
    }





    createWindow() {
        const { width, height } = { width: 1400, height: 800 }
        const currentDir = fileURLToPath(new URL('.', import.meta.url))

        this.mainwindow = new BrowserWindow({
            title: 'Next-Exam-Teacher',
            backgroundColor: '#2e2c29',
            show: false,
            icon: join(getPublicBase(), 'icons', 'icon.png'),
            center: true,
            width: width,
            height: height,
            minWidth: 1280,
            minHeight: 800,
            webPreferences: {
                preload: process.env.QUASAR_ELECTRON_PRELOAD_FOLDER
                    ? path.resolve(currentDir, path.join(process.env.QUASAR_ELECTRON_PRELOAD_FOLDER, 'electron-preload' + (process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION || '.cjs')))
                    : join(__dirname, '../preload/preload.mjs'),
                spellcheck: false,
                webviewTag: true
            }
        })

        this.installVueJsDevTools(this.mainwindow);

        // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
        this.mainwindow.webContents.once('did-finish-load', () => {
            log.info('windowhandler @ createWindow: did-finish-load - showing window')
            if (this.mainwindow && !this.mainwindow.isVisible()) {
                this.mainwindow.show()
                this.mainwindow.moveTop()
            }
        })

        if (app.isPackaged || process.env['DEBUG']) {
            const filePath = getRendererIndexPath();
            log.info(`windowhandler @ createWindow: Loading file: ${filePath}`)
            this.mainwindow.removeMenu()
            this.mainwindow.loadFile(filePath)
        } else {
            const url = process.env.APP_URL || `http://${process.env['VITE_DEV_SERVER_HOST'] || 'localhost'}:${process.env['VITE_DEV_SERVER_PORT'] || '9300'}`
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
                    buttons: [t('general.ok')],
                    defaultId: 0,
                    title: t('general.examRunningTitle'),
                    message: t('general.endRunningExamFirst')
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
        const currentDir = fileURLToPath(new URL('.', import.meta.url))
        this.authwindow = new BrowserWindow({
            show: false,
            center: true,
            title: 'OAuth',
            width: 500,
            height: 800,
            minimizable: false,
            icon: join(getPublicBase(), 'icons', 'icon.png'),
            webPreferences: {
                preload: process.env.QUASAR_ELECTRON_PRELOAD_FOLDER
                    ? path.resolve(currentDir, path.join(process.env.QUASAR_ELECTRON_PRELOAD_FOLDER, 'electron-preload' + (process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION || '.cjs')))
                    : join(__dirname, '../preload/preload.mjs')
            }
        })
    
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
 
