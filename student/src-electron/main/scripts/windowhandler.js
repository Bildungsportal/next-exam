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
import { app, BrowserWindow, BrowserView, dialog, screen} from 'electron'
import { join } from 'path'
import {disableRestrictions, enableRestrictions} from './platformrestrictions.js';
import log from 'electron-log'
import {SchedulerService} from './schedulerservice.ts'
import platformDispatcher from './platformDispatcher.js';
import i18n from '../../../src/locales/locales.js';
import {fileURLToPath} from "node:url";
import path from 'path';

const __dirname = import.meta.dirname;

// Renderer built into public/ (one copy); when packaged use app.asar.unpacked/public
function getRendererIndexPath() {
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




  ////////////////////////////////////////////////////////////
 // Window handling (ipcRenderer Process - Frontend) START
////////////////////////////////////////////////////////////


class WindowHandler {
    constructor () {
      this.screenlockwindows = []
      this.mainwindow = null
      this.examwindow = null
      this.bipwindow = null
      this.config = null
      this.multicastClient = null
    
      this.exitWarningOpen = false  // track if exit warning dialog is open
      this.exitQuestionOpen = false  // track if exit question dialog is open
      this.cageExitWarningOpen = false
      this.minimizeWarningOpen = false  // track if minimize warning dialog is open
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

    installVueJsDevTools() {
        if (!app.isPackaged) {
            // Dev-only: keep optional dependency out of release builds.
            import('electron-devtools-installer')
                .then((m) => m.installExtension(m.VUEJS_DEVTOOLS))
                .then((name) => log.info(`windowhandler @ devtools: Added Extension: ${name.name}`))
                .catch((err) => log.warn(`windowhandler @ devtools: install skipped: ${err?.message || err}`));
        }
    }

    createBiPLoginWin(biptest) {
        this.bipwindow = new BrowserWindow({
            title: 'Next-Exam',
            icon: join(platformDispatcher.publicBase, 'icons', 'icon.png'),
            center:true,
            width: 1000,
            height:800,
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
            log.info("windowhandler @ createBiPLoginWin: did-navigate")
            log.info(url)
        })
        this.bipwindow.webContents.on('will-navigate', (event, url) => {    // a pdf could contain a link ^^
            log.info("windowhandler @ createBiPLoginWin: will-navigate")
            log.info(url)
        })

         this.bipwindow.webContents.on('new-window', (event, url) => {  // if a new window should open triggered by window.open()
            log.info("windowhandler @ createBiPLoginWin: new-window")
            log.info(url)
            event.preventDefault();    // Prevent the new window from opening
        }); 
     
         
         this.bipwindow.webContents.setWindowOpenHandler(({ url }) => { // if a new window should open triggered by target="_blank"
            log.info("windowhandler @ createBiPLoginWin: target: _blank")
            log.info(url)
            return { action: 'deny' };   // Prevent the new window from opening
        }); 

        this.bipwindow.webContents.on('will-redirect', (event, url) => {
            log.info('windowhandler @ createBiPLoginWin: Redirecting to:', url);
            // Check whether the URL has the expected format
            if (url.startsWith('bildungsportal://')) {
                event.preventDefault(); // Prevents the default redirect
                const prefix = 'bildungsportal://token=';

                const token = url.substring(prefix.length);
                
    
                log.info('windowhandler @ createBiPLoginWin: Captured Token:');
                log.info('windowhandler @ createBiPLoginWin: ' + token);
                this.mainwindow.webContents.send('bipToken', token);
                this.bipwindow.close();
            }
          });

    }


    /**
     * this is an easter egg
     */
    createEasterWin() {
        this.easterwin = new BrowserWindow({
            title: 'Next-Exam',
            icon: join(platformDispatcher.publicBase, 'icons', 'icon.png'),
            center:true,
            width: 768,
            height:480,
            alwaysOnTop: true,
            skipTaskbar:true,
            autoHideMenuBar: true,
            resizable: false,
            minimizable: false,
            movable: false,
            frame: true,
            show: false,
            transparent: false
        })
     
        this.easterwin.loadFile(join(platformDispatcher.publicBase, 'cowsonice', 'index.html'))

        // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
        this.easterwin.webContents.once('did-finish-load', () => {
            if (this.easterwin && !this.easterwin.isVisible()) {
                this.easterwin.show()
            }
        });
    }


















    /**
     * Screenlock Window (to cover the mainscreen) - block students from working
     * @param display 
     */
    createScreenlockWindow(display) {
        let screenlockWindow = new BrowserWindow({
            show: false,
            x: display.bounds.x + 0,
            y: display.bounds.y + 0,
            // parent: this.mainwindow,   // leads to visible titlebar in gnome-desktop
            skipTaskbar:true,
            title: 'Screenlock',
            width: display.bounds.width,
            height: display.bounds.height,
            closable: false,
            alwaysOnTop: true,
            //focusable: false,   //doesn't work with kiosk mode (no kiosk mode possible.. why?)
            minimizable: false,
            // resizable:false, // leads to weird 20px bottomspace on windows
            movable: false,
            frame: false,
            icon: join(platformDispatcher.publicBase, 'icons', 'icon.png'),
            webPreferences: {
                preload: join(__dirname, './preload/electron-preload.cjs'),
            },
        });

        let url = "lock"
        if (app.isPackaged) {
            screenlockWindow.loadFile(getRendererIndexPath(), {hash: `#/${url}/`})
        } 
        else {
            url = `${process.env.APP_URL}/#/${url}/`
            screenlockWindow.loadURL(url)
        }

        if (this.config.showdevtools) { screenlockWindow.webContents.openDevTools()  }

        // Add window to array first, before adding blur listener
        this.screenlockwindows.push(screenlockWindow)

        // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
        screenlockWindow.webContents.once('did-finish-load', () => {
            if (!screenlockWindow) return;
            
            screenlockWindow.removeMenu() 
            screenlockWindow.setMinimizable(false)
            platformDispatcher.applyElectronKioskMode(screenlockWindow)
            screenlockWindow.setAlwaysOnTop(true, "pop-up-menu", 1)   //above exam window (pop-up-menu, 0)
            screenlockWindow.show()
            screenlockWindow.moveTop();
            screenlockWindow.setClosable(true)
            screenlockWindow.setVisibleOnAllWorkspaces(true); // put the window on all virtual workspaces
            this.addBlurListener("screenlock")
        })

        screenlockWindow.on('close', async  (e) => {   // window should not be closed manually.. ever! but if you do make sure to clean examwindow variable and end exam for the client
            if (!this.config.development) { e.preventDefault(); }  
        });

        screenlockWindow.on('closed', () => {   // remove window from array when actually closed
            this.screenlockwindows = this.screenlockwindows.filter(win => win && win !== screenlockWindow && !win.isDestroyed())
        });
    }




















    /**
     * Examwindow
     * @param examtype eduvidual, math, language
     * @param token student token
     * @param serverstatus the serverstatus object containing info about spellcheck language etc.
     */
    async createExamWindow(examtype, token, serverstatus, primarydisplay) {
        if (this._examWindowCreating || (this.examwindow && !this.examwindow.isDestroyed?.())) {
            log.warn('windowhandler @ createExamWindow: examwindow already exists, skip duplicate create');
            try {
                this.examwindow.show();
                this.examwindow.focus();
            } catch (e) {
                log.debug('windowhandler @ createExamWindow: focus existing examwindow', e?.message);
            }
            return;
        }
        // just to be sure we check some important vars here
        if (examtype !== "rdp" && examtype !== "website" &&  examtype !== "forms" && examtype !== "eduvidual" && examtype !== "editor" && examtype !== "math" && examtype !== "microsoft365" && examtype !== "activesheets" && examtype !== "localvm" || !token){  // for now.. we probably should stop everything here
            log.warn("missing parameters for exam-mode or mode not in allowed list!");
            examtype = "editor";
        }

        // Always use primary display for exam window
        if (!primarydisplay || !primarydisplay.bounds || !primarydisplay.id) {
            primarydisplay = screen.getPrimaryDisplay()
            if (!primarydisplay || !primarydisplay.bounds) {
                const displays = screen.getAllDisplays()
                primarydisplay = displays[0] || primarydisplay
            }
        }

        let px = 0
        let py = 0
        if (primarydisplay && primarydisplay.bounds && primarydisplay.bounds.x) {
            px = primarydisplay.bounds.x
            py = primarydisplay.bounds.y
        }

        this._examWindowCreating = true;
        try {
        if (examtype === "microsoft365"  ) { //external page

            this.examwindow = new BrowserWindow({
                x: px + 0,
                y: py + 0,
                title: 'Exam',
                width: 1440,
                height: 768,
                // parent: win,  //this doesnt work together with kiosk on ubuntu gnome ?? wtf
                // modal: true,  // this blocks the main window on windows while the exam window is open
                // closable: false,  // if we can't define 'parent' this window has to be closable - why?
                //alwaysOnTop: true,
                opacity: 1,
                skipTaskbar:true,
                autoHideMenuBar: true,
                minimizable: false,
                visibleOnAllWorkspaces: true,
                // kiosk: this.config.development ? false : true,  // prevents kiosk mode on ubuntu gnome (Unity)
                show: true,
                transparent: false,
                icon: join(platformDispatcher.publicBase, 'icons', 'icon.png'),
                webPreferences: {
                    preload: join(__dirname, './preload/electron-preload.cjs'),
                    spellcheck: false,
                    contextIsolation: true,
                    webviewTag: true,
                    webSecurity: false
                }
            });
        } else {
            this.examwindow = this.mainwindow
        }


            // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
            this.examwindow.webContents.once('did-finish-load', async () => {
                if (!this.examwindow) return;
                if (this.config.showdevtools) { this.examwindow.webContents.openDevTools()  }
                if (!this.config.development) {
                    try {
                        this.examwindow.removeMenu()
                        platformDispatcher.applyElectronKioskMode(this.examwindow);

                        await this.sleep(500)
                        this.examwindow.moveTop()
                        this.examwindow.focus()

                        if (!platformDispatcher.skipElectronKiosk) {
                            this.examwindow.setAlwaysOnTop(true, "screen-saver", 1)
                            await enableRestrictions(this)
                            await this.sleep(1000)
                            this.addBlurListener()
                        }
                    }
                    catch(e){ log.error("windowhandler @ did-finish-load: error in examwindow setup", e)}
                }
            })


            this.examwindow.serverstatus = serverstatus //we keep it there to make it accessable via examwindow in ipcHandler
            this.examwindow.menuHeight = 94   // start position for the content view


            /**
             * Microsoft 365 emebeds its editor in an iframe with active Content Security Policy (CSP)
             * The only way to be able to inject code is to load it directly in the main window <embed> <iframe> or even <webview> offers no workaround
             * therefore we use "BrowserView" in order to display two pages in one window: on top > exam header, on bottom > office
             */

            if (examtype === "microsoft365"  ) { //external page
                log.info("starting microsoft365 exam...")
                let urlview = this.multicastClient.clientinfo.msofficeshare
                if (!urlview) {// we wait for the next update tick - msofficeshare needs to be set ! (could happen when a student connects later then exam mode is set but his share url needs some time)
                    log.warn("windowhandler @ createExamWindow: no url for microsoft365 was set yet - waiting for next update tick")

                    this.examwindow.destroy();
                    this.examwindow = null;
                    disableRestrictions(this.examwindow)
                    this.multicastClient.clientinfo.exammode = false
                    this.multicastClient.clientinfo.focus = true
                    return
                }
                // load top menu in MainPage
                let url = examtype   // editor || math || eduvidual || tbd.
                if (app.isPackaged) {
                    this.examwindow.loadFile(getRendererIndexPath(), {hash: `#/${url}/${token}`})
                }
                else {
                    let backgroundurl = `${process.env.APP_URL}/#/${url}/${token}/`
                    this.examwindow.loadURL(backgroundurl);
                }
                // Define the MainContentPage view
                let contentView = new BrowserView({
                    webPreferences: {
                        spellcheck: false,
                        contextIsolation: true,
                    }
                });

                contentView.setBounds({
                    x: 0,
                    y: this.examwindow.menuHeight,
                    width: this.examwindow.getBounds().width,
                    height: this.examwindow.getBounds().height - this.examwindow.menuHeight
                });
                contentView.setAutoResize({ width: true, height: true, horizontal: true, vertical: true });
                contentView.webContents.loadURL(urlview);
                if (this.config.showdevtools) {       contentView.webContents.openDevTools() }

                this.examwindow.addBrowserView(contentView);

                this.examwindow.on('enter-full-screen', () => {
                    this.examwindow.setBrowserView(contentView);

                    let newBounds = this.examwindow.getBounds();
                    contentView.setBounds({
                        x: 0,
                        y: this.examwindow.menuHeight,
                        width: newBounds.width,
                        height: newBounds.height - this.examwindow.menuHeight
                    });
                });

                this.examwindow.on('resize', () => {
                    let newBounds = this.examwindow.getBounds();
                    contentView.setBounds({
                        x: 0,
                        y: this.examwindow.menuHeight,
                        width: newBounds.width,
                        height: newBounds.height - this.examwindow.menuHeight
                    });
                });
            }
            // this is the normal exam mode (editor, math, eduvidual, website, forms, activesheets, localvm)
            else {
                let url = examtype   // editor || math || tbd.
                if (app.isPackaged) {
                    this.examwindow.loadFile(getRendererIndexPath(), {hash: `#/${url}/${token}`})
                }
                else {
                    url = `${process.env.APP_URL}/#/${url}/${token}/`
                    this.examwindow.loadURL(url)
                }
            }



            /**
             * Handle special NAVIGATION situations
             */


            /***************************
             *  Forms, Website, Eduvidual, Editor, RDP, Microsoft365
             ***************************/
                // Block navigation on examwindow.webContents level for all modes that can display PDFs in examheader
                // This prevents navigation when clicking links in PDFs displayed in the examheader
                // Webview/BrowserView blocking is handled separately via IPC in ipchandler.js or mode-specific handlers below
            const examTypesWithPdfInHeader = ["forms", "website", "eduvidual", "editor", "rdp", "microsoft365", "activesheets", "math", "localvm"];
            if (examTypesWithPdfInHeader.includes(serverstatus.examSections[serverstatus.lockedSection].examtype)) {
                this.examwindow.webContents.on('will-navigate', (event, url) => {
                    event.preventDefault(); // Prevent navigation away from the Vue app (e.g. from PDF links in examheader)
                });

                // Prevent new windows from opening in the examwindow
                this.examwindow.webContents.on('new-window', (event, url) => {
                    log.warn("windowhandler @ examwindow: blocked new-window", url);
                    event.preventDefault();
                });

                this.examwindow.webContents.setWindowOpenHandler(({ url }) => {
                    log.warn("windowhandler @ examwindow: blocked setWindowOpenHandler", url);
                    return { action: 'deny' };
                });
            }

            /***************************
             *  Microsoft Excel/Word
             ***************************/
            let effectiveSection = serverstatus.allowSectionSwitch ? this.multicastClient.clientinfo.lockedSection : serverstatus.lockedSection;
            if ( serverstatus.examSections[effectiveSection].examtype === "microsoft365"){  // do not under any circumstances allow navigation away from the current exam url
                const browserView = this.examwindow.getBrowserView(0);

                // if the user wants to navigate away from this page
                browserView.webContents.on('will-navigate', (event, url) => {
                    if (url !== this.multicastClient.clientinfo.msofficeshare ) {
                        log.warn("do not navigate away from this test.. ")
                        event.preventDefault()
                    }
                })

                // if a new window should open triggered by window.open()
                browserView.webContents.on('new-window', (event, _) => { event.preventDefault();   }); // Prevent the new window from opening

                // if a new window should open triggered by target="_blank"
                browserView.webContents.setWindowOpenHandler(({ _ }) => { return { action: 'deny' };   }); // Prevent the new window from opening

                let executeCode =  `
                    function lock(){
                        // 'WACDialogOuterContainer','WACDialogInnerContainer','WACDialogPanel',
                        const hideusByID = ['ShowHideEquationToolsPane','LinkGroup','GraphicsEditor','InsertTableOfContentsInInsertTab','InsertOnlinevideo','Picture','Ribbon-PictureMenuMLRDropdown','InsertAddInFlyout','Designer','Editor','FarPane','Help','InsertAppsForOffice','FileMenuLauncherContainer','Help-wrapper','Review-wrapper','Header','FarPeripheralControlsContainer','BusinessBar']
                        for (entry of hideusByID) {
                            let element = document.getElementById(entry)
                            if (element) { 
                                element.style.display = "none" 
                                element.style.setProperty("display", "none", "important");
                            }
                        }

                        let buttonAppsOverflow = document.getElementsByName('Add-Ins')[0];  // this button is redrawn on resize (doesn't happen in exam mode but still there must be a cleaner way - inserting css before it appears is not working)
                        if (buttonAppsOverflow){ buttonAppsOverflow.style.display = "none" }

                        let elements = document.querySelectorAll('[aria-label="Suchen"]');
                        elements.forEach(element => { element.style.display = 'none';});
                        elements = document.querySelectorAll('[aria-label="Übersetzen"]');
                        elements.forEach(element => { element.style.display = 'none';});
                        elements = document.querySelectorAll('[aria-label="Copilot"]');
                        elements.forEach(element => { element.style.display = 'none'; });
                        elements = document.querySelectorAll('[aria-label="Add-Ins"]');
                        elements.forEach(element => { element.style.display = 'none'; });
                        elements = document.querySelectorAll('[data-unique-id="ContextMenu-SmartLookupContextMenu"]');
                        elements.forEach(element => {element.style.display = 'none';});
                        elements = document.querySelectorAll('[data-unique-id="ContextMenu-SmartLookupSynonyms"]');
                        elements.forEach(element => {element.style.display = 'none'; });
                        elements = document.querySelectorAll('[data-unique-id="Ribbon-ReferencesSmartLookUp"]');
                        elements.forEach(element => {element.style.display = 'none';});
                        elements = document.querySelectorAll('[data-unique-id="Dictation"]');
                        elements.forEach(element => { element.style.display = 'none'; });
                        elements = document.querySelectorAll('[data-unique-id="GetAddins"]');
                        elements.forEach(element => { element.style.display = 'none'; });
                        elements = document.querySelectorAll('[data-unique-id="Pictures_MLR"]');
                        elements.forEach(element => { element.style.display = 'none'; });  
                    }
                    lock()  //for some reason excel delays that call.. doesnt happen on page finish load
                    `

                let schedulerInstance = null
                this.lockCallback = () => this.lock365(browserView, executeCode, schedulerInstance);
                schedulerInstance = new SchedulerService(this.lockCallback, 400)
                this.lockScheduler = schedulerInstance
                schedulerInstance.start()
                // Wait until the webContents is fully loaded  // this is not working reliably because the page is loaded in many steps and the ui elements are not available yet
                browserView.webContents.on('did-finish-load', async () => {
                    browserView.webContents.mainFrame.frames.filter((frame) => {
                        if (frame) {
                            frame.executeJavaScript(executeCode);
                        }
                    })
                });
            }

            this.examwindow.on('app-command', (e, cmd) => {
                // 'browser-backward' und 'browser-forward' sind die Befehle, die beim Klick auf die Maustasten gesendet werden
                if (cmd === 'browser-backward' || cmd === 'browser-forward') {
                    log.warn("no navigation allowed")
                    e.preventDefault(); // Verhindern Sie das Standardverhalten
                }
            });

            this.examwindow.on('close', async  (e) => {   // window should not be closed manually.. ever! but if you do make sure to clean examwindow variable and end exam for the client
                if (this.multicastClient.clientinfo.exammode) {
                    if (!this.config.development) { e.preventDefault(); }
                }
                else {
                    this.examwindow.destroy();
                    this.examwindow = null;
                    //disableRestrictions(this.examwindow)  //do not disable twice
                    this.multicastClient.clientinfo.exammode = false
                    this.multicastClient.clientinfo.focus = true
                }
            });
        } finally {
            this._examWindowCreating = false;
        }
    }



    async lock365(browserView, executeCode, schedulerInstance){
        if (browserView.webContents && browserView.webContents.mainFrame){
            browserView.webContents.mainFrame.frames.filter((frame) => {
                //log.info("found frame", frame.name)
                if (frame && (frame.name === 'WebApplicationFrame' || frame.name === 'WacFrame_Word_0' || frame.name === 'WacFrame_Excel_0')) {
                    //log.info("found frame")
                    frame.executeJavaScript(executeCode); 
                }
            })
        }
        else if (schedulerInstance) {
            log.info("windowhandler @ lock365: stopping lockScheduler")
            schedulerInstance.stop()
            if (this.lockScheduler === schedulerInstance) {
                this.lockScheduler = null
            }
        }
        else {
            log.error("windowhandler @ lock365: no browserView or lockScheduler found")
        }
    }














    

    /****************************
     * MAIN WINDOW
     ***************************/
    async createMainWindow() {
        let primarydisplay = screen.getPrimaryDisplay()
        const currentDir = fileURLToPath(new URL('.', import.meta.url));
        if (!primarydisplay || !primarydisplay.bounds) {
            primarydisplay = screen.getAllDisplays()[0]
        }

        // Window dimensions - defined once, used everywhere
        const windowWidth = 1024
        const windowHeight = 640

        // Calculate center position on primary display
        let x = 0
        let y = 0
        if (primarydisplay && primarydisplay.bounds) {
            x = primarydisplay.bounds.x + Math.floor((primarydisplay.bounds.width - windowWidth) / 2)
            y = primarydisplay.bounds.y + Math.floor((primarydisplay.bounds.height - windowHeight) / 2)
        }

        this.mainwindow = new BrowserWindow({
            title: 'Next-Exam-Student',
            icon: join(platformDispatcher.publicBase, 'icons', 'icon.png'),
            x: x,
            y: y,
            width: windowWidth,
            height: windowHeight,
            minWidth: 850,
            minHeight: 600,
            resizable: false, // prevents resizing
            fullscreenable: false, // prevents fullscreen mode - important for macOS: when the mainwindow is fullscreen on macOS the kiosk mode does not take effect on the examwindow - electron bug (needs example code): >> https://github.com/electron/electron/issues/44755
            show: true,
            //visibleOnAllWorkspaces: true,
            
           
            webPreferences: {
                preload: path.resolve(
                    currentDir,
                    path.join(process.env.QUASAR_ELECTRON_PRELOAD_FOLDER, 'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION)
                ),
                spellcheck: false,
                backgroundThrottling: true  // allow throttling when window is in background
            }
        })

        this.installVueJsDevTools();

        // Register event handlers before loading
        this.mainwindow.on('close', async  (e) => {   // ask before closing
            if (!this.config.development && !this.mainwindow.allowexit) {  // allowexit ist ein override vom context menu oder screenshot test. dieser kann die app schliessen
                if (platformDispatcher.runningInCage) {
                    e.preventDefault();
                    await this.showCageExitWarning();
                    return;
                }
                if (this.multicastClient.clientinfo.token){
                    const allowTray = !platformDispatcher._isGNOME(); // GNOME has no legacy tray
                    if (!allowTray) { 
                        log.warn(`windowhandler @ createMainWindow: GNOME detected, quitting instead of tray minimize`);
                        this.mainwindow.allowexit = true;  // allow close flow
                        return;
                    }
                   
                    e.preventDefault();
                    await this.showMinimizeWarning()
                    log.warn(`windowhandler @ createMainWindow: Minimizing Next-Exam to Systemtray`)  
                    this.mainwindow.hide();
                    return;
                }
            }
        });

        // Set window properties immediately after creation
        this.mainwindow.removeMenu()
        this.mainwindow.focus()
        this.mainwindow.moveTop()
        //this.mainwindow.setHiddenInMissionControl(true)

        if (this.config.showdevtools) { this.mainwindow.webContents.openDevTools()  }

        if (app.isPackaged || process.env["DEBUG"]) {
            const filePath = getRendererIndexPath();
            log.info(`windowhandler @ createMainWindow: Loading file: ${filePath}`)
            this.mainwindow.loadFile(filePath)
        }
        else {
            const url = `${process.env.APP_URL}`
            log.info(`windowhandler @ createMainWindow: Loading URL: ${url}`)
            this.mainwindow.loadURL(url)
        }

    }












    async showExitWarning(message){
        this.exitWarningOpen = true
        this.mainwindow.allowexit = true
        try {
            await dialog.showMessageBox(this.mainwindow, {
                type: 'warning',
                buttons: ['Ok'],
                title: 'Programm Beenden',
                message: message,
                cancelId: 1
            });
            app.quit()
        } finally {
            this.exitWarningOpen = false
        }
    }

    // Block window close in cage/kiosk until user confirms they cannot continue without re-login.
    async showCageExitWarning() {
        if (this.cageExitWarningOpen) return;
        this.cageExitWarningOpen = true;
        const t = (k) => i18n.global.t(k);
        const isWin = platformDispatcher.platform === 'win32';
        try {
            const choice = await dialog.showMessageBox(this.mainwindow, {
                type: 'warning',
                buttons: [t('student.cageExit'), t('dashboard.cancel')],
                defaultId: 1,
                cancelId: 1,
                title: t('student.cageExitWarnTitle'),
                message: t('student.cageExitWarnTitle'),
                detail: t(isWin ? 'student.cageExitWarnWindows' : 'student.cageExitWarnLinux').replace(/<[^>]+>/g, ''),
            });
            if (choice.response === 0) {
                this.mainwindow.allowexit = true;
                app.quit();
            }
        } finally {
            this.cageExitWarningOpen = false;
        }
    }

    async showExitQuestion(){
        if (this.exitQuestionOpen) {
            log.info("Windowhandler @ showExitQuestion: dialog already open, skipping")
            return
        }
        this.exitQuestionOpen = true
        try {
            let choice = await dialog.showMessageBox(this.mainwindow, {
                type: 'question',
                buttons: ['Ja', 'Nein'],
                title: 'Programm beenden',
                message: 'Wollen sie die Anwendung Next-Exam beenden?',
                cancelId: 1
            });
            if(choice.response === 1){
                log.info("Windowhandler @ showExitQuestion: do not close Next-Exam after finished Exam")
            }
            else {
                this.mainwindow.allowexit = true
                app.quit()
            }
        } finally {
            this.exitQuestionOpen = false
        }
    }

    async showMinimizeWarning(){
        this.minimizeWarningOpen = true
        try {
            await dialog.showMessageBox(this.mainwindow, {
                type: 'info',
                buttons: ['OK'],
                title: 'Minimize to System Tray',
                message: 'Die Anwendung Next-Exam wurde minimiert!',
        
            });
        } finally {
            this.minimizeWarningOpen = false
        }
    }



    /**
     * Additional Functions
     */

    isWayland(){
        return process.env.XDG_SESSION_TYPE === 'wayland'; 
    }

    //adds blur listener when entering exammode   // blur event isnt fired on macos MISSIONCONTROL (which cant be deactivated anymore) - damn you apple!
    addBlurListener(window = "examwindow"){
        if (platformDispatcher.runningInCage) {
            return;
        }
        if (window === "examwindow"){ 
            log.info(`windowhandler @ addBlurListener: Setting Blur Event for ${window}`)
            this.examwindow.addListener('blur', () => this.blurevent(this)) 
        }
        else if (window === "screenlock") {
            log.info(`windowhandler @ addBlurListener: Setting Blur Event for ${window}window`)
            for (let screenlockwindow of this.screenlockwindows){
                screenlockwindow.addListener('blur', () => this.blureventScreenlock(this))   
            }
        }
    }
    //removes blur listener when leaving exam mode
    removeBlurListener(){
        if (this.examwindow){
            this.examwindow.removeAllListeners('blur')
            log.info("windowhandler @ removeBlurListener: removing blur listener")
        }
    }
    // implementing a sleep (wait) function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    //student fogus went to another window
    async blurevent(winhandler) { 

        log.info("windowhandler @ blurevent: student tried to leave exam window")

        // Clean up destroyed screenlock windows from array and check if any still exist
        winhandler.screenlockwindows = winhandler.screenlockwindows.filter(win => win && !win.isDestroyed())
        const hasActiveScreenlock = winhandler.screenlockwindows.some(win => win && !win.isDestroyed() && win.isVisible())
        // Also check clientinfo.screenlock flag as fallback in case array was cleared but windows still exist
        if (hasActiveScreenlock || winhandler.multicastClient?.clientinfo?.screenlock) { return }// do nothing if screenlockwindow stole focus // do not trigger an infinite loop between exam window and screenlock window (stealing each others focus because screenlockwindow appears above exam window and will capture a klick and therefore steal focus)

        winhandler.multicastClient.clientinfo.focus = false   //inform the teacher
        
        winhandler.examwindow.moveTop();
        platformDispatcher.applyElectronKioskMode(winhandler.examwindow);
        winhandler.examwindow.show();  
        winhandler.examwindow.focus();    // we keep focus on the window.. no matter what

        //turn volume up ^^
        // if (process.platform === 'win32') { spawn('powershell', ['Set-VolumeLevel -Level 100; Set-VolumeMute -Mute $false']); }
        // if (process.platform ==='darwin') { exec('osascript -e "set volume output volume 100" -e "set volume output muted false"'); }  
        // if (process.platform === 'linux') { 
        //     exec('amixer set Master 100% ');
        //     exec('pactl set-sink-mute `pactl get-default-sink` 0');
        // }
        
        //we could play a sound file here.. tbd.  
    }
    //special blur event for temporary low security screenlock
    blureventScreenlock(winhandler) { 
        log.info("windowhandler @ blureventScreenlock: blur-screenlock triggered")
        try {
            //don't cycle through all of them .. it will create an infinite focus race
            winhandler.screenlockwindows[0].show();  // we keep focus on the window.. no matter what
            winhandler.screenlockwindows[0].moveTop();
            winhandler.screenlockwindows[0].focus();
        }
        catch (err){
            log.error(`windowhandler @ blureventScreenlock: ${err}`)
        }
    
    }
    
}


export default new WindowHandler()
 








