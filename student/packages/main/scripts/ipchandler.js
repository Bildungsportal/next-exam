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
import Nodehun from 'nodehun'
import {disableRestrictions} from './platformrestrictions.js';

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
         *  Start BIP Login Sequence
         */

        ipcMain.on('loginBiP', (event) => {
            log.info("ipchandler @ loginBiP: opening bip window")
            this.WindowHandler.createBiPLoginWin()
            event.returnValue = "hello from bip logon"
        })



        /**
         * Registers virtualized status
         */ 
        ipcMain.on('virtualized', () => {  this.multicastClient.clientinfo.virtualized = true; } )


        /**
         * Set FOCUS state to false (mouse left exam window)
         */ 
        ipcMain.on('focuslost', (event) => {  
            if (this.config.development || !this.multicastClient.exammode) { 
                event.returnValue = { sender: "client", focus: true}
                return 
            }
            if (this.WindowHandler.screenlockwindows.length > 0) { return }// do nothing if screenlockwindow stole focus // do not trigger an infinite loop between exam window and screenlock window (stealing each others focus)
            
            this.WindowHandler.examwindow.moveTop();
            this.WindowHandler.examwindow.setKiosk(true);
            this.WindowHandler.examwindow.show();  
            this.WindowHandler.examwindow.focus();    // we keep focus on the window.. no matter what

            this.multicastClient.clientinfo.focus = false; // block everything and inform teacher  (probably an overkill on mouseleave - needs testing)
            event.returnValue = { sender: "client", focus: false }
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

            const htmlfile = path.join(this.config.workdirectory, htmlfilename);

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
                                }
                            }); 
                        }
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
                const pdffilepath = path.join(this.config.workdirectory, pdffilename);  //the original file "thomas.pdf"
                const alternatefilename = `${pdffilename}-aux.pdf`    //thomas.pdf-aux.pdf 
                const alternatebackupfilename = `${pdffilename}-old.pdf`;   //thomas.pdf-old.pdf

                const alternatepath = path.join(this.config.workdirectory, alternatefilename);

                // aux files are files created if the main pdffilepath is not writeable (opened on windows) and preferred by printrequest and when combining all pdfs. 
                fs.readdir(this.config.workdirectory, (err, files) => { // rename it if it exists - we don't want old backupfiles to mess up printrequest and combine (if everything is ok and the mainfile is writeable)
                    if (err) {  return; }
                    files.forEach(file => {
                        if (file === alternatefilename) {
                            const newPath = path.join(this.config.workdirectory, alternatebackupfilename);
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
        ipcMain.handle('activatespellcheck', (event, spellchecklang) => {  
            const dictionaryPath = path.join( __dirname,'../../public/dictionaries');
            let language = "de"
            if (spellchecklang){ language = spellchecklang }
            if (spellchecklang == "none"){return}  // "other" language selected 
            
            let affix = null;
            let dictionary = null;

            log.info(`ipchandler @ activatespellcheck: activating for lang: ${language}`)

            try {
                if (language === "en-GB") {
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'en_US.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'en_US.dic'))
                }
                else if (language === "de"){
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'de_DE_frami.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'de_DE_frami.dic'))
                }
                else if (language === "it"){
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'it_IT.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'it_IT.dic'))
                }
                else if (language === "fr"){
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'fr.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'fr.dic'))
                }
                else if (language === "es"){
                    affix       = fs.readFileSync(path.join(dictionaryPath, 'es_ES.aff'))
                    dictionary  = fs.readFileSync(path.join(dictionaryPath, 'es_ES.dic'))
                }
                this.WindowHandler.nodehun  = new Nodehun(affix, dictionary)
                return true
            }
            catch (e) { log.error(e); return false}
            
        })
    

        /**
         * Returns all found Servers and the information about this client
         */ 
        ipcMain.handle('getinfoasync', (event) => {   
            let serverstatus = false
            if (this.WindowHandler.examwindow) { serverstatus = this.WindowHandler.examwindow.serverstatus }

            if (!this.multicastClient.clientinfo.exammode){
                const workdir = path.join(config.workdirectory,"/")
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

            if (this.multicastClient.clientinfo.token){ //#FIXME das sollte eigentlich vom server kommen 
                event.returnValue = { sender: "client", message: t("control.alreadyregistered"), status:"error" }
            }


         
            const url = `https://${serverip}:${this.config.serverApiPort}/server/control/registerclient/${servername}/${pin}/${clientname}/${clientip}/${hostname}/${version}`;
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
                    log.info(`ipchandler @ register: successfully registered at ${serverip} as ${clientname}`);
                    event.returnValue = data;
                } 
                else {
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
            const ggbFilePath = path.join(this.config.workdirectory, filename);
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
            const ggbFilePath = path.join(this.config.workdirectory, filename);
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
         * GET PDF from EXAM directory
         * @param filename if set the content of the file is returned
         */ 
        ipcMain.on('getpdf', (event, filename) => {   
            const workdir = path.join(config.workdirectory,"/")
            if (filename) { //return content of specific file
                let filepath = path.join(workdir,filename)
                try {
                    let data = fs.readFileSync(filepath)
                    event.returnValue = data
                } 
                catch (error) {
                    event.returnValue = { sender: "client", content: false , status:"error" }
                }    
            }
        })

        ipcMain.handle('getpdfasync', (event, filename) => {   
            const workdir = path.join(config.workdirectory,"/")
            if (filename) { //return content of specific file
                let filepath = path.join(workdir,filename)
                try {
                    let data = fs.readFileSync(filepath)
                    return data
                } 
                catch (error) {
                    return { sender: "client", content: false , status:"error" }
                }    
            }
        })




 

        /**
         * ASYNC GET FILE-LIST from workdirectory
         * @param filename if set the content of the file is returned
         */ 
        ipcMain.handle('getfilesasync', (event, filename, audio=false) => {   
            const workdir = path.join(config.workdirectory,"/")

            if (filename) { //return content of specific file as string (html) to replace in editor)
                let filepath = path.join(workdir,filename)
                //log.info(filepath)
                if (audio){
                    const audioData = fs.readFileSync(filepath);
                    return audioData.toString('base64');
                }
                else {
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
                        else if  (path.extname(file).toLowerCase() === ".bak"){ files.push( {name: file, type: "bak", mod: mod})   }   // editor backup
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
         * this is our manually implemented spellchecker for the editor
         */
        ipcMain.on('checkword', async (event, selectedWord) => {
            log.info(`Received selected text: ${selectedWord}`);
            const suggestions = await this.WindowHandler.nodehun.suggest(selectedWord)
            //log.info(suggestions)
            event.returnValue = {  suggestions : suggestions }   
        });
        ipcMain.on('checktext', async (event, selectedText) => {
            const words = selectedText.split(/[^a-zA-ZäöüÄÖÜßéèêëôûüÔÛÜáíóúñÁÍÓÚÑàèéìòùÀÈÉÌÒÙçÇ]+/);
            const misspelledWords = [];
            for (const word of words) {
                const correct = await this.WindowHandler.nodehun.spell(word);
                if (!correct) {
                    misspelledWords.push(word);
                   // log.info(word)
                }
            }
            event.returnValue = { misspelledWords };
        });
        ipcMain.on('add-word-to-dictionary', (event, word) => {
            log.info("adding word to dictionary")
            this.WindowHandler.nodehun.add(word)
        });
    }
}
 
export default new IpcHandler()
