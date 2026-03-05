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


import path from 'path'
import fs from 'fs'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import ip from 'ip'
import net from 'net'
import i18n from '../../renderer/src/locales/locales.js'
const {t} = i18n.global
import{ipcMain, clipboard,app, webContents} from 'electron'
import { gateway4sync } from 'default-gateway';
import os from 'os'
import log from 'electron-log';
import {disableRestrictions} from './platformrestrictions.js';
import mammoth from 'mammoth';

import languageToolServer from './lt-server';
import { updateSystemTray } from './traymenu.js';
import { ensureNetworkOrReset } from './testpermissionsMac.js';
import { getWlanInfo } from './getwlaninfo.js';

const __dirname = import.meta.dirname;

const checkPortOpen = (port, host = '127.0.0.1', timeout = 1500) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const finish = (running, error = null) => {
            socket.destroy();
            resolve({ running, port, host, error });
        };
        socket.setTimeout(timeout);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false, 'timeout'));
        socket.once('error', (err) => finish(false, err.message));
        try {
            socket.connect(port, host);
        } catch (err) {
            finish(false, err.message);
        }
    });
};

  ////////////////////////////////
 // IPC handling (Backend) START
////////////////////////////////

class IpcHandler {
    constructor () {
        this.multicastClient = null
        this.config = null
        this.WindowHandler = null
        this.isPrintingPdf = false // flag to prevent closing window while printing
    }
    init (mc, config, wh, ch) {
        this.multicastClient = mc
        this.config = config
        this.WindowHandler = wh  
        this.CommunicationHandler = ch
        

        ipcMain.on('set-new-locale', (event, locale) => {
            log.info(`ipchandler @ set-new-locale: setting new locale to ${locale}`)
            i18n.locale = locale
            updateSystemTray(i18n.locale);
        })


        ipcMain.handle('getExamMaterials', async (event) => { 
      
            let clientinfo = this.multicastClient.clientinfo
            let servername = clientinfo.servername
            let serverip = clientinfo.serverip
            let token = clientinfo.token
           
            let payload = { 
                group: clientinfo.group,
            }

            let examMaterials = false
            if (this.multicastClient.clientinfo.localLockdown){
                return false
            }
            else{
                // Fetch-Request mit den entsprechenden Optionen
                examMaterials = await fetch(`https://${serverip}:${this.config.serverApiPort}/server/data/getexammaterials/${servername}/${token}`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json' },
                })
                .then(response => response.json()) // Antwort als ArrayBuffer erhalten
                .then(data => {
                    // log.info("ipchandler @ getExamMaterials: received data", data)
                    return data
                })
                .catch(err => log.error(`ipchandler @ getExamMaterials: ${err}`));
                return examMaterials
            }


           
        }) 

        // Helper function for common exception URLs (used by all exam modes)
        const checkCommonExceptions = (targetUrl) => {
            if (targetUrl.includes("login") && targetUrl.includes("Microsoft")) return true;
            if (targetUrl.includes("login") && targetUrl.includes("Google")) return true;
            if (targetUrl.includes("accounts") && targetUrl.includes("google.com")) return true;
            if (targetUrl.includes("mysignins") && targetUrl.includes("microsoft")) return true;
            if (targetUrl.includes("account") && targetUrl.includes("windowsazure")) return true;
            if (targetUrl.includes("login") && targetUrl.includes("microsoftonline")) return true;
            if (targetUrl.includes("lookup") && targetUrl.includes("google")) return true;
            if (targetUrl.includes("bildung.gv.at") && targetUrl.includes("SAML2")) return true;
            if (targetUrl.includes("Shibboleth") && targetUrl.includes("SAML2")) return true;
            if (targetUrl.includes("id-austria.gv.at") && targetUrl.includes("authHandler")) return true;
            
            if (targetUrl.includes("eu-mobile.events.data") && targetUrl.includes("microsoft")) return true;   // LMS
            if (targetUrl.includes("gstatic.com")) return true;   // LMS
            if (targetUrl.includes("aadcdn") && targetUrl.includes("microsoftonline")) return true;   // LMS
            if (targetUrl.includes("login") && targetUrl.includes("live.com")) return true;   // LMS
            if (targetUrl.includes("login") && targetUrl.includes("msftauth.net")) return true;   // LMS
            if (targetUrl.includes("aadcdn") && targetUrl.includes("msftauth.net")) return true;   // LMS
            if (targetUrl.includes("googlesyndication.com")) return true; 


            return false;
        };

        ipcMain.handle('start-blocking-for-webview', (event, { guestId, allowedUrls }) => {
            const guest = webContents.fromId(Number(guestId));
            if (!guest || guest.isDestroyed?.()) return false;
          
            // Entferne alte Listener, um Doppel-Registrierungen zu vermeiden
            guest.removeAllListeners('will-navigate');
       
            const allow = allowedUrls.map(s => String(s).toLowerCase());
            
            // Helper function to check if URL matches allowed domain (supports subdomains and paths)
            const isUrlAllowed = (targetUrl) => {
                if (!targetUrl) return false;
                const urlStr = String(targetUrl).toLowerCase();
                
                // Check common exceptions first
                if (checkCommonExceptions(urlStr)) return true;
                
                // Check each allowed URL
                for (const allowedUrl of allow) {
                    try {
                        // Try to parse as URL to extract hostname
                        const urlObj = new URL(targetUrl);
                        const targetHostname = urlObj.hostname.toLowerCase();
                        
                        // Parse allowed URL to extract domain
                        let allowedDomain = allowedUrl;
                        if (allowedUrl.startsWith('http://') || allowedUrl.startsWith('https://')) {
                            const allowedUrlObj = new URL(allowedUrl);
                            allowedDomain = allowedUrlObj.hostname.toLowerCase();
                        } else if (allowedUrl.includes('/')) {
                            // If it's a path without protocol, extract domain part
                            const parts = allowedUrl.split('/');
                            allowedDomain = parts[0].toLowerCase();
                        }
                        
                        // Exact match
                        if (targetHostname === allowedDomain) return true;
                        
                        // Check if allowedDomain is a specific subdomain (contains dots)
                        const isSpecificSubdomain = allowedDomain.includes('.');
                        
                        if (isSpecificSubdomain) {
                            // If a specific subdomain is specified, only allow that exact subdomain and www. variant
                            if (targetHostname === 'www.' + allowedDomain) return true;
                            // Don't allow other subdomains when a specific one is specified
                        } else {
                            // If only base domain is specified (e.g., "orf.at"), allow all subdomains
                            // Allow www. subdomain explicitly
                            if (targetHostname === 'www.' + allowedDomain) return true;
                            
                            // Allow other subdomains (e.g., sub.duden.de if duden.de is allowed)
                            if (targetHostname.endsWith('.' + allowedDomain)) {
                                const prefix = targetHostname.slice(0, -(allowedDomain.length + 1));
                                // Validate prefix: must be valid subdomain name (alphanumeric and hyphens)
                                if (prefix && !prefix.includes('.') && /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(prefix)) {
                                    return true;
                                }
                            }
                        }
                    } catch (error) {
                        // If URL parsing fails, fall back to simple includes check for paths
                        if (urlStr.includes(allowedUrl)) return true;
                    }
                }
                
                return false;
            };
            
            guest.setWindowOpenHandler(({ url }) => {
                const isAllowed = isUrlAllowed(url);
                if (isAllowed) { 
                    guest.loadURL(url); 
                    log.warn("ipchandler @ start-blocking-for-webview: allowed navigation to", url) 
                }
                else return { action: 'deny' };
            });
            
            guest.on('will-navigate', (e, url) => {
                const isAllowed = isUrlAllowed(url);
                if (!isAllowed) { 
                    e.preventDefault(); 
                    log.warn("ipchandler @ start-blocking-for-webview: blocked navigation to", url) 
                }
            });
              
            return true;
        });

        // Unified IPC handler for webview blocking - supports website, eduvidual, forms, rdp modes
        ipcMain.handle('start-blocking-for-website-webview', (event, { guestId, mode, allowedDomain, baseUrl, moodleTestId, moodleDomain, gformsTestId }) => {
            const guest = webContents.fromId(Number(guestId));
            if (!guest || guest.isDestroyed?.()) return false;
          
            // Remove old listeners to prevent duplicate registrations
            guest.removeAllListeners('will-navigate');
            
            // URL validation function - different logic based on mode
            const isUrlAllowed = (targetUrl) => {
                if (mode === "website") {
                    // WEBSITE mode: check domain matching
                    if (!targetUrl || targetUrl.includes(baseUrl)) return true;
                    
                    try {
                        const urlObj = new URL(targetUrl);
                        const domain = urlObj.hostname;
                        
                        if (domain === allowedDomain) return true;
                        // Explicitly allow www. subdomain
                        if (domain === 'www.' + allowedDomain) return true;
                        if (domain.endsWith('.' + allowedDomain)) {
                            const prefix = domain.slice(0, -(allowedDomain.length + 1));
                            if (prefix && !prefix.includes('.') && /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(prefix)) {
                                return true;
                            }
                        }
                    } catch (error) {
                        return false;
                    }
                } else if (mode === "eduvidual") {
                    // EDUVIDUAL/MOODLE mode: check moodleTestId
                    if (targetUrl.includes(moodleTestId)) {
                        return true;
                    }
                    
                    // Moodle-specific exceptions
                    if (targetUrl.includes("startattempt.php") && targetUrl.includes(moodleDomain)) {
                        return true; // moodledomain ohne testid
                    }
                    if (targetUrl.includes("processattempt.php") && targetUrl.includes(moodleDomain)) {
                        return true; // moodledomain ohne testid
                    }
                    if (targetUrl.includes("logout") && targetUrl.includes(moodleDomain)) {
                        return true;
                    }
                    if (targetUrl.includes("login") && targetUrl.includes("eduvidual")) {
                        return true;
                    }
                    if (targetUrl.includes("login") && targetUrl.includes(moodleDomain)) {
                        return true;
                    }
                    if (targetUrl.includes("policy") && targetUrl.includes(moodleDomain)) {
                        return true;
                    }
                    if (targetUrl.includes("auth") && targetUrl.includes(moodleDomain)) {
                        return true;
                    }
                    if (targetUrl.includes("SAML2") && targetUrl.includes("portal.tirol.gv.at")) {
                        return true;
                    }
                    if (targetUrl.includes("login") && targetUrl.includes("portal.tirol.gv.at")) {
                        return true;
                    }
                    if (targetUrl.includes("login") && targetUrl.includes("tirol.gv.at")) {
                        return true;
                    }
                } else if (mode === "forms") {
                    // FORMS mode: check gformsTestId
                    if (targetUrl.includes(gformsTestId)) {
                        return true;
                    }
                    
                    // Google Forms-specific exceptions
                    if (targetUrl.includes("docs.google.com") && targetUrl.includes("formResponse")) {
                        return true;
                    }
                    if (targetUrl.includes("docs.google.com") && targetUrl.includes("viewscore")) {
                        return true;
                    }
                } else if (mode === "rdp") {
                    // RDP mode: allow all (or implement specific logic if needed)
                    return true;
                }
                
                // Common exception URLs (used by all modes)
                return checkCommonExceptions(targetUrl);
            };
            
            // Handle target="_blank" links and window.open - block BEFORE navigation
            guest.setWindowOpenHandler(({ url }) => {
                if (isUrlAllowed(url)) {
                    log.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed window.open to`, url);
                    guest.loadURL(url); // Open in same webview
                    return { action: 'deny' }; // Prevent new window
                } else {
                    log.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked window.open to`, url);
                    return { action: 'deny' };
                }
            });
            
            // Handle will-navigate on webContents level - this fires BEFORE navigation happens
            guest.on('will-navigate', (e, url) => {
                if (!isUrlAllowed(url)) {
                    log.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked navigation to`, url);
                    e.preventDefault(); // Block navigation completely - this happens BEFORE page loads
                    guest.stop(); // Stop any loading immediately
                } else {
                    log.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed navigation to`, url);
                }
            });
              
            return true;
        });

        // Alias for eduvidual mode - redirects to unified handler
        ipcMain.handle('start-blocking-for-eduvidual-webview', (event, { guestId, moodleTestId, moodleDomain }) => {
            // Call the unified handler with eduvidual mode
            const unifiedHandler = ipcMain.listeners('start-blocking-for-website-webview')[0];
            if (unifiedHandler) {
                return unifiedHandler(event, { guestId, mode: 'eduvidual', moodleTestId, moodleDomain });
            }
            return false;
        });
          

        /**
         * Reload the browser view
         */
        ipcMain.handle('reload-browser-view', (event, url) => {
            const browserView = this.WindowHandler.examwindow.getBrowserView(0);
            browserView.webContents.loadURL(url);
        });
























        /**
         * Start languageTool API Server (with Java JRE)
         * Runs at localhost 8088
        */ 
        ipcMain.handle('startLanguageTool', (event) => { 
            try{
                languageToolServer.startServer();
            }
            catch(err){
                return false
            }
            return true
        }) 


        /**
         * activate spellcheck on demand for specific student
         */ 
        ipcMain.on('startLanguageTool', (event) => {  
            try{
                languageToolServer.startServer();
            }
            catch(err){
                return false
            }
            return true
        })

        /**
         * Check if LanguageTool server responds on configured port
         */ 
        ipcMain.handle('isLanguageToolRunning', async () => { 
            const port = languageToolServer.port || 8088;
            const hosts = ['127.0.0.1', '::1', 'localhost'];
            // Run all checks in parallel for better performance, use longer timeout for server startup detection
            const results = await Promise.all(hosts.map(host => checkPortOpen(port, host, 2500)));
            // Return first successful result, or last result if none succeeded
            const successResult = results.find(result => result.running);
            return successResult || results[results.length - 1];
        })




        /**
         *  Start LOCAL Lockdown
         */
        ipcMain.on('locallockdown', (event, args) => {
            log.info("ipchandler @ locallockdown: locking down client without teacher connection")
            
            let serverstatus = {
                exammode: true,
               
                delfolderonexit: false,
                spellcheck: true,
                spellchecklang: 'de-DE',
                suggestions: false,
                moodleTestType: '',
                moodleDomain: '',
 
                screenshotinterval: 0,
                msOfficeFile: false,
                screenslocked: false,
                pin: '0000',
               
                unlockonexit: false,
                fontfamily: 'sans-serif',
                moodleTestId: '',
                languagetool: false,
                password: args.password,
         
                useExamSections: false, //if false exam section 1 is used and no tabs are displayed
                activeSection: 1,
                lockedSection: 1,
                examSections: {
                    1: {
                        examtype: args.exammode,
                        cmargin: { side: 'right', size: 3 },
                        linespacing: '2',
                        audioRepeat: 3,
                        languagetool: args.languagetool || false,
                        spellchecklang: args.spellchecklang || 'de-DE',
                        suggestions: args.suggestions || false
                    }
                }
            }
            
            this.multicastClient.clientinfo.name = args.clientname;
            this.multicastClient.clientinfo.serverip = "127.0.0.1";
            this.multicastClient.clientinfo.servername = "localhost";
            this.multicastClient.clientinfo.pin = "0000";
            this.multicastClient.clientinfo.token = "0000";
            this.multicastClient.clientinfo.group = "a";
            this.multicastClient.clientinfo.localLockdown = true; // this must be set to true in order to stop typical next-exam client/teacher actions

            this.CommunicationHandler.startExam(serverstatus)
            
            event.returnValue = "hello from locallockdown"
        })



        /**
         *  Start BIP Login Sequence
         */

        ipcMain.on('loginBiP', (event, biptest) => {
            log.info("ipchandler @ loginBiP: opening bip window. testenvironment:", biptest)
            this.WindowHandler.createBiPLoginWin(biptest)
            event.returnValue = "hello from bip logon"
        })



        /**
         * Registers virtualized status
         */ 
        ipcMain.on('virtualized', () => {  this.multicastClient.clientinfo.virtualized = true; } )


        /**
         * Set FOCUS state to false (mouse left exam window)
         */ 
        ipcMain.handle('focuslost', (event, ctrlalt=false) => { 
            let answer = false 
            if (this.config.development || !this.multicastClient.exammode) { 
                answer = { sender: "client", focus: true}
                
            }
            else if (this.WindowHandler.screenlockwindows.length > 0) { 
                answer = { sender: "client", focus: true }
                
            }
            else if (this.WindowHandler.focusTargetAllowed && ctrlalt == false){ 
                log.warn(`ipchandler @ focuslost: mouseleave event was triggered but target is allowed`)
                answer = { sender: "client", focus: true }
                
            } 
            else {
                this.WindowHandler.examwindow.moveTop();
                this.WindowHandler.examwindow.setKiosk(true);
                this.WindowHandler.examwindow.show();  
                this.WindowHandler.examwindow.focus();    // we keep focus on the window.. no matter what
    
                this.multicastClient.clientinfo.focus = false; // block everything and inform teacher  (probably an overkill on mouseleave - needs testing)
                answer = { sender: "client", focus: false }
            }
           
            return answer
        } )



        /**
         * Returns the main config object
         */ 
        ipcMain.on('getconfig', (event) => {   event.returnValue = this.config   })


        /**
        * Unlock Computer
        */ 
        ipcMain.on('gracefullyexit', () => {  
            log.info(`ipchandler @ gracefullyexit: gracefully leaving locked exam mode`)

            this.CommunicationHandler.gracefullyEndExam() 
            this.CommunicationHandler.resetConnection() 
        } )

        /**
        * stop restrictions
        */ 
        ipcMain.on('restrictions', () => {  
            //this also stops the clearClipboard interval
            disableRestrictions(this.WindowHandler.examwindow) 
        } )


        /**
        * copy to global clipboard
        */ 
        ipcMain.on('clipboard', (event, text) => {  
            clipboard.writeText(text)
        } )



        /**
         * re-check hostip and enable multicast client
         */ 
        ipcMain.handle('checkhostip', async (event) => { 
            let address = false;
            try {    address = this.multicastClient.client.address();            }
            catch (e) {   log.error("ipcHandler @ checkhostip: multicastclient not running");            }
            
            // Falls bereits eine Adresse vorhanden ist, liefern wir sie zurück.
            if (address) {  return this.config.hostip;  }
            
            // Versuche, an die korrekte Schnittstelle zu binden
            try {
                // Falls gateway4sync() blockierend ist, kannst du diesen Aufruf in ein Promise packen:
                const { gateway, interface: iface } = await new Promise((resolve, reject) => {
                    try {
                        const res = gateway4sync();
                        resolve(res);
                    } catch(err) {  reject(err);   }
                });
                this.config.hostip = ip.address(iface); // Liefert die IP der Schnittstelle, welche das Default Gateway hat
                this.config.gateway = true;
            }
            catch (e) {
                this.config.hostip = false;
                this.config.gateway = false;
            }
            
            // Falls keine IP (mit Gateway) verfügbar ist, hole eine alternative Adresse
            if (!this.config.hostip) {
                try {
                    this.config.hostip = ip.address(); // Liefert auch eine IP, wenn kein Gateway verfügbar ist
                }
                catch (e) {
                    log.error("ipcHandler @ checkhostip: Unable to determine ip address", e);
                    this.config.hostip = false;
                    this.config.gateway = false;
                }
            }
            
            // Verfälschte Adressen (z. B. localhost) ignorieren
            if (this.config.hostip === "127.0.0.1") {    this.config.hostip = false;   }
            
            // Wenn die Multicast-Client nicht läuft, initialisieren
            if (this.config.hostip && !address) {
                try {
                    // Falls init() asynchron umgesetzt werden kann, warten wir hier darauf.
                    await this.multicastClient.init(this.config.gateway);
                }
                catch(err) {  log.error("ipcHandler @ checkhostip: Error initializing multicast client", err); }
            }
        
            return this.config.hostip;
        });





        /**
         * Store content from editor as html file - as backup - only triggered by the teacher for now (allow manual backup !!)
         * @param args contains an object with  {clientname:this.clientname, filename:`${filename}.html`, editorcontent: editorcontent }
         */
        ipcMain.on('storeHTML', (event, args) => {   
            const htmlContent = args.editorcontent
            const filename = args.filename
            let htmlfilename = `${this.multicastClient.clientinfo.name}.bak`
            
            if (filename){
                htmlfilename = `${filename}.bak`
            }

            const htmlfile = path.join(this.config.examdirectory, htmlfilename);

            if (htmlContent) { 
                // log.info("ipchandler: storeHTML: saving students work to disk...")
                try {
                    fs.writeFile(htmlfile, htmlContent, (err) => { 
                        if (err) {
                            log.error(`ipchandler @ storeHTML: ${err.message}`); 
                        
                            let alternatepath = `${htmlfile}-${this.multicastClient.clientinfo.token}.bak`
                            log.warn("ipchandler @ storeHTML: trying to write file as:", alternatepath )
                            fs.writeFile(alternatepath, htmlContent, function (err) { 
                                if (err) {
                                    log.error(err.message);
                                    log.error("ipchandler @ storeHTML: giving up"); 
                                    event.reply("fileerror", { sender: "client", message:err , status:"error" } )
                                }
                                else {
                                    log.info("ipchandler @ storeHTML: success!");
                                    event.reply("loadfilelist")
                                }
                            }); 
                        }
                        event.reply("loadfilelist")
                    } ); 
                }
                catch(err){
                    log.error(err)
                    event.returnValue = { sender: "client", message:err , status:"error" }
                }
            }
        })



        /**
         * get base64 encoded pdf from editor
         */ 
        ipcMain.handle('getPDFbase64', async (event, args) => {
            log.info("ipchandler @ getPDFbase64: getting base64 encoded pdf")
            this.multicastClient.clientinfo.submissionnumber = args.submissionnumber+1 // clientinfo keeps track of submissions for automated submissionnumbers at section change - but this obviously happens after manual submit
            let result = await this.CommunicationHandler.getBase64PDF(args.submissionnumber, args.sectionname, args.printBackground)   // why the hell is this function located in communicationhandler.js and not in ipchandler.js ? FIXME !
            return result
        })




        /**
         * Stores the ExamWindow content as PDF
         * ATTENTION there is a similar method in communicationhandler.js that also generates a pdf but retuns a base64 version of the pdf
         */ 
        ipcMain.on('printpdf', (event, args) => { 
            // do not print if exam mode is not active anymore
            if (!this.multicastClient?.clientinfo?.exammode){
                log.warn("ipchandler @ printpdf: exammode is false - skipping print")
                return
            }

            if (this.isPrintingPdf){
                log.warn("ipchandler @ printpdf: print already in progress - skipping new request")
                return
            }

            if (this.WindowHandler.examwindow){
                const options = { // define print options
                    margins: {top:0.5, right:0, bottom:0.5, left:0 },
                    pageSize: 'A4',
                    printBackground: false,
                    printSelectionOnly: false,
                    landscape: args.landscape,
                    displayHeaderFooter:true,
                    footerTemplate: "<div style='height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-bottom:10px;'><span class=pageNumber></span>|<span class=totalPages></span></div>",
                    headerTemplate: `<div style='display: inline-block; height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-left: 30px; margin-top:10px;'><span style="float:left;">${args.servername}</span><span style="float:left;">&nbsp;|&nbsp; </span><span class=date style="float:left;"></span><span style="float:right;">${args.clientname}</span></div>`,
                    preferCSSPageSize: false
                }

                let pdffilename = `${this.multicastClient.clientinfo.name}.pdf`  // default filename = clientname.pdf
                if (args.filename){  // in case of manual backup the user can set a custom filename
                    pdffilename = `${args.filename}.pdf`
                    
                }
                const pdffilepath = path.join(this.config.examdirectory, pdffilename);  // path points to the current exam directory
                const alternatefilename = `${pdffilename}-aux.pdf`    //thomas.pdf-aux.pdf 
                const alternatebackupfilename = `${pdffilename}-old.pdf`;   //thomas.pdf-old.pdf
                const alternatepath = path.join(this.config.examdirectory, alternatefilename);  // if something goes wrong we try to write a different file


                // aux files are files created if the main pdffilepath is not writeable (opened on windows) 
                try {  // always check for old aux files and rename them
                    const files = fs.readdirSync(this.config.examdirectory);
                    files.forEach(file => {
                        if (file === alternatefilename) {
                            const newPath = path.join(this.config.examdirectory, alternatebackupfilename);
                            fs.renameSync(alternatepath, newPath);
                        }
                    });
                } 
                catch(err) { log.error(`ipchandler @ printpdf: ${err.message}`);  }

                const examWindow = this.WindowHandler.examwindow
                const webContents = examWindow?.webContents

                if (!webContents){
                    log.error("ipchandler @ printpdf: no webContents found for examwindow")
                    event.reply("fileerror", { sender: "client", message:"no webContents found for examwindow" , status:"error" } )
                    return
                }

                this.isPrintingPdf = true

                // set the title of the exam window and therefore the document title for PDF metadata
                const pdfTitle = args.filename ? args.filename : `${this.multicastClient.clientinfo.name} - ${args.servername || this.multicastClient.clientinfo.servername || ''}`
                // escape quotes and special characters for JavaScript string
                const escapedTitle = pdfTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'")
                webContents.executeJavaScript(`document.title = "${escapedTitle}"`).then(() => {
                    // print the exam window to pdf
                    return webContents.printToPDF(options)
                }).then(data => {
                    // delete the old pdf file if it exists
                    try { if (fs.existsSync(pdffilepath)) { fs.unlinkSync(pdffilepath); }}
                    catch(err) { log.error(`ipchandler @ printpdf: ${err.message}`);  }
                    // write the pdf to the exam directory
                    fs.writeFile(pdffilepath, data, (err) => { 
                        if (err) {
                            log.warn(`ipchandler @ printpdf: ${err.message} - writing file as: ${alternatepath} `); 
                            // delete the old aux file if it exists
                            try { if (fs.existsSync(alternatepath)) { fs.unlinkSync(alternatepath); } }
                            catch (err) { log.error(`ipchandler @ printpdf (alternativer Pfad): ${err.message}`); }
                            // write the pdf to the alternate path
                            fs.writeFile(alternatepath, data, (err) => { 
                                if (err) {
                                    log.error(err.message);
                                    log.error("ipchandler @ printpdf: giving up"); 
                                    event.reply("fileerror", { sender: "client", message:err.message , status:"error" } )
                                }
                                else { // log.info("ipchandler @ printpdf: success!");
                                    if (args.reason === "teacherrequest") { this.CommunicationHandler.sendToTeacher() }
                                    event.reply("loadfilelist")
                                }
                            }); 
                        }
                        else { // log.info("ipchandler @ printpdf: success!");
                            if (args.reason === "teacherrequest") { this.CommunicationHandler.sendToTeacher() }
                            event.reply("loadfilelist")   //make sure students see the new file immediately
                        }
                    } ); 
                }).catch(error => { 
                    log.error(`ipchandler @ printpdf: ${error.message}`)
                    event.reply("fileerror", { sender: "client", message:error.message , status:"error" } )
                }).finally(() => {
                    this.isPrintingPdf = false
                });
            }
        })

        /**
         * Saves Active Sheets form data to .bak file
         */
        ipcMain.on('saveActivesheetsBak', (event, args) => {
            try {
                const bakFilename = args.filename ? `${args.filename}.bak` : `${this.multicastClient.clientinfo.name}.bak`;
                const bakFilePath = path.join(this.config.examdirectory, bakFilename);
                
                // Convert formData to JSON string
                const jsonData = JSON.stringify(args.formData, null, 2);
                
                // Write to .bak file
                fs.writeFileSync(bakFilePath, jsonData, 'utf8');
                log.info(`ipchandler @ saveActivesheetsBak: saved form data to ${bakFilename}`);
            } catch (error) {
                log.error(`ipchandler @ saveActivesheetsBak: ${error.message}`);
                event.reply("fileerror", { sender: "client", message: error.message, status: "error" });
            }
        })




        /**
         * Returns all found Servers and the information about this client
         */ 
        ipcMain.handle('getinfoasync', async (event) => {   
            let serverstatus = false   
            // serverstatus objekt wird nur bei beginn des exams an das exam window durchgereicht für basis einstellungen
            // alle weiteren updates über das serverstatus object werden im communication handler gelesen und ggf. auf das clientinfo object gelegt
            // dieser kommunikationsfluss muss in 2.0 gestreamlined werden #FIXME
            
            if (this.WindowHandler.examwindow) { serverstatus = this.WindowHandler.examwindow.serverstatus }

            //count number of files in exam directory
            if (!this.multicastClient.clientinfo.exammode){
                const workdir = path.join(config.examdirectory, "/")
                try {
                    await fs.promises.mkdir(workdir, { recursive: true })  // erstellt falls nötig
                    const filelist = (await fs.promises.readdir(workdir, { withFileTypes: true }))
                        .filter(dirent => dirent.isFile())
                        .map(dirent => dirent.name)
                    this.multicastClient.clientinfo.numberOfFiles = filelist.length
                } catch (err) {
                    this.multicastClient.clientinfo.numberOfFiles = 0
                }
            }
            


            return {   
                serverlist: this.multicastClient.examServerList,
                clientinfo: this.multicastClient.clientinfo,
                serverstatus: serverstatus
            }   
        })


        /**
         * because of microsoft 365 we need to work with "BrowserView" 
         * in order to be able to dislay fullscreen information from the Exam header we temporarily collapse the BrowserView for Office
         * and restore it afterwards - not perfect but looks ok
         */ 
        ipcMain.on('collapse-browserview', (event) => {
            const mainWindow = this.WindowHandler.examwindow
            if (!mainWindow){ return }
            const contentView = mainWindow.getBrowserView(0); // assuming it's the 1st added view
            contentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
            
        });
        ipcMain.on('restore-browserview', (event) => {
            const mainWindow = this.WindowHandler.examwindow
            if (!mainWindow){ return }
            const menuHeight = mainWindow.menuHeight;
            const newBounds = mainWindow.getBounds(); // Get the current bounds of the mainWindow
            const contentView = mainWindow.getBrowserView(0); // assuming it's the 1st added view
            // Set the new bounds of the contentView
            contentView.setBounds({
                x: 0,
                y: menuHeight,
                width: newBounds.width, // full width of the mainWindow
                height: newBounds.height - menuHeight // remaining height after the menu
            });
        });

        /**
         * Update menu height dynamically when header content changes
         */
        ipcMain.on('update-menu-height', (event, height) => {
            const mainWindow = this.WindowHandler.examwindow;
            if (mainWindow && height > 0) {
                // Update the stored menu height
                mainWindow.menuHeight = height;
                
                // Reposition the browser view with new height
                const newBounds = mainWindow.getBounds();
                const contentView = mainWindow.getBrowserView(0);
                if (contentView) {
                    contentView.setBounds({
                        x: 0,
                        y: height,
                        width: newBounds.width,
                        height: newBounds.height - height
                    });
                }
            }
        });



        /**
         * Sends a register request to the given server ip
         * @param args contains an object with  clientname:this.username, servername:servername, serverip, serverip, pin:this.pincode 
         */
        ipcMain.on('register', (event, args) => {   
            const clientname = args.clientname
            const pin = args.pin
            const serverip = args.serverip
            const servername = args.servername
            const clientip = ip.address()
            const hostname = os.hostname()
            const version = this.config.version
            const bipuserID = args.bipuserID

            if (this.multicastClient.clientinfo.token){ //#FIXME das sollte eigentlich vom server kommen 
                event.returnValue = { sender: "client", message: t("control.alreadyregistered"), status:"error" }
            }


         
            const url = `https://${serverip}:${this.config.serverApiPort}/server/control/registerclient/${servername}/${pin}/${clientname}/${clientip}/${hostname}/${version}/${bipuserID}`;
            const signal = AbortSignal.timeout(8000); // 8000 Millisekunden = 8 Sekunden AbortSignal mit einem Timeout


            fetch(url, { method: 'GET', signal })
            .then(response => response.json()) 
            .then(data => {
                if (data && data.status == "success") {  // registration successfull otherwise data would be "false"
                    // Erfolgreiche Registrierung
                    this.multicastClient.clientinfo.name = clientname;
                    this.multicastClient.clientinfo.serverip = serverip;
                    this.multicastClient.clientinfo.servername = servername;
                    this.multicastClient.clientinfo.ip = clientip;
                    this.multicastClient.clientinfo.hostname = hostname;
                    this.multicastClient.clientinfo.token = data.token; // we need to store the client token in order to check against it before processing critical api calls
                    this.multicastClient.clientinfo.focus = true;
                    this.multicastClient.clientinfo.pin = pin;
                   
                    log.info(`ipchandler @ register: successfully registered at ${servername} @ ${serverip} as ${clientname}`);
                    event.returnValue = data;

                    //create exam folder in workfolder
                    let uniqueexamName = `${servername}-${pin}`
                    config.examdirectory = path.join(config.workdirectory, uniqueexamName)
                    if (!fs.existsSync(config.examdirectory)){ fs.mkdirSync(config.examdirectory, { recursive: true }); }
                } 
                else {
                    if (data.version){
                        // compare versions and display message (teacher needs upgrade.. client needs upgrade)
                        const comparisonResult = this.compareSoftware(config.version, config.info , data.version, data.versioninfo ) //serverVersion, serverStatus, localVersion, localStatus
                        if (comparisonResult > 0) {       event.returnValue = { status: "error", message: "Ihre Version von Next-Exam ist neuer als die der Lehrperson!" };   } 
                        else if (comparisonResult < 0) {  event.returnValue = { status: "error", message: "Ihre Version von Next-Exam ist zu alt. Laden sie sich eine aktuelle Version herunter!" };   } 
                        else {                            event.returnValue = { status: "error", message: "Unbekannter Fehler beim Verbindungsaufbau." };    }
                    }
                    event.returnValue = { status: "error", message: data.message };
                }
            })
            .catch(async error => {
                // Fehlerbehandlung
                let errorMessage = error.message;
                if (error.name === 'AbortError') { errorMessage = "The request timed out";   } // Timeout-Nachricht anpassen 
                log.error(`ipchandler @ register: ${errorMessage}`);
             
                // on macos the permission settings in rare cases mess up the ability to fetch the teacher api 
                // check for network permissions on macOS and reset them if needed
                if (process.platform === "darwin"){    
                    let response = await ensureNetworkOrReset(serverip, this.config.serverApiPort); 
                    if (response && response === "reset") {   // quit the app if the user wants to reset the permissions
                        app.quit();
                        return
                    }
                }
                
                // show warning message if the user does not want to reset the permissions
                event.returnValue = { sender: "client", message: "Es gibt ein Problem mit dem Netzwerk, den Firewallregeln oder den Netzwerkberechtigungen! Bitte beheben sie dieses Problem und starten Sie Next-Exam neu!", status: "error" };
                return;  
                    
                
            });
        })






        /**
         * Store content from Geogebra as ggb file - as backup 
         * @param args contains an object with  { filename:`${this.clientname}.ggb`, content: base64 }
         */
        ipcMain.handle('saveGGB', (event, args) => {   
            const content = args.content
            const filename = args.filename
            const reason = args.reason
            const ggbFilePath = path.join(this.config.examdirectory, filename);
            if (content) { 
                //log.info("ipchandler @ saveGGB: saving students work to disk...")
                const fileData = Buffer.from(content, 'base64');

                try {
                    fs.writeFileSync(ggbFilePath, fileData);
                    if (reason === "teacherrequest") { this.CommunicationHandler.sendToTeacher() }
                    return  { sender: "client", message:t("data.filestored") , status:"success" }
                }
                catch(err){
                    this.WindowHandler.examwindow.webContents.send('fileerror', err)  
                 
                    log.error(`ipchandler @ saveGGB: ${err}`)
                    return { sender: "client", message:err , status:"error" }
                }
            }
        })



        /**
         * load content from ggb file and send it to the frontend 
         * @param args contains an object { filename:`${this.clientname}.ggb` }
         */
        ipcMain.handle('loadGGB', (event, filename) => {   
            const ggbFilePath = path.join(this.config.examdirectory, filename);
            try {
                // Read the file and convert it to base64
                const fileData = fs.readFileSync(ggbFilePath);
                const base64GgbFile = fileData.toString('base64');
                return { sender: "client", content:base64GgbFile, status:"success" }
            } 
            catch (error) {
                return { sender: "client", content: false , status:"error" }
            }     
        })





        /**
         * GET PDF or IMAGE from EXAM directory
         * @param filename if set the content of the file is returned
         */ 
        ipcMain.handle('getpdfasync', (event, filename, image = false) => {   
            const workdir = path.join(config.examdirectory,"/")
            if (filename) { //return content of specific file
                let filepath = path.join(workdir,filename)
                try {
                    let data = fs.readFileSync(filepath)
                   
                    if (image){ return data.toString('base64');  }
                    return data
                } 
                catch (error) {
                    return { sender: "client", content: false , status:"error" }
                }    
            }
        })

        /**
         * returns base64 string of audiofile from workdirectory or public directory
         */
        ipcMain.handle('getAudioFile', async (event, filename, publicdir=false) => {   
            const workdir = path.join(config.examdirectory, "/");
        
            if (filename && !publicdir) { // Return content of specific file as string (html) to replace in editor
                let filepath = path.join(workdir, filename);
                const audioData = fs.readFileSync(filepath);
                return audioData.toString('base64');
            }
        
            if (filename && publicdir) {
                let filepath = path.join(__dirname, "../../public",filename);
                const audioData = fs.readFileSync(filepath);
                return audioData.toString('base64');
            }
        
            return false;
        });
 

        /**
         * ASYNC GET FILE-LIST from examdirectory
         * @param filename if set the content of the file is returned
         */ 
        ipcMain.handle('getfilesasync', async (event, filename, audio=false, docx=false) => {   
            const workdir = path.join(config.examdirectory,"/")

            if (filename) { //return content of specific file as string (html) to replace in editor)
                // console.log("Received arguments:", filename, audio, docx);

                let filepath = path.join(workdir,filename)

                if (audio == true){ // audio file
                    const audioData = fs.readFileSync(filepath);
                    return audioData.toString('base64');
                }
                else if (docx){  //office open xml file
                    let result = await mammoth.convertToHtml({path: filepath})
                    .then((data) => {
                        return data
                    })
                    .catch(function(error) {
                        console.error(error);
                    });
                    return result
                }
                else {   //bak file
                    try {
                        let data = fs.readFileSync(filepath, 'utf8')
                        return data
                    }
                    catch (err) {
                        log.error(`ipchandler @ getfilesasync: ${err}`); 
                        return false
                    }
                }
            }
            else {  // return file list of exam directory
                try {
                    if (!fs.existsSync(workdir)){ fs.mkdirSync(workdir, { recursive: true });  } //do not crash if the directory is deleted after the app is started ^^
                    let filelist =  fs.readdirSync(workdir, { withFileTypes: true })
                        .filter(dirent => dirent.isFile())
                        .map(dirent => dirent.name)
                     
                    
                    let files = []
                    filelist.forEach( file => {
                        let modified = fs.statSync(   path.join(workdir,file)  ).mtime
                        let mod = modified.getTime()
                        if  (path.extname(file).toLowerCase() === ".pdf"){ files.push( {name: file, type: "pdf", mod: mod})   }         //pdf
                        else if  (path.extname(file).toLowerCase() === ".bak"){ files.push( {name: file, type: "bak", mod: mod})   }   // editor| backup file to replace editor content
                        else if  (path.extname(file).toLowerCase() === ".docx"){ files.push( {name: file, type: "docx", mod: mod})   }   // editor| content file (from teacher) to replace content and continue writing
                        else if  (path.extname(file).toLowerCase() === ".ggb"){ files.push( {name: file, type: "ggb", mod: mod})   }  // geogebra
                        else if  (path.extname(file).toLowerCase() === ".mp3" || path.extname(file).toLowerCase() === ".ogg" || path.extname(file).toLowerCase() === ".wav" ){ files.push( {name: file, type: "audio", mod: mod})   }  // audio
                        else if  (path.extname(file).toLowerCase() === ".jpg" || path.extname(file).toLowerCase() === ".png" || path.extname(file).toLowerCase() === ".gif" ){ files.push( {name: file, type: "image", mod: mod})   }  // images
                    })
                    this.multicastClient.clientinfo.numberOfFiles = filelist.length
                    return files
                }
                catch (err) { 
                    log.error(`ipchandler @ getfilesasync: ${err}`); 
                    return false; 
                }
            }
        })



        /**
         * ASYNC GET BACKUP FILE from examdirectory
         * @param filename filename without
         */ 
        ipcMain.handle('getbackupfile', async (event, filename) => {   
            log.info(`ipchandler @ getbackupfile: Request received for filename: ${filename}`)
            const workdir = path.join(config.examdirectory,"/")
            if (filename) { //return content of specific file as string (html) to replace in editor)
                let filepath = path.join(workdir,filename)
                log.info(`ipchandler @ getbackupfile: Full file path: ${filepath}`)
                try {
                    if (!fs.existsSync(filepath)){
                        log.warn(`ipchandler @ getbackupfile: backup file not found: ${filepath}`); 
                        return false;
                    }
                    log.info(`ipchandler @ getbackupfile: backup file exists, reading content`)
                    let data = fs.readFileSync(filepath, 'utf8')
                    log.info(`ipchandler @ getbackupfile: Successfully read backup file, content length: ${data.length}`)
                    return data
                }
                catch (err) {
                    log.error(`ipchandler @ getbackupfile: Error reading backup file: ${err}`); 
                    log.error(`ipchandler @ getbackupfile: Error stack: ${err.stack}`)
                    return false
                }
            }
            else {
                log.warn(`ipchandler @ getbackupfile: no filename provided`); 
                return false;
            }
        })

        ipcMain.on('reload-url', (event) => {
            this.WindowHandler.createEasterWin()
        });

         /**
         * Append PrintRequest to clientinfo  
         */ 
        ipcMain.on('sendPrintRequest', (event) => {   
            this.multicastClient.clientinfo.printrequest = true  //set this to false after the request left the client to prevent double triggering
            event.returnValue = true
        })
     
        ipcMain.on('get-cpu-info', (event) => {
            event.returnValue = this.isVirtualMachine()
        });



        ipcMain.handle('get-wlan-info', async (event) => {
            const wlanInfo = await getWlanInfo();
            return wlanInfo;
        });


        
        // New handler to get PDF from public directory for frontend parsing
        ipcMain.handle('getPdfFromPublic', async (event, pdfFilename ) => {
            try {
                // Get directory name in ESM
                const __dirname = import.meta.dirname;
                
                let pdfPath;
                if (app.isPackaged) {
                    pdfPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'public', pdfFilename);
                } else {
                    // From scripts/ go up 3 levels to reach student/ then public/
                    pdfPath = path.join(__dirname, '../../public', pdfFilename);
                }
                
                if (!fs.existsSync(pdfPath)) {
                    log.warn(`ipchandler @ getPdfFromPublic: PDF not found at: ${pdfPath}`);
                    return null;
                }
                
                const buffer = fs.readFileSync(pdfPath);
                return buffer.toString('base64');
            } catch (error) {
                log.error(`ipchandler @ getPdfFromPublic: Error: ${error.message}`, error);
                return null;
            }
        });


    }

    isVirtualMachine() {
        const VENDORS = /(oracle|virtualbox|vmware|kvm|qemu|xen|innotek|parallels|microsoft|hyper-v|bhyve|red hat|redhat|bochs|bhyve|openstack|cloud|amazon|google|azure)/i // common VM ids
        const warnAndReturn = reason => {
            log.warn(`ipchandler @ isVirtualMachine: Verdacht auf VM - ${reason}`)
            return true
        }

        // ---------- Linux ----------
        if (process.platform === 'linux') {
          try {
            const cpuinfo = readFileSync('/proc/cpuinfo', 'utf8')      // CPU flags
            if (/^flags.*\bhypervisor\b/m.test(cpuinfo)) return warnAndReturn('hypervisor flag in /proc/cpuinfo')
          } catch {}
      
          try {
            const files = [
              '/sys/class/dmi/id/sys_vendor',
              '/sys/class/dmi/id/product_name',
              '/sys/class/dmi/id/product_version',
              '/sys/class/dmi/id/board_vendor',
              '/sys/class/dmi/id/bios_vendor',
              '/sys/class/dmi/id/chassis_vendor'
            ]
            const dmi = files.map(p => { try { return readFileSync(p, 'utf8') } catch { return '' } }).join(' ')
            if (VENDORS.test(dmi)) return warnAndReturn('DMI-Vendor-Match')
          } catch {}
      
          try {
            execSync('systemd-detect-virt -q', { stdio: 'ignore' })    // exit 0 => VM
            return warnAndReturn('systemd-detect-virt meldet Virtualisierung')
          } catch {}


          // Prüfe auf QEMU-Prozesse
          try {
            const ps = execSync('ps aux | grep -i qemu', { encoding: 'utf8' })
            if (ps.includes('qemu') && !ps.includes('grep')) {
              return warnAndReturn('QEMU-Prozess läuft')
            }
          } catch {}
        }

        // ---------- Windows ----------
        if (process.platform === 'win32') {
            try {
            const ps =
                'powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem | ForEach-Object { $_.Manufacturer, $_.Model }) -join \' \'"'
            const basic = execSync(ps, { encoding: 'utf8' }).trim()    // manufacturer + model
            if (VENDORS.test(basic)) return warnAndReturn('Windows Hersteller/Modell passt zu VM')
            } catch {}

            try {
            const psRobust =
                'powershell -NoProfile -Command "$o=@();' +
                'try{$cs=Get-CimInstance Win32_ComputerSystem;$o+=@($cs.Manufacturer,$cs.Model)}catch{};' +
                'try{$bb=Get-CimInstance Win32_BaseBoard;$o+=@($bb.Manufacturer,$bb.Product)}catch{};' +
                'try{$bios=Get-CimInstance Win32_BIOS;$o+=@($bios.SMBIOSBIOSVersion)}catch{};' +
                'try{$csp=Get-CimInstance Win32_ComputerSystemProduct;$o+=@($csp.Name)}catch{};' +
                'Write-Output (($o -join \' \').Trim())"'
            const robust = execSync(psRobust, { encoding: 'utf8' }).trim()
            if (VENDORS.test(robust)) return warnAndReturn('Windows Hersteller/BIOS-Infos passen zu VM')
            } catch {}

            // Zusätzliche QEMU-Erkennung für Windows
            try {
                const qemuProcesses = execSync('tasklist /FI "IMAGENAME eq qemu*"', { encoding: 'utf8' })
                if (qemuProcesses.includes('qemu')) return warnAndReturn('QEMU-Prozess unter Windows')
            } catch {}

            // Windows Sandbox detection - only checks that exist INSIDE sandbox (no false positives)
            // Combined approach: at least 2 indicators required for higher security
            const sandboxIndicators = []
            
            try {
                // Check 1: Registry SandboxId (only exists in running sandbox, not on host)
                const sandboxIdCheck = 'powershell -NoProfile -Command "try { $val = Get-ItemProperty -Path \'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\CI\\Config\' -Name \'SandboxId\' -ErrorAction SilentlyContinue; if ($val -and $val.SandboxId) { Write-Output $val.SandboxId } } catch {}"'
                const sandboxId = execSync(sandboxIdCheck, { encoding: 'utf8' }).trim()
                if (sandboxId && sandboxId.length > 0) {
                    sandboxIndicators.push('SandboxId')
                }
            } catch {}

            try {
                // Check 2: Username is WDAGUtilityAccount (default sandbox user, only exists in sandbox)
                const username = os.userInfo().username
                if (username === 'WDAGUtilityAccount') {
                    sandboxIndicators.push('WDAGUtilityAccount')
                }
            } catch {}

            try {
                // Check 3: MAC address pattern 00:15:5d:* (standard for sandbox network adapter)
                const macCheck = 'powershell -NoProfile -Command "Get-NetAdapter | Where-Object {$_.Status -eq \'Up\'} | Select-Object -ExpandProperty MacAddress | ForEach-Object { if ($_ -match \'00-15-5d\') { Write-Output \'match\' } }"'
                const macResult = execSync(macCheck, { encoding: 'utf8' }).trim()
                if (macResult === 'match') {
                    sandboxIndicators.push('MAC_Address')
                }
            } catch {}

            try {
                // Check 4: ComputerName pattern (often DESKTOP-* in sandbox, only combined with other checks)
                const computerName = execSync('powershell -NoProfile -Command "$env:COMPUTERNAME"', { encoding: 'utf8' }).trim()
                if (computerName && computerName.startsWith('DESKTOP-')) {
                    sandboxIndicators.push('ComputerName')
                }
            } catch {}

            try {
                // Check 5: Disk info (Windows Sandbox uses "Virtual Disk" as disk model)
                const diskCheck = 'powershell -NoProfile -Command "$disks = Get-CimInstance Win32_DiskDrive; foreach ($disk in $disks) { $model = $disk.Model; $serial = $disk.SerialNumber; if ($model -match \'Virtual Disk|WDAG|Sandbox|VHD\' -or $serial -match \'WDAG|Sandbox\') { Write-Output \'match\'; break } }"'
                const diskResult = execSync(diskCheck, { encoding: 'utf8' }).trim()
                if (diskResult === 'match') {
                    sandboxIndicators.push('Disk')
                }
            } catch {}

            try {
                // Check 6: Volume label (Windows Sandbox often uses specific volume labels)
                const volumeCheck = 'powershell -NoProfile -Command "$volumes = Get-CimInstance Win32_LogicalDisk; foreach ($vol in $volumes) { if ($vol.DriveType -eq 3) { $label = $vol.VolumeName; if ($label -and ($label -match \'WDAG|Sandbox|Windows Sandbox\')) { Write-Output \'match\'; break } } }"'
                const volumeResult = execSync(volumeCheck, { encoding: 'utf8' }).trim()
                if (volumeResult === 'match') {
                    sandboxIndicators.push('Volume')
                }
            } catch {}

            // Only if at least 2 indicators found (reduces false positives significantly)
            if (sandboxIndicators.length >= 2) {
                return warnAndReturn(`Windows Sandbox detected (${sandboxIndicators.join(', ')})`)
            }
        }


         // ---------- macOS ----------
        if (process.platform === 'darwin') {
            try {
            const hwModel = execSync('sysctl -n hw.model', { encoding: 'utf8' })
            if (/^virtual/i.test(hwModel) || VENDORS.test(hwModel)) return warnAndReturn('macOS Hardwaremodell deutet auf VM')
            } catch {}

            try {
            const sp = execSync('system_profiler SPHardwareDataType', { encoding: 'utf8' })
            if (VENDORS.test(sp)) return warnAndReturn('macOS system_profiler meldet VM-Vendor')
            } catch {}
        }

        return false       
    }

    compareVersions(versionA, versionB) {
        const partsA = versionA.split('.').map(Number);
        const partsB = versionB.split('.').map(Number);
    
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] || 0; // Fallback auf 0, falls kein Wert vorhanden
            const numB = partsB[i] || 0;
    
            if (numA < numB) return -1;
            if (numA > numB) return 1;
        }
        return 0;
    }
    
    compareReleaseNumbers(statusA, statusB) {
        const numberA = parseInt(statusA.match(/\d+/), 10) || 0;
        const numberB = parseInt(statusB.match(/\d+/), 10) || 0;
    
        if (numberA < numberB) return -1;
        if (numberA > numberB) return 1;
        return 0;
    }

    compareSoftware(versionA, statusA, versionB, statusB) {
        const versionComparison = this.compareVersions(versionA, versionB);
        if (versionComparison !== 0) return versionComparison;
    
        return this.compareReleaseNumbers(statusA, statusB);
    }


}
 
export default new IpcHandler()
