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
import crypto from 'crypto';
import archiver from 'archiver'
import extract from 'extract-zip'
import screenshot from 'screenshot-desktop'
// import FormData from 'form-data/lib/form_data.js';     //we need to import the file directly otherwise it will introduce a "window" variable in the backend and fail
import { join } from 'path'
import { screen } from 'electron'
import WindowHandler from './windowhandler.js'
import sharp from 'sharp'
import { execSync } from 'child_process';
const shell = (cmd) => execSync(cmd, { encoding: 'utf8' });
import log from 'electron-log/main';

import {SchedulerService} from './schedulerservice.ts'
import Tesseract from 'tesseract.js';
let TesseractWorker = false


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
    }
 
    init (mc, config) {
        this.multicastClient = mc
        this.config = config

        this.heartbeatScheduler = new SchedulerService(this.sendHeartbeat.bind(this), 4000)
        this.heartbeatScheduler.start()

        this.updateScheduler = new SchedulerService(this.requestUpdate.bind(this), 5000)
        this.updateScheduler.start()

        this.screenshotScheduler = new SchedulerService(this.sendScreenshot.bind(this), this.multicastClient.clientinfo.screenshotinterval)
        this.screenshotScheduler.start()

   
        if (process.platform !== 'linux' || (  !this.isWayland() && this.imagemagickAvailable()  )){ this.screenshotAbility = true } // only on linux we need to check for wayland or the absence of imagemagick - other os have other problems ^^
    }
 
    /**
     * checks for wayland session on linux - no screenshots here for now
     * @returns true or false
     */
    isWayland(){
        try{ 
            let output = shell(`loginctl show-session $(loginctl | grep $(whoami) | awk '{print $1}') -p Type`); 
            if (output.includes('wayland')){ return true } 
            return false
        } catch(error){
            log.error("Next-Exam detected a Wayland Session - Screenshots are not supported yet")
            return false
        }
    }
    
    /**
     * Checks if imagemagick on linux is available
     * @returns true or false
     */
    imagemagickAvailable(){
        try{ shell(`which import`); return true}
        catch(error){
            log.error("ImageMagick is required to take screenshots on linux")
            return false
        }
    }

    /** 
     * SEND HEARTBEAT in order to set Online/Offline Status 
     * 5 Heartbeats lost is considered offline 
     */
    async sendHeartbeat(){
        // CONNECTION LOST - UNLOCK SCREEN
        if (this.multicastClient.beaconsLost >= 5 ){ // no serversignal for 20 seconds
            log.warn("communicationhandler @ sendHeartbeat: Connection to Teacher lost! Removing registration.") //remove server registration locally (same as 'kick')
            this.multicastClient.beaconsLost = 0
            this.resetConnection()   // this also resets serverip therefore no api calls are made afterwards
            this.killScreenlock()       // just in case screens are blocked.. let students work
        }
        let heartbeatURL = `https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/heartbeat/${this.multicastClient.clientinfo.servername}/${this.multicastClient.clientinfo.token}`

        // ACTIVE SERVER CONNECTION - SEND HEARTBEAT
        if (this.multicastClient.clientinfo.serverip) { 
            fetch(heartbeatURL, {    //probably better to use  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
                method: "POST",
                cache: "no-store",
                body: ""
            })
            .then(response => response.json())
            .then(data => {
                if (data && data.status === "error") { 
                    if      (data.message === "notavailable"){ log.warn('communicationhandler @ sendHeartbeat: Exam Instance not found!');        this.multicastClient.beaconsLost = 5} 
                    else if (data.message === "removed"){      log.warn('communicationhandler @ sendHeartbeat: Student registration not found!'); this.multicastClient.beaconsLost = 5} 
                    else { this.multicastClient.beaconsLost += 1;       log.warn("communicationhandler @ sendHeartbeat: heartbeat lost..") } 
                }
                else if (data && data.status === "success") {  this.multicastClient.beaconsLost = 0  }
            })
            .catch(error => { log.error(`communicationhandler @ sendHeartbeat: ${error}`); this.multicastClient.beaconsLost += 1; });
        }
        else {
            // no focus warning block if no connection 
            this.multicastClient.clientinfo.focus = true  // if not connected but still in exam mode you could trigger a focus warning and nobody is able to unlock you
        }
    }


    /** 
     * Update current Serverstatus + Studenttstatus (every 5 seconds)
     */
    async requestUpdate(){
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
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.status === "error") {
                    log.error("communicationhandler @ requestUpdate: status error - try again in 5 seconds");
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
                log.error(`communicationhandler @ requestUpdate: ${error}`);
                log.error("communicationhandler @ requestUpdate: failed - try again in 5 seconds");
            });
        }
    }



    /** 
     * Update Screenshot on Server  (every 4 seconds - or depending on the server setting)
     */
    async sendScreenshot(){
        if (this.multicastClient.clientinfo.serverip) {  //check if server connected - get ip
            let img = null
            if (this.screenshotAbility){   // "imagemagick" has to be installed for linux - wayland is not (yet) supported by imagemagick !!
                img = await screenshot()   //grab "screenshot" with screenshot node module
                .then( (res) => { this.screenshotFails=0; return res} )
                .catch((err) => { this.screenshotFails+=1; if(this.screenshotFails > 4){ this.screenshotAbility=false;log.error(`requestUpdate Screenshot: switching to PageCapture`) } log.error(`requestUpdate Screenshot: ${err}`) });
            }
            else {
                //grab "screenshot" from appwindow
                let currentFocusedMindow = WindowHandler.getCurrentFocusedWindow()  //returns exam window if nothing in focus or main window
                if (currentFocusedMindow) {
                    img = await currentFocusedMindow.webContents.capturePage()  // this should always work because it's onboard electron
                    .then((image) => {
                        const imageBuffer = image.toPNG();// Convert the nativeImage to a Buffer (PNG format)
                        return imageBuffer
                      })
                    .catch((err) => {log.error(`communicationhandler @ sendScreenshot: ${err}`)   });
                }
            }

            if (Buffer.isBuffer(img)) {
                try {
                    let sWidth = 1440
                    const resized = await sharp(img)
                        .resize(sWidth) // Gewünschte Breite setzen; Höhe wird proportional skaliert
                        .toFormat('jpeg')
                        .jpeg({ quality: 65, mozjpeg: true }) // Gewünschte JPEG-Qualität setzen
                        .toBuffer();
                    
                    const screenshotBase64 = resized.toString('base64');
                    const screenshotfilename = this.multicastClient.clientinfo.token + ".jpg";
                    const hash = crypto.createHash('md5').update(resized).digest("hex");
                    
                    // send the top 64 px (next-exam header) for OCR scan
                    const header = await sharp(resized).extract({ width: sWidth, height: 100, left: 0, top: 0 }).toBuffer();
                    const headerBase64 = header.toString('base64');

              
                    if ( this.multicastClient.clientinfo.exammode && this.multicastClient.clientinfo.screenshotocr && !this.config.development ){
                        try{

                            if (!TesseractWorker){
                                TesseractWorker = await Tesseract.createWorker('eng');
                            }

                            const { data: { text } }   = await Tesseract.recognize(header , 'eng' );
                            let pincodeVisible = text.includes(this.multicastClient.clientinfo.pin)
        
                            if (!pincodeVisible){
                                this.multicastClient.clientinfo.focus = pincodeVisible
                                log.info("communicationhandler @ sendScreenshot (ocr): Student Screenshot does not fit requirements");
                            }
                        }
                        catch(err){
                            log.info(`communicationhandler @ sendScreenshot (ocr): ${err}`);
                        }
                    }
        
                    const payload = {
                        clientinfo: {...this.multicastClient.clientinfo},
                        screenshot: screenshotBase64,
                        screenshothash: hash,
                        screenshotfilename: screenshotfilename,
                        header : headerBase64
                    };
                    
                    fetch(`https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/updatescreenshot`, {
                        method: "POST",
                        cache: "no-store",
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                    })
                    .then(response => {
                        if (!response.ok) { throw new Error('Network response was not ok');  }
                        return response.json();
                    })
                    .then(data => {
                        if (data && data.status === "error") { log.error("communicationhandler @ sendScreenshot: status error", data.message); }
                    })
                    .catch(error => {
                        log.error(`communicationhandler @ sendScreenshot: ${error}`);
                    });
                } catch (error) {
                    console.error('Error resizing image:', error);
                    throw error; // Fehler weitergeben für weitere Fehlerbehandlung
                }
            } else {
                log.error("Image is not a buffer:", img);
            }
        }
    }

















    /**
     * react to server status 
     * this currently only handle startexam & endexam
     * could also handle kick, focusrestore, and even trigger file requests
     */
    processUpdatedServerstatus(serverstatus, studentstatus){

        // individual status updates
        if ( studentstatus && Object.keys(studentstatus).length !== 0) {  // we have status updates (tasks) - do it!
            if (studentstatus.printdenied) {
                WindowHandler.examwindow.webContents.send('denied','toomany')   //trigger, why
            }

            if (studentstatus.delfolder === true){
                log.info("communicationhandler @ processUpdatedServerstatus: cleaning exam workfolder")
                let delfolder = true
                try {
                    if (fs.existsSync(this.config.workdirectory)){   // set by server.js (desktop path + examdir)
                        fs.rmSync(this.config.workdirectory, { recursive: true });
                        fs.mkdirSync(this.config.workdirectory);
                    }
                } catch (error) { 
                    delfolder = false
                    WindowHandler.examwindow.webContents.send('fileerror', error)  
                    log.error(`communicationhandler @ processUpdatedServerstatus: Can not delete directory - ${error} `)
                }

                if (delfolder == false){  //try deleting file by file (the one that causes the problem will stay in the folder)
                    if (fs.existsSync(this.config.workdirectory)) {
                        const files = fs.readdirSync(this.config.workdirectory);

                        files.forEach(file => {
                            const filePath = join(this.config.workdirectory, file);
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
            if (studentstatus.restorefocusstate === true){
                log.info("communicationhandler @ processUpdatedServerstatus: restoring focus state for student")
                this.multicastClient.clientinfo.focus = true
                
                if (WindowHandler.examwindow && !this.config.development){ 
                    WindowHandler.examwindow.setKiosk(true)
                    WindowHandler.examwindow.focus()
                }

               

            }
            if (studentstatus.allowspellcheck && studentstatus.allowspellcheck !== "deactivate"){
                log.info("communicationhandler @ processUpdatedServerstatus: activating spellcheck for student")
                this.multicastClient.clientinfo.allowspellcheck = {...studentstatus.allowspellcheck}  // object with {spellchecklang, suggestions}  (flat copy)
            }
            if (studentstatus.allowspellcheck === "deactivate") {
                log.info("communicationhandler @ processUpdatedServerstatus: de-activating spellcheck for student")
                this.multicastClient.clientinfo.allowspellcheck = false
            }
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

        }

        // global status updates
        if (serverstatus.screenslocked && !this.multicastClient.clientinfo.screenlock) {  this.activateScreenlock() }
        else if (!serverstatus.screenslocked ) { this.killScreenlock() }

        if (serverstatus.screenshotocr) { this.multicastClient.clientinfo.screenshotocr = true  }
        else { this.multicastClient.clientinfo.screenshotocr = false   }

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
            console.error("communicationhandler @ killScreenlock: no functional screenlockwindow to handle")
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
        this.multicastClient.clientinfo.cmargin = serverstatus.cmargin  // this is used to configure margin settings for the editor
        this.multicastClient.clientinfo.linespacing = serverstatus.linespacing // we try to double linespacing on demand in pdf creation

        if (!WindowHandler.examwindow){  // why do we check? because exammode is left if the server connection gets lost but students could reconnect while the exam window is still open and we don't want to create a second one
            log.info("communicationhandler @ startExam: creating exam window")
            this.multicastClient.clientinfo.examtype = serverstatus.examtype
            WindowHandler.createExamWindow(serverstatus.examtype, this.multicastClient.clientinfo.token, serverstatus, primary);
        }
        else if (WindowHandler.examwindow){  //reconnect into active exam session with exam window already open
            console.error("communicationhandler @ startExam: found existing Examwindow..")
            try {  // switch existing window back to exam mode
                WindowHandler.examwindow.show() 
                if (!this.config.development) { 
                    WindowHandler.examwindow.setFullScreen(true)  //go fullscreen again
                    WindowHandler.examwindow.setAlwaysOnTop(true, "screen-saver", 1)  //make sure the window is 1 level above everything
                    enableRestrictions(WindowHandler.examwindow)
                    await this.sleep(2000) // wait an additional 2 sec for windows restrictions to kick in (they steal focus)
                    WindowHandler.addBlurListener();
                }   
            }
            catch (e) { //examwindow variable is still set but the window is not managable anymore (manually closed in dev mode?)
                console.error("communicationhandler @ startExam: no functional examwindow found.. resetting")
                
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
                if (fs.existsSync(this.config.workdirectory)){   // set by server.js (desktop path + examdir)
                    fs.rmSync(this.config.workdirectory, { recursive: true });
                    fs.mkdirSync(this.config.workdirectory);
                }
            } catch (error) { log.error("communicationhandler @ endExam: ",error); }
        }
        WindowHandler.removeBlurListener();
        disableRestrictions(WindowHandler.examwindow)

        if (WindowHandler.examwindow){ // in some edge cases in development this is set but still unusable - use try/catch
            
            try {  //send save trigger to exam window
                if (!serverstatus.delfolderonexit){
                    WindowHandler.examwindow.webContents.send('save', 'exitexam') //trigger, why
                    await this.sleep(3000)  // give students time to read whats happening (and the editor time to save the content)
                }
                WindowHandler.examwindow.close(); 
                WindowHandler.examwindow.destroy(); 
                WindowHandler.examwindow = null;
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
                console.error("communicationhandler @ endExam: no functional blockwindow to handle")
            } 
            WindowHandler.blockwindows = []
        }
        
        this.multicastClient.clientinfo.exammode = false
        this.multicastClient.clientinfo.focus = true
    }


    // this is manually  triggered if connection is lost during exam - we allow the student to get out of the kiosk mode but keep his work in the editor
    gracefullyEndExam(){
        if (WindowHandler.examwindow){ 
            this.multicastClient.clientinfo.exammode = false
            log.warn("communicationhandler @ gracefullyEndExam: Manually Unlocking Workstation")
            try {
                // remove listener
                WindowHandler.removeBlurListener();
                disableRestrictions(WindowHandler.examwindow)

                WindowHandler.examwindow.setKiosk(false)
                WindowHandler.examwindow.setAlwaysOnTop(false)
                WindowHandler.examwindow.alwaysOnTop = false
              
            } catch (e) { 
                WindowHandler.examwindow = null
                console.error("communicationhandler @ gracefullyEndExam: no functional examwindow to handle")
            }
          
            try {
                for (let blockwindow of WindowHandler.blockwindows){
                    blockwindow.close(); 
                    blockwindow.destroy(); 
                    blockwindow = null;
                }
            } catch (e) { 
                WindowHandler.blockwindows = []
                console.error("communicationhandler @ gracefullyEndExam: no functional blockwindow to handle")
            } 
            WindowHandler.blockwindows = []

            this.multicastClient.clientinfo.focus = true
            this.multicastClient.clientinfo.exammode = false
        }
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
                    extract(absoluteFilepath, { dir: this.config.workdirectory }) 
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


    resetConnection(){
        this.multicastClient.clientinfo.token = false
        this.multicastClient.clientinfo.ip = false
        this.multicastClient.clientinfo.serverip = false
        this.multicastClient.clientinfo.servername = false
        this.multicastClient.clientinfo.focus = true  // we are focused 
        //this.multicastClient.clientinfo.exammode = false   // do not set to false until exam window is manually closed
        this.multicastClient.clientinfo.timestamp = false
        //this.multicastClient.clientinfo.virtualized = false  // this check happens only at the application start.. do not reset once set
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
            await this.zipDirectory(this.config.workdirectory, zipfilepath)
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
        .then(data => { console.log(`communicationhandler @ sendExamToTeacher: teacher response: ${data.message}`); })
        .catch(error => {console.error(`communicationhandler @ sendExamToTeacher: ${error}`); });
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
 