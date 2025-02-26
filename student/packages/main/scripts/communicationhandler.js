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

'use strict'
import {disableRestrictions, enableRestrictions} from './platformrestrictions.js';
import fs from 'fs' 
import archiver from 'archiver'   // das macht krasseste racecoditions mit electron eigenen versionen - unbedingt die selbe version behalten wie electron
import extract from 'extract-zip'
import { join } from 'path'
import { screen, ipcMain, app } from 'electron'
import WindowHandler from './windowhandler.js'
import { execSync } from 'child_process';
const shell = (cmd) => execSync(cmd, { encoding: 'utf8' });

import log from 'electron-log';
import {SchedulerService} from './schedulerservice.ts'
import Tesseract from 'tesseract.js';

const __dirname = import.meta.dirname;
import crypto from 'crypto';
import { Worker } from 'worker_threads';
import path from 'path';

import https from 'https';
const agent = new https.Agent({ rejectUnauthorized: false });




 /**
  * Handles information fetching from the server and acts on status updates
  */
 
 class CommHandler {
    constructor () {
        this.multicastClient = null
        this.config = null
        this.updateStudentIntervall = null
        this.WindowHandler = null
        this.screenshotAbility = false
        this.screenshotFails = 0 // we count fails and deactivate on 4 consequent fails
        this.firstCheckScreenshot = true
        this.lastScreenshotBase64 = false
        this.lastScreenshot = false

        this.worker = new Worker(path.join(__dirname, '../../public/imageWorkerSharp.js'));  // revert back to sharp desipte native libraries that kill every other macos build because of performance issues
        this.worker.on('message', (result) => {
            if (result.success) {
                this.resolvePromise(result);
            } else {
                this.rejectPromise(new Error(result.error));
            }
        });

        this.worker.on('error', error => console.error('Worker error:', error));
        this.worker.on('exit', code => console.log(`Worker stopped with exit code ${code}`));

       


    }
 
    init (mc, config) {
        this.multicastClient = mc
        this.config = config
        this.updateScheduler = new SchedulerService(this.requestUpdate.bind(this), 5000)
        this.updateScheduler.start()
        this.screenshotScheduler = new SchedulerService(this.sendScreenshot.bind(this), this.multicastClient.clientinfo.screenshotinterval)
        this.screenshotScheduler.start()
        


        if (process.platform !== 'linux' || (  !this.isWayland() && this.imagemagickAvailable() || (this.isKDE() && this.isWayland() && this.flameshotAvailable() )  )){ this.screenshotAbility = true } // only on linux we need to check for wayland or the absence of imagemagick - other os have other problems ^^
    }
 
    /**
     * checks for wayland session on linux - no screenshots here for now
     * @returns true or false
     */
    isWayland(){
        return process.env.XDG_SESSION_TYPE === 'wayland'; 
    }


    isKDE(){
        try{ 
            let output = shell('echo $XDG_CURRENT_DESKTOP')
            return output.trim() === 'KDE'
        }
        catch(error){ log.warn("communicationhandler @ isKDE: no data "); return false }
    }
    
    /**
     * Checks if imagemagick on linux is available
     * @returns true or false
     */
    imagemagickAvailable(){
        try{ shell(`which import`); return true}
        catch(error){
            log.error("communicationhandler @ imagemagickAvailable: ImageMagick is required to take screenshots on linux")
            return false
        }
    }
    flameshotAvailable(){
        try{ shell(`which flameshot`); return true}
        catch(error){
            log.error("communicationhandler @ flameshotAvailable: flameshot is required to take screenshots on wayland")
            return false
        }
    }

    /** 
     * Update current Serverstatus + Studenttstatus (every 5 seconds)
     */
    async requestUpdate(){
        if (this.multicastClient.clientinfo.localLockdown){return}

        // connection lost reset triggered  no serversignal for 20 seconds
        if (this.multicastClient.beaconsLost >= 5 ){  
            log.warn("communicationhandler @ requestUpdate: Connection to Teacher lost! Removing registration.") //remove server registration locally (same as 'kick')
            this.multicastClient.beaconsLost = 0
            this.resetConnection()   // this also resets serverip therefore no api calls are made afterwards
            this.killScreenlock()       // just in case screens are blocked.. let students work
        }  

        if (this.multicastClient.clientinfo.serverip) {  //check if server connected - get ip
            const clientInfo = JSON.stringify(this.multicastClient.clientinfo);

            fetch(`https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/update`, {
                method: "POST",
                cache: "no-store",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ clientinfo: clientInfo }),
            })
            .then(response => {
                if (!response.ok) { throw new Error('Network response was not ok'); }
                return response.json();
            })
            .then(data => {
                if (data.status === "error") {
                    if      (data.message === "notavailable"){ log.warn('communicationhandler @ requestUpdate: Exam Instance not found!');        this.multicastClient.beaconsLost = 5; } 
                    else if (data.message === "removed"){      log.warn('communicationhandler @ requestUpdate: Student registration not found!'); this.multicastClient.beaconsLost = 5; } 
                    else {                                     log.warn("communicationhandler @ requestUpdate: 1 Heartbeat lost..");              this.multicastClient.beaconsLost += 1;} 
                } else if (data.status === "success") {
                    this.multicastClient.beaconsLost = 0; // Dies zählt ebenfalls als erfolgreicher Heartbeat - Verbindung halten
                    this.multicastClient.clientinfo.printrequest = false  //set this to false after the request left the client to prevent double triggering
                   
                    // Verarbeitung der empfangenen Daten
                    const serverStatusDeepCopy = JSON.parse(JSON.stringify(data.serverstatus));
                    const studentStatusDeepCopy = JSON.parse(JSON.stringify(data.studentstatus));
                    
                    this.processUpdatedServerstatus(serverStatusDeepCopy, studentStatusDeepCopy);
                }
            })
            .catch(error => {
                this.multicastClient.beaconsLost += 1;
                log.error(`communicationhandler @ requestUpdate: (${this.multicastClient.beaconsLost}) ${error}`);
            });
        }
        else {
            // prevent focus warning block if no connection 
            this.multicastClient.clientinfo.focus = true  // if not connected but still in exam mode you could trigger a focus warning and nobody is able to unlock you
        }
    }



    /** 
     * Update Screenshot on Server  (every 4 seconds - or depending on the server setting)
     * if no screenshot is possible (wayland) capture application window via electron webcontents
     */

    processImage(imgBuffer){
        return new Promise((resolve, reject) => {
            this.resolvePromise = resolve;
            this.rejectPromise = reject;
            this.worker.postMessage({ imgBuffer: imgBuffer });
        });
    }

    terminate() {
        this.worker.terminate();
    }

    async sendScreenshot(){
        if (this.multicastClient.clientinfo.localLockdown){return}
        if (this.multicastClient.beaconsLost >= 5 ){return}  // connection lost reset triggered
        if (this.multicastClient.clientinfo.serverip) {  //check if server connected - get ip
            
            let success, screenshotBase64, headerBase64, isblack; // Variablen außerhalb des if-Blocks definieren
            let imgBuffer = null;

            try {
                if (this.screenshotAbility){  
                    ({ success, screenshotBase64, headerBase64, isblack, imgBuffer } = await this.processImage(false));  // kein imageBuffer mitgegeben bedeutet nutze screenshot-desktop im worker
                    if (success) { this.screenshotFails = 0;}
                    else { 
                        this.screenshotFails +=1;
                        if(this.screenshotFails > 4){ this.screenshotAbility=false; log.error(`communicationhandler @ sendScreenshot: switching to PageCapture`) } 
                    }
                }
                else {
                    //grab "screenshot" from appwindow
                    let currentFocusedMindow = WindowHandler.getCurrentFocusedWindow()  //returns exam window if nothing in focus or main window
                    if (currentFocusedMindow) {
                        imgBuffer = await currentFocusedMindow.webContents.capturePage()  // this should always work because it's onboard electron
                        .then((image) => {
                            const imageBuffer = image.toPNG();// Convert the nativeImage to a Buffer (PNG format)
                            return imageBuffer
                        })
                        .catch((err) => {log.error(`communicationhandler @ sendScreenshot (capturePage): ${err}`)   });
                    }
                    ({ success, screenshotBase64, headerBase64, isblack } = await this.processImage(imgBuffer));
                }
            }
            catch(err){
                log.error(`communicationhandler @ sendScreenshot: processImage failed: ${err}`)
            }

          
            
            /**
             * MACOS WORKAROUND - switch to pagecapture if no permissons are granted
             */
            if (process.platform === "darwin" && this.firstCheckScreenshot && imgBuffer !== null){  //this is for macOS because it delivers a blank background screenshot without permissions. we catch that case with a workaround
                this.firstCheckScreenshot = false   //never do this again

                const publicPath = app.isPackaged
                ? path.join(process.resourcesPath,'app.asar.unpacked', 'public')
                : path.resolve(__dirname, '../../public');

                try{
                 
                    const { data: { text } }   = await Tesseract.recognize(imgBuffer , 'eng',{ langPath: publicPath } );
                    let appWindowVisible = text.includes("Exam")   //check if the word "Exam" can be found in screenshot - otherwise it is most likely a blank desktop - macos quirk
                   
                    if (!appWindowVisible){
                        this.screenshotAbility=false;
                        log.error(`communicationhandler @ sendScreenshot: switching to PageCapture`)
                        log.info("communicationhandler @ sendScreenshot (ocr): Student Screenshot does not fit requirements");
                    }
                    else {
                        log.info("communicationhandler @ sendScreenshot (ocr): MacOS screenshotpermissions check OK");
                    }
                }
                catch(err){  log.info(`communicationhandler @ sendScreenshot (ocr): ${err}`); }
            }




            //do not run colorcheck if already locked
            if ( this.multicastClient.clientinfo.exammode && !this.config.development && this.multicastClient.clientinfo.focus){
                if (isblack){
                    this.multicastClient.clientinfo.focus = false
                    log.info("communicationhandler @ sendScreenshot: Student Screenshot does not fit requirements (allblack)");
                }   
            }
            let screenshothash = null
            try {
                screenshothash = crypto.createHash('md5').update(Buffer.from(screenshotBase64, 'base64')).digest("hex");  // Berechnen des MD5-Hashs des Base64-Strings
            }
            catch(err){
                log.error(`communicationhandler @ sendScreenshot: creating hash failed: ${err.message}`)
            }
          
            
            const payload = {
                clientinfo: {...this.multicastClient.clientinfo},
                screenshot: screenshotBase64,
                screenshothash: screenshothash,
                header: headerBase64,
                screenshotfilename: this.multicastClient.clientinfo.token + ".jpg",
            };
                

            // send screenshot to server via email fetch request
            let attempt = 0;
            const maxRetries = 2;
            const url = `https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/updatescreenshot`;
            this.doScreenshotUpdate(url, payload, agent, attempt, maxRetries); // Erste Anfrage starten
        }
    }





    doScreenshotUpdate(url, payload, agent, attempt = 0, maxRetries) {
        fetch(url, {
            method: "POST",
            cache: "no-store",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            agent,
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('communicationhandler @ sendScreenshot: Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.status === "error") {
                log.error("communicationhandler @ sendScreenshot: status error", data.message);
            }
        })
        .catch(error => {
            if (attempt < maxRetries - 1) {
                this.doScreenshotUpdate(url, payload, agent, attempt + 1, maxRetries); // Retry
            } else if (attempt === maxRetries - 1 && this.multicastClient.beaconsLost === 0) {
                log.error(`communicationhandler @ sendScreenshot (fetch): ${error.message}`);
            }
        });
    }











    /**
     * react to server status 
     * this currently only handle startexam & endexam
     * could also handle kick, focusrestore, and even trigger file requests
     */
    async processUpdatedServerstatus(serverstatus, studentstatus){
       
        ///////////////////////////////
        // individual status updates

        if ( studentstatus && Object.keys(studentstatus).length !== 0) {  // we have status updates (tasks) - do it!
            if (studentstatus.printdenied) {
                WindowHandler.examwindow.webContents.send('denied')   //trigger, why
            }

            if (studentstatus.delfolder === true){
                log.info("communicationhandler @ processUpdatedServerstatus: cleaning exam workfolder")
                let delfolder = true
                try {
                    if (fs.existsSync(this.config.examdirectory)){   // set by server.js (desktop path + examdir)
                        fs.rmSync(this.config.examdirectory, { recursive: true });
                        fs.mkdirSync(this.config.examdirectory);
                    }
                } catch (error) { 
                    delfolder = false
                    WindowHandler.examwindow.webContents.send('fileerror', error)  
                    log.error(`communicationhandler @ processUpdatedServerstatus: Can not delete directory - ${error} `)
                }

                if (delfolder == false){  //try deleting file by file (the one that causes the problem will stay in the folder)
                    if (fs.existsSync(this.config.examdirectory)) {
                        const files = fs.readdirSync(this.config.examdirectory);

                        files.forEach(file => {
                            const filePath = join(this.config.examdirectory, file);
                            try {
                                const stats = fs.statSync(filePath);
                                if (stats.isDirectory()) { fs.rmSync(filePath, { recursive: true }); }  // Versuche, das Verzeichnis rekursiv zu löschen
                                else { fs.unlinkSync(filePath);  }// Versuche, die Datei zu löschen 
                            }
                            catch (error) {
                                log.error(`communicationhandler @ processUpdatedServerstatus: (delfolder) Fehler beim Löschen der Datei/Verzeichnis: ${filePath}`, error);
                            }
                        });
                    }
                }
                if (WindowHandler.examwindow) {  WindowHandler.examwindow.webContents.send('loadfilelist');   }
            }


            if (studentstatus.focus == false){
                this.multicastClient.clientinfo.focus = false
            }

            if (studentstatus.restorefocusstate === true){
                log.info("communicationhandler @ processUpdatedServerstatus: restoring focus state for student")
                this.multicastClient.clientinfo.focus = true
                if (WindowHandler.examwindow && !this.config.development){ 
                    WindowHandler.examwindow.setKiosk(true)
                    WindowHandler.examwindow.focus()
                }
            }
            if (studentstatus.activatePrivateSpellcheck == true && this.multicastClient.clientinfo.privateSpellcheck.activated == false  ){
                log.info("communicationhandler @ processUpdatedServerstatus: activating spellcheck for student")
                this.multicastClient.clientinfo.privateSpellcheck.activate = true  //clientinfo.privateSpellcheck will be put on this.privateSpellcheck in editor updated via fetchInfo()
                this.multicastClient.clientinfo.privateSpellcheck.activated = true
                ipcMain.emit("startLanguageTool")
            }
            if (studentstatus.activatePrivateSpellcheck == false && this.multicastClient.clientinfo.privateSpellcheck.activated == true ) {
                log.info("communicationhandler @ processUpdatedServerstatus: de-activating spellcheck for student")
                this.multicastClient.clientinfo.privateSpellcheck.activate = false
                this.multicastClient.clientinfo.privateSpellcheck.activated = false 
            }

            this.multicastClient.clientinfo.privateSpellcheck.suggestions = studentstatus.activatePrivateSuggestions

            if (studentstatus.sendexam === true){
                this.sendExamToTeacher()
            }
            if (studentstatus.fetchfiles === true){
                this.requestFileFromServer(studentstatus.files)
            }
            // this is an microsoft365 thing. check if exam mode is office, check if this is set - otherwise do not enter exammode - it will fail
            if (studentstatus.msofficeshare){
                //set or update sharing link - it will be used in "microsoft365" exam mode
                this.multicastClient.clientinfo.msofficeshare = studentstatus.msofficeshare  
            }
            if (studentstatus.group){
                //set or update group 
                this.multicastClient.clientinfo.group = studentstatus.group  
                if (WindowHandler.examwindow){  
                    WindowHandler.examwindow.webContents.send('getmaterials')  // if we change group we need to get the materials again
                }
            }

        

        }


        ////////////////////////////////
        // global status updates
        ////////////////////////////////

        
        /***********************************
         * SWITCH EXAM SECTION  START
         */

        // if student is in locked state in exam mode
        if (serverstatus.exammode && this.multicastClient.clientinfo.exammode){
           

            //check if the current active section is the same as the one in the serverstatus - if not change to the new section
            if (serverstatus.lockedSection !== this.multicastClient.clientinfo.lockedSection){
                log.warn("communicationhandler @ processUpdatedServerstatus: changing section to", serverstatus.lockedSection)

                this.multicastClient.clientinfo.lockedSection = serverstatus.lockedSection
          

                //save all files from the old section (if exam mode is "editor") and send to teacher - trigger sendToTeacher()
                if (this.multicastClient.clientinfo.examtype === "editor"){
                    log.info("communicationhandler @ processUpdatedServerstatus: sending exam to teacher (final submit)")

                    // send current work as base64 to teacher (stores pdf in ABGABE folder with submission number)
                    let pdf = await this.getBase64PDF(this.multicastClient.clientinfo.submissionnumber)  // local function to get base64 pdf from editor
                    if (pdf.status === "success"){
                        this.sendBase64PDFtoTeacher(pdf.base64pdf)
                    }
                }
                this.sendToTeacher() //backup local files and send to teacher (archive with timestamp)


                // update examtype in clientinfo
                this.multicastClient.clientinfo.examtype = serverstatus.examSections[serverstatus.lockedSection].examtype
           

                //wait 1 second and cleanup NEXT-EXAM-STUDENT-WORKDIR
                await this.sleep(2000)
                try {
                    log.warn("communicationhandler @ processUpdatedServerstatus: cleaning exam workfolder")
                    if (fs.existsSync(this.config.examdirectory)){   // set by server.js (desktop path + examdir)
                        fs.rmSync(this.config.examdirectory, { recursive: true });
                        fs.mkdirSync(this.config.examdirectory);
                    }
                } catch (error) {
                    log.error(`communicationhandler @ processUpdatedServerstatus: Can not delete directory - ${error} `)
                }
                
                //close exam window or relead the new exam section in the same window
                if (WindowHandler.examwindow){
                    if ( serverstatus.examSections[serverstatus.lockedSection].examtype === "microsoft365"){
                        //close exam window and reopen it with the new exam section
                        WindowHandler.examwindow.close();
                        WindowHandler.examwindow.destroy();
                        WindowHandler.examwindow = null;
                        this.startExam(serverstatus)
                    }
                    else {   // just switch exam mode in active window
                        let url = serverstatus.examSections[serverstatus.lockedSection].examtype   // editor || math || tbd.
                        let token = this.multicastClient.clientinfo.token
                         
                        if (app.isPackaged) {
                            let path = join(__dirname, `../renderer/index.html`)
                            WindowHandler.examwindow.loadFile(path, {hash: `#/${url}/${token}`})
                        } 
                        else {
                            url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}/#/${url}/${token}/`
                            WindowHandler.examwindow.loadURL(url)
                        }
                    }
                }


                if (WindowHandler.examwindow){ 

                    WindowHandler.examwindow.serverstatus = serverstatus   // overwrite serverstatus in examwindow

                    const webContents = WindowHandler.examwindow.webContents;
                    // Remove any existing 'will-navigate' listeners
                    webContents.removeAllListeners('will-navigate');
                    // Set new listener for "editor" examtype
                    if (serverstatus.examSections[serverstatus.lockedSection].examtype === "editor" ){  // do not under any circumstances allow navigation away from the editor
                        webContents.on('will-navigate', (event, url) => {    // a pdf could contain a link - ATTENTION: also set in windowhandler.js (or direct to a common function)
                            if ( url.includes( serverstatus.examSections[serverstatus.lockedSection].allowedUrl)){
                                console.log("url allowed")
                            }
                            else {
                                console.log("blocked leaving exam mode")
                                event.preventDefault()
                            }
                        })
                    }
                }
            }
        }
        /**
         * SWITCH EXAM SECTION  END
         ************************************/
      


        if (serverstatus.screenslocked && !this.multicastClient.clientinfo.screenlock) {  this.activateScreenlock() }
        else if (!serverstatus.screenslocked ) { this.killScreenlock() }

        // screenshot safety (OCR searches for next-exam string)
        if (serverstatus.screenshotocr) { this.multicastClient.clientinfo.screenshotocr = true  }
        else { this.multicastClient.clientinfo.screenshotocr = false   }

        // Groups handling
        if (serverstatus.examSections[serverstatus.lockedSection].groups){ this.multicastClient.clientinfo.groups = true}
        else { this.multicastClient.clientinfo.groups = false}

        //update screenshotinterval
        if (serverstatus.screenshotinterval || serverstatus.screenshotinterval === 0) { //0 is the same as false or undefined but should be treated as number
            
            if (this.multicastClient.clientinfo.screenshotinterval !== serverstatus.screenshotinterval*1000 ) {
                log.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval changed to", serverstatus.screenshotinterval*1000)
                this.multicastClient.clientinfo.screenshotinterval = serverstatus.screenshotinterval*1000
                  if ( serverstatus.screenshotinterval == 0) {
                    log.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval disabled!")
                }
                // clear old interval and start new interval if set to something bigger than zero
                this.screenshotScheduler.stop()
                
                if (this.multicastClient.clientinfo.screenshotinterval > 0){
                    this.screenshotScheduler.interval = this.multicastClient.clientinfo.screenshotinterval
                    this.screenshotScheduler.start()
                   
                }
            }
        }
        
        if (serverstatus.exammode && !this.multicastClient.clientinfo.exammode){
            this.killScreenlock() // remove lockscreen immediately - don't wait for server info
            this.startExam(serverstatus)
        }
        else if (!serverstatus.exammode && this.multicastClient.clientinfo.exammode){
            this.killScreenlock() 
            this.endExam(serverstatus)
        }

    }

    // send base64 pdf to teacher
    sendBase64PDFtoTeacher(base64pdf){
        const url = `https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/printrequest/${this.multicastClient.clientinfo.servername}/${this.multicastClient.clientinfo.token}`;
        const payload = {
            document: base64pdf,
            printrequest: false,    
            submissionnumber: this.multicastClient.clientinfo.submissionnumber
        }
        fetch(url, {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' },
        })
        .then(response => { return response.json();  })
        .then(data => {
            if (data.message == "success"){
                this.multicastClient.clientinfo.submissionnumber++   // successful submission -> increment number
            }
        })
        .catch(error => {  
            console.log("editor @ printbase64:",error.message)    
        }); 
    }
    



    //get base64 pdf from editor
    async getBase64PDF(submissionnumber){
        log.info("communicationhandler @ getBase64PDF: getting base64 encoded pdf")
        var options = {
            margins: {top:0.5, right:0, bottom:0.5, left:0 },
            pageSize: 'A4',
            printBackground: false,
            printSelectionOnly: false,
            landscape: false,
            displayHeaderFooter:true,
            footerTemplate: "<div style='height:12px; font-size:10px; text-align: right; width:100%; margin-right: 20px;'><span class=pageNumber></span>|<span class=totalPages></span></div>",
            headerTemplate: `<div style='display: inline-block; height:12px; font-size:10px; text-align: right; width:100%; margin-right: 20px;margin-left: 20px;'><span style="float:left;">${this.multicastClient.clientinfo.servername}</span><span style="float:left;">&nbsp;|&nbsp; </span><span class=date style="float:left;"></span><span style="float:left;">&nbsp;|&nbsp;Abgabe: ${submissionnumber}</span><span style="float:right;">${this.multicastClient.clientinfo.clientname}</span></div>`,
            preferCSSPageSize: false
        }
        // set the title of the exam window and therefore the document title
        await WindowHandler.examwindow.webContents.executeJavaScript(`document.title = "${this.multicastClient.clientinfo.clientname} - ${this.multicastClient.clientinfo.servername} - Version ${submissionnumber}"`);
        try {
            const data = await WindowHandler.examwindow.webContents.printToPDF(options);
            const base64pdf = data.toString('base64');
            const dataUrl = `data:application/pdf;base64,${base64pdf}`;
            return { sender: "client", message:"PDF generated", dataUrl:dataUrl, base64pdf: base64pdf, status: "success" };
        } catch (error) {
            log.error("Error generating PDF:", error);
            return { sender: "client", message: "Error generating PDF", status: "error" };
        }
    }

    // show temporary screenlock window
    activateScreenlock(){
        let displays = screen.getAllDisplays()
        let primary = screen.getPrimaryDisplay()
        if (!primary || primary === "" || !primary.id){ primary = displays[0] }       
       
        if (WindowHandler.screenlockwindows.length == 0){  // why do we check? because exammode is left if the server connection gets lost but students could reconnect while the exam window is still open and we don't want to create a second one
            this.multicastClient.clientinfo.screenlock = true
            for (let display of displays){
                WindowHandler.createScreenlockWindow(display)  // add blockwindows for additional displays
            } 
        }
    }

    // remove temporary screenlockwindow
    killScreenlock(){
        try {
            for (let screenlockwindow of WindowHandler.screenlockwindows){
                screenlockwindow.close(); 
                screenlockwindow.destroy(); 
                screenlockwindow = null;
            }
        } catch (e) { 
            WindowHandler.screenlockwindows = []
            log.error("communicationhandler @ killScreenlock: no functional screenlockwindow to handle")
        } 
        WindowHandler.screenlockwindows = []
        this.multicastClient.clientinfo.screenlock = false
    }














    /**
     * Starts exam mode for student
     * deletes workfolder contents (if set)
     * opens a new window in kiosk mode with the given examtype
     * enables the blur listener and activates restrictions (disable keyboarshortcuts etc.)
     * @param serverstatus contains information about exammode, examtype, and other settings from the teacher instance
     */
    async startExam(serverstatus){
  
        let displays = screen.getAllDisplays()
        let primary = screen.getPrimaryDisplay()
       
        if (!primary || primary === "" || !primary.id){ primary = displays[0] }       

        this.multicastClient.clientinfo.exammode = true
        this.multicastClient.clientinfo.lockedSection = serverstatus.lockedSection
        this.multicastClient.clientinfo.cmargin = serverstatus.examSections[serverstatus.lockedSection].cmargin  // this is used to configure margin settings for the editor
        this.multicastClient.clientinfo.linespacing = serverstatus.examSections[serverstatus.lockedSection].linespacing // we try to double linespacing on demand in pdf creation
        this.multicastClient.clientinfo.audioRepeat = serverstatus.examSections[serverstatus.lockedSection].audioRepeat // restrict repetition of audio files (for listening comprehension)

        if (!WindowHandler.examwindow){  // why do we check? because exammode is left if the server connection gets lost but students could reconnect while the exam window is still open and we don't want to create a second one
            log.info("communicationhandler @ startExam: creating exam window")
            this.multicastClient.clientinfo.examtype = serverstatus.examSections[serverstatus.lockedSection].examtype
            WindowHandler.createExamWindow(serverstatus.examSections[serverstatus.lockedSection].examtype, this.multicastClient.clientinfo.token, serverstatus, primary);
        }
        else if (WindowHandler.examwindow){  //reconnect into active exam session with exam window already open
            log.error("communicationhandler @ startExam: found existing Examwindow..")
            try {  // switch existing window back to exam mode
                WindowHandler.examwindow.show() 
                if (!this.config.development) { 
                    WindowHandler.examwindow.setFullScreen(true)  //go fullscreen again
                    WindowHandler.examwindow.setAlwaysOnTop(true, "screen-saver", 1)  //make sure the window is 1 level above everything
                    enableRestrictions(WindowHandler)
                    await this.sleep(2000) // wait an additional 2 sec for windows restrictions to kick in (they steal focus)
                    WindowHandler.addBlurListener();
                }   
            }
            catch (e) { //examwindow variable is still set but the window is not managable anymore (manually closed in dev mode?)
                log.error("communicationhandler @ startExam: no functional examwindow found.. resetting")
                
                disableRestrictions(WindowHandler.examwindow)  //examwindow is given but not used in disableRestrictions
                WindowHandler.examwindow = null;
                this.multicastClient.clientinfo.exammode = false
                this.multicastClient.clientinfo.focus = true
                return  // in that case.. we are finished here !
            }
        }

        if (!this.config.development) {  // lock additional screens
            for (let display of displays){
                if ( display.id !== primary.id ) {
                    if ( !this.isApproximatelyEqual(display.bounds.x, primary.bounds.x)) {  //on kde displays may be manually positioned at 1920px or 1921px so we allow a range to identify overlapping (cloned) displays
                        log.info("create blockwin on:",display.id)
                        WindowHandler.newBlockWin(display)  // add blockwindows for additional displays
                    } 
                }
            }
            await this.sleep(1000)
            WindowHandler.blockwindows.forEach( (blockwin) => {
                blockwin.moveTop();
            })
        }
    }


    //returns true if a number is within tolerance 
    isApproximatelyEqual(x1, x2, tolerance = 4) {
        return Math.abs(x1 - x2) <= tolerance;
    }



    /**
     * Disables Exam mode
     * closes exam window
     * disables restrictions and blur 
     */
    async endExam(serverstatus){
        log.info(serverstatus)
        // delete students work on students pc (makes sense if exam is written on school property)
        if (serverstatus.delfolderonexit === true){
            log.info("communicationhandler @ endExam: cleaning exam workfolder on exit")
            try {
                if (fs.existsSync(this.config.examdirectory)){   // set by server.js (desktop path + examdir)
                    fs.rmSync(this.config.examdirectory, { recursive: true });
                    fs.mkdirSync(this.config.examdirectory);
                }
            } catch (error) { log.error("communicationhandler @ endExam: ",error); }
        }
        WindowHandler.removeBlurListener();
        disableRestrictions()

        if (WindowHandler.examwindow){ // in some edge cases in development this is set but still unusable - use try/catch   
            try {  //send save trigger to exam window
                if (!serverstatus.delfolderonexit){
                    WindowHandler.examwindow.webContents.send('save', 'exitexam') //trigger, why
                    await this.sleep(3000)  // give students time to read whats happening (and the editor time to save the content)
                }
                WindowHandler.examwindow.close(); 
                WindowHandler.examwindow.destroy(); 
            }
            catch(e){ log.error(e)}
           
            try {
                for (let blockwindow of WindowHandler.blockwindows){
                    blockwindow.close(); 
                    blockwindow.destroy(); 
                    blockwindow = null;
                }
            } catch (e) { 
                WindowHandler.blockwindows = []
                log.error("communicationhandler @ endExam: no functional blockwindow to handle")
            }  
        }
        WindowHandler.blockwindows = []
        WindowHandler.examwindow = null;
        this.multicastClient.clientinfo.exammode = false
        this.multicastClient.clientinfo.focus = true

        // ask student to quit app after finishing exam
        WindowHandler.showExitQuestion()
    }


    // this is manually  triggered if connection is lost during exam - we allow the student to get out of the kiosk mode but keep his work in the editor
    // for some reason i changed this function to also kill the exam window and therefore exit the exam completely so this is basically redundant
    async gracefullyEndExam(){
        disableRestrictions()

        if (WindowHandler.examwindow){ 
            WindowHandler.examwindow.webContents.send('save','auto')
            await this.sleep(1000)
           
            this.multicastClient.clientinfo.exammode = false
            log.warn("communicationhandler @ gracefullyEndExam: Manually Unlocking Workstation")
            
            try {
                // remove listener
                WindowHandler.removeBlurListener();
                WindowHandler.examwindow.close(); 
                if (WindowHandler.examwindow){ WindowHandler.examwindow.destroy(); }
                WindowHandler.examwindow = null
              
            } catch (e) { 
                WindowHandler.examwindow = null
                log.error("communicationhandler @ gracefullyEndExam: no functional examwindow to handle")
            }
          
            try {
                for (let blockwindow of WindowHandler.blockwindows){
                    blockwindow.close(); 
                    blockwindow.destroy(); 
                    blockwindow = null;
                }
            } catch (e) { 
                WindowHandler.blockwindows = []
                log.error("communicationhandler @ gracefullyEndExam: no functional blockwindow to handle")
            }   
        }
      
        WindowHandler.blockwindows = []
        WindowHandler.examwindow = null
        this.multicastClient.clientinfo.focus = true
        this.multicastClient.clientinfo.exammode = false
        this.multicastClient.clientinfo.localLockdown = false;
    }

    // reset all variables that signal or need a valid teacher connection
    resetConnection(){
        this.multicastClient.clientinfo.token = false
        this.multicastClient.clientinfo.ip = false
        this.multicastClient.clientinfo.serverip = false
        this.multicastClient.clientinfo.servername = false
        this.multicastClient.clientinfo.focus = true  // we are focused 
        //this.multicastClient.clientinfo.exammode = false   // do not set to false until exam window is manually closed
        this.multicastClient.clientinfo.timestamp = false
        this.multicastClient.clientinfo.localLockdown = false
        //this.multicastClient.clientinfo.virtualized = false  // this check happens only at the application start.. do not reset once set
    }
 



    /**
     * diese methode holt sich, die vom teacher zum download bereitgelegten dateien
     * über das update interval wird der trigger zum download und die filelist erhalten
     * @param {*} files 
     */
    requestFileFromServer(files){
        let servername = this.multicastClient.clientinfo.servername
        let serverip = this.multicastClient.clientinfo.serverip
        let token = this.multicastClient.clientinfo.token
        let backupfile = false
        for (const file of files) {
            if (file.name && file.name.includes('bak')){
                backupfile = file.name
            }
        }
        

        // Daten für den POST-Request vorbereiten
        let data = JSON.stringify({ 'files': files, 'type': 'studentfilerequest' });

        // Fetch-Request mit den entsprechenden Optionen
        fetch(`https://${serverip}:${this.config.serverApiPort}/server/data/download/${servername}/${token}`, {
            method: "POST",
            body: data,
            headers: { 'Content-Type': 'application/json' },
        })
        .then(response => response.arrayBuffer()) // Antwort als ArrayBuffer erhalten
        .then(buffer => {
            let absoluteFilepath = join(this.config.tempdirectory, token.concat('.zip'));
            fs.writeFile(absoluteFilepath, Buffer.from(buffer), (err) => {
                if (err) { log.error(err);  } 
                else {
                    extract(absoluteFilepath, { dir: this.config.examdirectory }) 
                    .then(() => {
                        log.info("CommunicationHandler @ requestFileFromServer: files received and extracted");
                        return fs.promises.unlink(absoluteFilepath); // Verwendung der Promise-basierten API von fs
                    })
                    .then(() => {
                        if (backupfile && WindowHandler.examwindow) {
                            WindowHandler.examwindow.webContents.send('backup', backupfile);
                            log.warn("CommunicationHandler @ requestFileFromServer: Trigger Replace Event");
                        }
                        if (WindowHandler.examwindow) {  WindowHandler.examwindow.webContents.send('loadfilelist');   }
                    })
                    .catch(err => {
                        log.error(err);
                    });
                }
            });
        })
        .catch(err => log.error(`CommunicationHandler - requestFileFromServer: ${err}`));
    }




    async sendExamToTeacher(){
        //send save trigger to exam window
        if (WindowHandler.examwindow){  //there is a running exam - save current work first!
            try {
                WindowHandler.examwindow.webContents.send('save','teacherrequest')   //trigger, why  (teacherrequest will also trigger sendToTeacher() after saving the pdf)
            }
            catch(err){ 
                log.error(`Communication handler @ sendExamToTeacher: Could not save students work. Is exammode active?`)
            }
        }
        else {  // not running exam (probably using next-exam as classroommanagment tool)
            this.sendToTeacher()   //zip directory and send to teacher api
        }

     }


      //zip config.work directory and send to teacher
     async sendToTeacher(){
        try { if (!fs.existsSync(this.config.tempdirectory)){ fs.mkdirSync(this.config.tempdirectory); }
        }catch (e){ log.error(e)}

        //fsExtra.emptyDirSync(this.config.tempdirectory)
        let zipfilename = this.multicastClient.clientinfo.name.concat('.zip')
        let servername = this.multicastClient.clientinfo.servername
        let serverip = this.multicastClient.clientinfo.serverip
        let token = this.multicastClient.clientinfo.token
        let zipfilepath = join(this.config.tempdirectory, zipfilename);
     

        let base64File = null
        try {
            await this.zipDirectory(this.config.examdirectory, zipfilepath)
            const fileContent = fs.readFileSync(zipfilepath);
            base64File = fileContent.toString('base64');
        }catch (e){  log.error(e)  }

        // sending the whole directory as zip file base64encoded via JSON isn't probably the best method but it works while all formData approaches failed with
        // fetch() while they worked with ax ios() - not even chatgpt or stackoverflow could help ^^ i think it is related to the specific formData module that cant be imported without "window error"
        const url = `https://${serverip}:${this.config.serverApiPort}/server/data/receive/${servername}/${token}`;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: base64File, filename: zipfilename }),
        })
        .then(response => response.json())
        .then(data => { log.info(`communicationhandler @ sendExamToTeacher: teacher response: ${data.message}`); })
        .catch(error => {log.error(`communicationhandler @ sendExamToTeacher: ${error}`); });
     }






    /**
     * @param {String} sourceDir: /some/folder/to/compress
     * @param {String} outPath: /path/to/created.zip
     * @returns {Promise}
     */
    zipDirectory(sourceDir, outPath) {
        const archive = archiver('zip', { zlib: { level: 9 }});
        const stream = fs.createWriteStream(outPath);
        return new Promise((resolve, reject) => {
        archive
            .directory(sourceDir, false)
            .on('error', err => reject(err))
            .pipe(stream)
        ;
        stream.on('close', () => resolve());
        archive.finalize();
        }).catch( error => { log.error(error)});
    }






    // timeout 
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
   
 }
 
 export default new CommHandler()
 