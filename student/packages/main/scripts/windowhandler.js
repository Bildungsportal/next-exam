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



import { app, BrowserWindow, BrowserView, dialog, screen} from 'electron'
import { join } from 'path'
import childProcess from 'child_process' 
import {disableRestrictions, enableRestrictions} from './platformrestrictions.js';

import log from 'electron-log'
import {SchedulerService} from './schedulerservice.ts'
import { activeWindow } from 'get-windows';
import languageToolServer from './lt-server.js';
import platformDispatcher from './platformDispatcher.js';


const __dirname = import.meta.dirname;




  ////////////////////////////////////////////////////////////
 // Window handling (ipcRenderer Process - Frontend) START
////////////////////////////////////////////////////////////


class WindowHandler {
    constructor () {
      this.blockwindows = []
      this.screenlockwindows = []
      this.screenlockWindow = null
      this.mainwindow = null
      this.examwindow = null
      this.examDisplayId = null  // reserved display ID for exam window (set immediately when window is created)
      this.splashwin = null
      this.bipwindow = null
      this.config = null
      this.multicastClient = null
    
      this.exitWarningOpen = false  // track if exit warning dialog is open
      this.exitQuestionOpen = false  // track if exit question dialog is open
      this.minimizeWarningOpen = false  // track if minimize warning dialog is open
    }

    init (mc, config) {
        this.multicastClient = mc
        this.config = config
        this.checkWindowInterval = new SchedulerService(this.windowTracker.bind(this), 1000)
        this.focusTargetAllowed = true
    }

    // return electron window in focus or an other electron window depending on the hierachy
    getCurrentFocusedWindow() {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) {
          return focusedWindow
        } else {
            if (this.screenlockWindow){return this.screenlockWindow}
            else if (this.examwindow){return this.examwindow}
            else if (this.mainwindow){return this.mainwindow}
            else { return false }
        }
    }


    createBiPLoginWin(biptest) {
        this.bipwindow = new BrowserWindow({
            title: 'Next-Exam',
            icon: join(__dirname, '../../public/icons/icon.png'),
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










    /**
     * this is an easter egg
     */
    createEasterWin() {
        this.easterwin = new BrowserWindow({
            title: 'Next-Exam',
            icon: join(__dirname, '../../public/icons/icon.png'),
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
     
        this.easterwin.loadFile(join(__dirname, `../../public/cowsonice/index.html`))

        // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
        this.easterwin.webContents.once('did-finish-load', () => {
            if (this.easterwin && !this.easterwin.isVisible()) {
                this.easterwin.show()
            }
        });
    }


















    /**
     * BlockWindow (to cover additional screens)
     * @param display 
     */
    newBlockWin(display) {
        let blockwin = new BrowserWindow({
            x: display.bounds.x + 0,
            y: display.bounds.y + 0,
            parent: this.examwindow,
            skipTaskbar:true,
            title: 'Next-Exam',
            width: display.bounds.width,
            height: display.bounds.height,
            closable: false,
            alwaysOnTop: true,
            focusable: false,   //doesn't work with kiosk mode (no kiosk mode possible.. why?)
            minimizable: false,
            // resizable:false,   // leads to weird 20px bottomspace on windows
            movable: false,
            frame: false,
            icon: join(__dirname, '../../public/icons/icon.png'),
            webPreferences: {
                preload: join(__dirname, '../preload/preload.cjs'),
            },
        });
    
        let url = "notfound"
        if (app.isPackaged) {
            let path = join(__dirname, `../renderer/index.html`)
            blockwin.loadFile(path, {hash: `#/${url}/`})
        } 
        else {
            url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}/#/${url}/`
            blockwin.loadURL(url)
        }
        
        blockwin.removeMenu() 
        blockwin.setMinimizable(false)

        // Position window on specific display BEFORE showing it
        blockwin.setBounds({
            x: display.bounds.x,
            y: display.bounds.y,
            width: display.bounds.width,
            height: display.bounds.height
        });

        blockwin.setAlwaysOnTop(true, "screen-saver", 1) 
        blockwin.show()

        if (process.platform ==='darwin') { 
            blockwin.setFullScreen(true);
            blockwin.on('leave-full-screen', () => {
                blockwin.setFullScreen(true); // sofort wieder zurücksetzen
            }); 
        }  
        else {   
            blockwin.setKiosk(true); // Kiosk = "take over main screen". on macos that's why we use fullScreen workaround with event listener
        }
        blockwin.moveTop();
        blockwin.display = display
        this.blockwindows.push(blockwin)
    }


    // block all screens with a blockwindow
    async initBlockWindows(){
        let displays = screen.getAllDisplays()
        //log.info(`windowhandler @ initBlockWindows: found ${displays.length} displays`)
        
        if (!this.config.development) {  // lock all screens
            // Wait for exam window to be visible and positioned (important for Wayland/KWin)
            if (this.examwindow && !this.examwindow.isDestroyed()) {
                let retries = 0
                const maxRetries = 10
                while (!this.examwindow.isVisible() && retries < maxRetries) {
                    await this.sleep(100)
                    retries++
                }
                // Additional wait to ensure positioning is complete on Wayland
                await this.sleep(200)
            }
            
            // Clean up destroyed block windows from array
            this.blockwindows = this.blockwindows.filter(blockwin => blockwin && !blockwin.isDestroyed())
            
            // Get all existing windows and determine their displays
            const usedDisplayIds = new Set()
            
            // First, use the reserved exam display ID (set immediately when exam window was created)
            // This ensures the screen is reserved even if the window isn't fully initialized yet
            if (this.examDisplayId) {
                usedDisplayIds.add(this.examDisplayId)
            }
            
            // Always exclude primary display (exam window location)
            const primaryDisplay = screen.getPrimaryDisplay()
            if (primaryDisplay && primaryDisplay.id) {
                usedDisplayIds.add(primaryDisplay.id)
            }
            
            // Check exam window display (as fallback/verification, but reserved ID takes priority)
            if (this.examwindow && !this.examwindow.isDestroyed()) {
                try {
                    const bounds = this.examwindow.getBounds()
                    const display = screen.getDisplayMatching(bounds)
                    usedDisplayIds.add(display.id)
                    log.info(`windowhandler @ initBlockWindows: exam window is on display ${display.id}`)
                } catch (err) {
                    log.error(`windowhandler @ initBlockWindows: error getting exam window display: ${err}`)
                }
            }
            
            // Check block windows displays
            for (const blockwin of this.blockwindows) {
                try {
                    const bounds = blockwin.getBounds()
                    const display = screen.getDisplayMatching(bounds)
                    usedDisplayIds.add(display.id)
                    log.info(`windowhandler @ initBlockWindows: block window found on display ${display.id}`)
                } catch (err) {
                    log.error(`windowhandler @ initBlockWindows: error getting block window display: ${err}`)
                }
            }
            
            // Create block windows for displays that don't have exam or block windows
            for (let display of displays){
                if (usedDisplayIds.has(display.id)) {
                    log.info(`windowhandler @ initBlockWindows: skipping display ${display.id} - already has exam or block window`)
                    continue
                }
                
                log.info("windowhandler @ initBlockWindows: create blockwin on:",display.id)
                this.newBlockWin(display)  // add blockwindows for displays without exam window
            }
            
            await this.sleep(1000)
            this.blockwindows.forEach( (blockwin) => {
                if (blockwin && !blockwin.isDestroyed()) {
                    blockwin.moveTop();
                }
            })
        }
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
            icon: join(__dirname, '../../public/icons/icon.png'),
            webPreferences: {
                preload: join(__dirname, '../preload/preload.cjs'),
            },
        });

        let url = "lock"
        if (app.isPackaged) {
            let path = join(__dirname, `../renderer/index.html`)
            screenlockWindow.loadFile(path, {hash: `#/${url}/`})
        } 
        else {
            url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}/#/${url}/`
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
            screenlockWindow.setKiosk(true)
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
        // just to be sure we check some important vars here
        if (examtype !== "rdp" && examtype !== "website" &&  examtype !== "gforms" && examtype !== "eduvidual" && examtype !== "editor" && examtype !== "math" && examtype !== "microsoft365" && examtype !== "activesheets" || !token){  // for now.. we probably should stop everything here
            log.warn("missing parameters for exam-mode or mode not in allowed list!")
            examtype = "editor" 
        } 
        
        // Always use primary display for exam window
        if (!primarydisplay || !primarydisplay.bounds || !primarydisplay.id) {
            primarydisplay = screen.getPrimaryDisplay()
            if (!primarydisplay || !primarydisplay.bounds) {
                const displays = screen.getAllDisplays()
                primarydisplay = displays[0] || primarydisplay
            }
        }
        
        // Immediately reserve the display ID for the exam window (before window is fully initialized)
        // This prevents block windows from being created on the same screen
        if (primarydisplay && primarydisplay.id) {
            this.examDisplayId = primarydisplay.id
            log.info(`windowhandler @ createExamWindow: reserving display ${this.examDisplayId} for exam window`)
        }
        
        let px = 0
        let py = 0
        if (primarydisplay && primarydisplay.bounds && primarydisplay.bounds.x) {
            px = primarydisplay.bounds.x
            py = primarydisplay.bounds.y
        }

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
            kiosk: this.config.development ? false : true,
            show: true,
            transparent: false,
            icon: join(__dirname, '../../public/icons/icon.png'),
            webPreferences: {
                preload: join(__dirname, '../preload/preload.cjs'),
                spellcheck: false,  
                contextIsolation: true,
                webviewTag: true,
                webSecurity: false            }
        });

        // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
        this.examwindow.webContents.once('did-finish-load', async () => {
            if (!this.examwindow) return;
            
            if (this.config.showdevtools) { this.examwindow.webContents.openDevTools()  }
            
            if (!this.config.development) {
                try {
                    this.examwindow.removeMenu()                 
                    this.examwindow.setAlwaysOnTop(true, "screen-saver", 1) 
                    this.examwindow.setKiosk(true);
                
                    await this.sleep(500)
                    await this.initBlockWindows()
                    this.examwindow.moveTop()
                    this.examwindow.focus()

                    this.examwindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

                    if (!this.isWayland){ this.checkWindowInterval.start() } // constantly check if the active window is the examwindow - if not, bring it to front
                    await enableRestrictions(this)  // disable keyboard shortcuts etc.
                    
                    await this.sleep(1000)  // do not set blur listener too early
                    this.addBlurListener()  // add blur listener to the examwindow
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
                this.examDisplayId = null  // reset reserved display ID when exam window is destroyed
                disableRestrictions(this.examwindow)
                this.multicastClient.clientinfo.exammode = false
                this.multicastClient.clientinfo.focus = true
                return
            }
            // load top menu in MainPage
            let url = examtype   // editor || math || eduvidual || tbd.
            if (app.isPackaged) {
                let path = join(__dirname, `../renderer/index.html`)
                this.examwindow.loadFile(path, {hash: `#/${url}/${token}`})
            } 
            else {
                let backgroundurl = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}/#/${url}/${token}/`
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
        // this is the normal exam mode (editor, math, eduvidual, website, gforms)
        else { 
            let url = examtype   // editor || math || tbd.
            if (app.isPackaged) {
                let path = join(__dirname, `../renderer/index.html`)
                this.examwindow.loadFile(path, {hash: `#/${url}/${token}`})
            } 
            else {
                url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}/#/${url}/${token}/`
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
        const examTypesWithPdfInHeader = ["gforms", "website", "eduvidual", "editor", "rdp", "microsoft365", "activesheets", "math"];
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
        if ( serverstatus.examSections[serverstatus.lockedSection].examtype === "microsoft365"){  // do not under any circumstances allow navigation away from the current exam url
            const browserView = this.examwindow.getBrowserView(0);

            // if the user wants to navigate away from this page
            browserView.webContents.on('will-navigate', (event, url) => {
                if (url !== this.multicastClient.clientinfo.msofficeshare ) {
                    log.warn("do not navigate away from this test.. ")
                    event.preventDefault()
                }  
            })

            // if a new window should open triggered by window.open()
            browserView.webContents.on('new-window', (event, url) => { event.preventDefault();   }); // Prevent the new window from opening
     
            // if a new window should open triggered by target="_blank"
            browserView.webContents.setWindowOpenHandler(({ url }) => { return { action: 'deny' };   }); // Prevent the new window from opening
            
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
                this.examDisplayId = null  // reset reserved display ID when exam window is closed
                this.checkWindowInterval.stop()
                //disableRestrictions(this.examwindow)  //do not disable twice
                this.multicastClient.clientinfo.exammode = false
                this.multicastClient.clientinfo.focus = true
            }  
        });
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
            title: 'Main window',
            icon: join(__dirname, '../../public/icons/icon.png'),
            x: x,
            y: y,
            width: windowWidth,
            height: windowHeight,
            minWidth: 850,
            minHeight: 600,
            resizable: false, // verhindert das Ändern der Größe  
            fullscreenable: false, // verhindert den Vollbildmodus - wichtig für macos denn wenn auf macos das mainwindow auf fullscreen ist greift beim examwindow der kiosk mode nicht  - electron bug (needs example code): >> https://github.com/electron/electron/issues/44755
            show: true,
            visibleOnAllWorkspaces: true,
            webPreferences: {
                preload: join(__dirname, '../preload/preload.cjs'),
                spellcheck: false,
                backgroundThrottling: false  // Prevent throttling when window is in background
            }
        })

        // Register event handlers before loading
        this.mainwindow.on('close', async  (e) => {   // ask before closing
            if (!this.config.development && !this.mainwindow.allowexit) {  // allowexit ist ein override vom context menu oder screenshot test. dieser kann die app schliessen
                if (this.multicastClient.clientinfo.token){
                    const allowTray = !platformDispatcher._isGNOME(); // GNOME has no legacy tray
                    if (!allowTray) { 
                        log.warn(`windowhandler @ createMainWindow: GNOME detected, quitting instead of tray minimize`);
                        this.mainwindow.allowexit = true;  // allow close flow
                        return;
                    }
                    this.mainwindow.hide();
                    e.preventDefault();
                    await this.showMinimizeWarning()
                    log.warn(`windowhandler @ createMainWindow: Minimizing Next-Exam to Systemtray`) 
                    return
                }
            }
        });

        // Set window properties immediately after creation
        this.mainwindow.removeMenu()
        this.mainwindow.focus()
        this.mainwindow.moveTop()

        if (app.isPackaged || process.env["DEBUG"]) {
            const filePath = join(__dirname, '../renderer/index.html')
            log.info(`windowhandler @ createMainWindow: Loading file: ${filePath}`)
            this.mainwindow.loadFile(filePath)
        } 
        else {
            const url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}`
            log.info(`windowhandler @ createMainWindow: Loading URL: ${url}`)
            this.mainwindow.loadURL(url)
        }

        if (this.config.showdevtools) { this.mainwindow.webContents.openDevTools()  }
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
            if(choice.response == 1){
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

    // this function uses active-win to receive name and url from active window - yet another way to figure out if the focus is still on nextexam
    // this is used to introduce exemptions for the blur listener
    // (downgraded from get-windows because of napi v9 issue) https://github.com/sindresorhus/get-windows/issues/186
    async windowTracker(){
        try{
            // const getwin = await this.getActiveWindow();
            const activeWin = await activeWindow()
         
            if (activeWin && activeWin.owner && activeWin.owner.name) {
                let name = activeWin.owner.name
                let wpath = activeWin.owner.path
                let nameLower = name.toLowerCase()
                let wpathLower = wpath.toLowerCase()

                if (nameLower.includes("exam") || nameLower.includes("next")  || nameLower.includes("electron") ||  wpathLower.includes("easeofaccessdialog") ||  wpathLower.includes("disable-shortcuts") ){  
                    // fokus is on allowed window instance
                    this.focusTargetAllowed = true
                }
                else { //focus is not on next-exam or any other allowed window
                    if (this.focusTargetAllowed){  //log just once
                        log.warn(`windowhandler @ windowTracker: focus lost event was triggered. app: ${wpath} - ${name} `)
                    }
                    this.multicastClient.clientinfo.focus = false
                    this.focusTargetAllowed = false
                }
            }
        }
        catch(err){
            log.error(`windowhandler @ windowTracker: ${err}`) 
        }
    }

    //adds blur listener when entering exammode   // blur event isnt fired on macos MISSIONCONTROL (which cant be deactivated anymore) - damn you apple!
    addBlurListener(window = "examwindow"){
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

        if (process.platform !== 'linux'){
            await this.windowTracker()  //checks if new focus window is allowed
            log.info("windowtracker check done...")
        }
        // Clean up destroyed screenlock windows from array and check if any still exist
        winhandler.screenlockwindows = winhandler.screenlockwindows.filter(win => win && !win.isDestroyed())
        const hasActiveScreenlock = winhandler.screenlockwindows.some(win => win && !win.isDestroyed() && win.isVisible())
        // Also check clientinfo.screenlock flag as fallback in case array was cleared but windows still exist
        if (hasActiveScreenlock || winhandler.multicastClient?.clientinfo?.screenlock) { return }// do nothing if screenlockwindow stole focus // do not trigger an infinite loop between exam window and screenlock window (stealing each others focus because screenlockwindow appears above exam window and will capture a klick and therefore steal focus)
        if (winhandler.focusTargetAllowed){ 
            winhandler.examwindow.moveTop();
            winhandler.examwindow.show(); 
            winhandler.examwindow.focus(); //trotzdem focus zurück auf die app
            log.warn(`windowhandler @ blurevent: blurevent was triggered but target is allowed`)
            return
        } 
        
        winhandler.multicastClient.clientinfo.focus = false   //inform the teacher
        
        winhandler.examwindow.moveTop();
        winhandler.examwindow.setKiosk(true);
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
 








