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
import ip from 'ip'
import i18n from '../../renderer/src/locales/locales.js'
const {t} = i18n.global
import{ipcMain, clipboard} from 'electron'
import defaultGateway from'default-gateway';
import os from 'os'
import log from 'electron-log/main';


//import Nodehun from 'nodehun'   
const NodehunModule = await import('./native-loader.cjs');  // npm rebuild nodehun --update-binary  on mac after build to run in dev mode
const { default: Nodehun } = NodehunModule;  // Access the default export

import {disableRestrictions} from './platformrestrictions.js';
import mammoth from 'mammoth';



  ////////////////////////////////
 // IPC handling (Backend) START
////////////////////////////////

class IpcHandler {
    constructor () {
        this.multicastClient = null
        this.config = null
        this.WindowHandler = null
    }
    init (mc, config, wh, ch) {
        this.multicastClient = mc
        this.config = config
        this.WindowHandler = wh  
        this.CommunicationHandler = ch
        


        /**
         *  Start LOCAL Lockdown
         */

        ipcMain.on('locallockdown', (event, args) => {
            log.info("ipchandler @ locallockdown: locking down client without teacher connection")
            
            let serverstatus = {
                exammode: true,
                examtype: args.exammode,
                delfolderonexit: false,
                spellcheck: true,
                spellchecklang: 'de',
                suggestions: false,
                moodleTestType: '',
                moodleDomain: '',
                cmargin: { side: 'right', size: 3 },
                screenshotinterval: 0,
                msOfficeFile: false,
                screenslocked: false,
                pin: '0000',
                linespacing: '2',
                unlockonexit: false,
                fontfamily: 'sans-serif',
                moodleTestId: '',
                languagetool: true,
                password: args.password,
                audioRepeat: 4
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
        ipcMain.handle('focuslost', (event) => { 
            let answer = false 
            if (this.config.development || !this.multicastClient.exammode) { 
                answer = { sender: "client", focus: true}
                
            }
            else if (this.WindowHandler.screenlockwindows.length > 0) { 
                answer = { sender: "client", focus: true }
                
            }
            else if (this.WindowHandler.focusTargetAllowed){ 
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
        ipcMain.on('checkhostip', (event) => { 
            let address = false
            try { address = this.multicastClient.client.address() }
            catch (e) { log.error("ipcHandler @ checkhostip: multicastclient not running") }
            if (address) { event.returnValue = this.config.hostip }


            try { //bind to the correct interface
                const {gateway, interface: iface} =  defaultGateway.v4.sync()
                this.config.hostip = ip.address(iface)    // this returns the ip of the interface that has a default gateway..  should work in MOST cases.  probably provide "ip-options" in UI ?
                this.config.gateway = true
            }
            catch (e) {
                this.config.hostip = false
                this.config.gateway = false
            }

            if (!this.config.hostip) {
                try {this.config.hostip = ip.address() }  //this delivers an ip even if gateway is not set
                catch (e) {
                    log.error("ipcHandler @ checkhostip: Unable to determine ip address")
                    this.config.hostip = false
                    this.config.gateway = false
                }
            }

            // check if multicast client is running - otherwise start it
            if (this.config.hostip == "127.0.0.1") { this.config.hostip = false }
            if (this.config.hostip && !address ) { this.multicastClient.init(this.config.gateway) }
            event.returnValue = this.config.hostip 
        })





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
                log.info(`ipchandler: storeHTML: creating manual backup as ${htmlfilename}`)
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
         * Stores the ExamWindow content as PDF
         */ 
        ipcMain.on('printpdf', (event, args) => { 
            if (this.WindowHandler.examwindow){
                var options = {
                    margins: {top:0.5, right:0, bottom:0.5, left:0 },
                    pageSize: 'A4',
                    printBackground: false,
                    printSelectionOnly: false,
                    landscape: args.landscape,
                    displayHeaderFooter:true,
                    footerTemplate: "<div style='height:12px; font-size:10px; text-align: right; width:100%; margin-right: 20px;'><span class=pageNumber></span>|<span class=totalPages></span></div>",
                    headerTemplate: `<div style='display: inline-block; height:12px; font-size:10px; text-align: right; width:100%; margin-right: 20px;margin-left: 20px;'><span style="float:left;">${args.servername}</span><span style="float:left;">&nbsp;|&nbsp; </span><span class=date style="float:left;"></span><span style="float:right;">${args.clientname}</span></div>`,
                    preferCSSPageSize: false
                }

                let pdffilename = `${this.multicastClient.clientinfo.name}.pdf`
                if (args.filename){
                    pdffilename = `${args.filename}.pdf`
                    log.info(`ipchandler @ printpdf: creating manual backup as ${pdffilename}`)
                }
                const pdffilepath = path.join(this.config.examdirectory, pdffilename);  //the original file "thomas.pdf"
                const alternatefilename = `${pdffilename}-aux.pdf`    //thomas.pdf-aux.pdf 
                const alternatebackupfilename = `${pdffilename}-old.pdf`;   //thomas.pdf-old.pdf

                const alternatepath = path.join(this.config.examdirectory, alternatefilename);

                // aux files are files created if the main pdffilepath is not writeable (opened on windows) and preferred by printrequest and when combining all pdfs. 
                fs.readdir(this.config.examdirectory, (err, files) => { // rename it if it exists - we don't want old backupfiles to mess up printrequest and combine (if everything is ok and the mainfile is writeable)
                    if (err) {  return; }
                    files.forEach(file => {
                        if (file === alternatefilename) {
                            const newPath = path.join(this.config.examdirectory, alternatebackupfilename);
                            fs.rename(alternatepath, newPath, err => {
                                if (err) { 
                                    log.error('ipchandler @ printpdf: Error renaming file:', err);
                                    event.reply("fileerror", { sender: "client", message:err , status:"error" } )
                                 }
    
                            });
                        }
                    });
                });

                this.WindowHandler.examwindow.webContents.printToPDF(options).then(data => {
                    if (fs.existsSync(pdffilepath)) { fs.unlinkSync(pdffilepath); }


                    fs.writeFile(pdffilepath, data, (err) => { 
                        if (err) {
                            log.error(`ipchandler @ printpdf: ${err.message} - writing file as: ${alternatepath} `); 
               
                            if (fs.existsSync(alternatepath)) { fs.unlinkSync(alternatepath); }
                            fs.writeFile(alternatepath, data, (err) => { 
                                if (err) {
                                    log.error(err.message);
                                    log.error("ipchandler @ printpdf: giving up"); 
                                    event.reply("fileerror", { sender: "client", message:err , status:"error" } )
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
                    log.error(`ipchandler @ printpdf: ${error}`)
                    event.reply("fileerror", { sender: "client", message:error , status:"error" } )
                });
            }
        })


        /**
         * activate spellcheck on demand for specific student
         */ 
        ipcMain.on('activatespellcheck', (event, spellchecklang) => {  
            const dictionaryPath = path.join( __dirname,'../../public/dictionaries');
            let language = "de-DE"
            if (spellchecklang){ language = spellchecklang }
            if (spellchecklang == "none"){return}  // "other" language selected 
            
            let affix = null;
            let dictionary = null;

            log.info(`ipchandler @ activatespellcheck: activating Hunspell Fallback Backend for lang: ${language}`)

            try {
                if (language === "en" || language === "en-GB") {
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'en_US.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'en_US.dic'))
                }
                else if (language === "de" || language === "de-DE"){
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'de_DE_frami.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'de_DE_frami.dic'))
                }
                else if (language === "it" || language === "it-IT"){
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'it_IT.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'it_IT.dic'))
                }
                else if (language === "fr" || language === "fr-FR"){
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'fr.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'fr.dic'))
                }
                else if (language === "es" || language === "es-ES"){
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'es_ES.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'es_ES.dic'))
                }
                this.WindowHandler.nodehun  = new Nodehun(affix, dictionary)
                
                //this.multicastClient.clientinfo.privateSpellcheck.activated = true // this is set because communication handler needs to know if this already happened
                
                return true
            }
            catch (e) { log.error(e); return false}
            
        })
    

        /**
         * Returns all found Servers and the information about this client
         */ 
        ipcMain.handle('getinfoasync', (event) => {   
            let serverstatus = false   
            // serverstatus objekt wird nur bei beginn des exams an das exam window durchgereicht für basis einstellungen
            // alle weiteren updates über das serverstatus object werden im communication handler gelesen und ggf. auf das clientinfo object gelegt
            // dieser kommunikationsfluss muss in 2.0 gestreamlined werden #FIXME
            
            if (this.WindowHandler.examwindow) { serverstatus = this.WindowHandler.examwindow.serverstatus }

            //count number of files in exam directory
            if (!this.multicastClient.clientinfo.exammode){
                const workdir = path.join(config.examdirectory,"/")
                if (!fs.existsSync(workdir)){ fs.mkdirSync(workdir, { recursive: true });  } //do not crash if the directory is deleted after the app is started ^^
                let filelist =  fs.readdirSync(workdir, { withFileTypes: true })
                    .filter(dirent => dirent.isFile())
                    .map(dirent => dirent.name)
                this.multicastClient.clientinfo.numberOfFiles = filelist.length
                //console.log(filelist)
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
            const contentView = mainWindow.getBrowserView(0); // assuming it's the 1st added view
            contentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        });
        ipcMain.on('restore-browserview', (event) => {
            const mainWindow = this.WindowHandler.examwindow
            const menuHeight = this.WindowHandler.examwindow.menuHeight;
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
            .catch(error => {
                // Fehlerbehandlung
                let errorMessage = error.message;
                if (error.name === 'AbortError') { errorMessage = "The request timed out";   } // Timeout-Nachricht anpassen 
                log.error(`ipchandler @ register: ${errorMessage}`);
                event.returnValue = { sender: "client", message: errorMessage, status: "error" };
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
                let filepath = path.join(workdir,filename)
                //log.info(filepath)
                if (audio){ // audio file
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
         * Append PrintRequest to clientinfo  
         */ 
        ipcMain.on('sendPrintRequest', (event) => {   
            this.multicastClient.clientinfo.printrequest = true  //set this to false after the request left the client to prevent double triggering
            event.returnValue = true
        })


        /**
         * this is our manually implemented Hunspell spellchecker for the editor (fallback for languagetool)
         */
        ipcMain.on('checktext', async (event, selectedText) => {
            const words = selectedText.split(/[^a-zA-ZäöüÄÖÜßéèêëôûüÔÛÜáíóúñÁÍÓÚÑàèéìòùÀÈÉÌÒÙçÇ]+/);
            const misspelledWords = [];
            for (const word of words) {
                if (this.WindowHandler.nodehun){
                    const correct = await this.WindowHandler.nodehun.spell(word);

                    if (!correct) {
                        const suggestions = await this.WindowHandler.nodehun.suggest(word)
                        misspelledWords.push( { wrongWord: word, suggestions: suggestions });
                    }
                }
                else {
                    event.returnValue = {error: "error"};
                }
            }
            event.returnValue = { misspelledWords };
        });


        
     
        ipcMain.on('get-cpu-info', (event) => {
            const cpus = os.cpus().map(cpu => cpu.model.toLowerCase());
            const vmCpuKeywords = ['qemu', 'virtual', 'vmware', 'kvm', 'xen', 'hyper-v'];
    

            let virtualCpu = false;
            cpus.forEach(cpu => {
                vmCpuKeywords.forEach(keyword => {
                    if (cpu.includes(keyword)) {
                        virtualCpu = true;
                    }
                });
            });
    
            event.returnValue = virtualCpu;
        });




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
