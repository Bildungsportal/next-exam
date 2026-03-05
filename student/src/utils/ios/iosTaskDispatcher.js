/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 *
 * This program is free software: you can redistribute it and modify it
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


/**
 * IosTaskDispatcher is a class that dispatches tasks to the ios capacitor plugin
 */

import {Device} from '@capacitor/device';
import i18n from "../../locales/locales.js";
import {Directory, Encoding, Filesystem as fs} from "@capacitor/filesystem";
import {Clipboard} from "@capacitor/clipboard";
import path from "path";
import mammoth from "mammoth";
//import log from "electron-log";
import {config} from "dotenv";

//import { MyCustomNativePlugin } from './plugins/MyCustomNativePlugin';

export class IosTaskDispatcher {

    constructor() {
        this.multicastClient = null;
        this.config = null;
        this.communicationHandler = null;
        this.isPrintingPdf = false;
    }

    init(mc, config, ch) {
        this.multicastClient = mc;
        this.config = config;
        this.communicationHandler = ch;
    }

    async dispatch(signal, payload) {
        switch (signal) {

            case 'getinfoasync':
                return this.getinfoasync(payload);
            /**
             * fetches exam materials from the teacher and returns them as an object
             * @returns {Object} {exammaterials: Object}
             */
            case 'getmaterials':
                return
            /**
             * submits the exam to the teacher and returns a boolean
             * @returns {Boolean} true if the exam was submitted successfully, false otherwise
             */
            case 'finalsubmit':
                return
            case 'get-wlan-info':
                return this.getwlaninfo()
            case 'set-new-locale':
                return this.setnewlocale(payload);
            case 'checkhostip':
                return this.checkhostip(payload);
            case 'loginBiP':
                return this.loginbip(payload);
            case 'reload-url':
                return this.reloadurl();
            case 'locallockdown':
                return this.locallockdown(payload);
            case 'register':
                return this.register(payload);
            case 'gracefullyexit':
                return this.gracefullyexit();
            case 'restrictions':
                return disableIOSRestrictions();
            case 'clipboard':
                return this.clipboard(payload);
            case 'storeHTML':
                return this.storehtml(payload);
            case 'printpdf':
                return this.printpdf(payload);
            case 'getfileasync':
                return this.getfileasync(payload);
            case 'getPDFbase64':
                return this.getpdfbase64();
            case 'focuslost':
                return this.focuslost(payload);
            case 'startLanguageTool':
                return this.startlanguagetool();
            case 'getbackupfile':
                return this.getbackupfile(payload);
            case 'saveGGB':
                return this.saveggb(payload);
            case 'virtualized':
                return this.virtualized();
            case 'collapse-browserview':
            case 'restore-browserview':
                return; // Ignore since no BrowserViews in Capacitor
            default:
                throw new Error(`Signal ${signal} nicht für iOS implementiert.`);
        }
    }

    /**
     * fetches clientinfo and serverstatus from the multicastclient and returns them as an object
     * @returns {Object} {clientinfo: Object, serverstatus: Object}
     */
    async getinfoasync(payload) {
        let serverstatus = false
        // serverstatus objekt wird nur bei beginn des exams an das exam window durchgereicht für basis einstellungen
        // alle weiteren updates über das serverstatus object werden im communication handler gelesen und ggf. auf das clientinfo object gelegt
        // dieser kommunikationsfluss muss in 2.0 gestreamlined werden #FIXME

        serverstatus = this.multicastClient.serverstatus

        //count number of files in exam directory
        if (!this.multicastClient.clientinfo.exammode) {
            const workdir = path.join(this.config.examdirectory, "/")
            try {
                await fs.promises.mkdir(workdir, {recursive: true})  // erstellt falls nötig
                const filelist = (await fs.promises.readdir(workdir, {withFileTypes: true}))
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
    }

    async checkhostip(payload) {
        let address = false;
        try {
            address = this.multicastClient.client.address();
        } catch (e) {
            loggingBridge.error("IosTaskDispatcher @ checkhostip: multicastclient not running");
        }

        // Falls bereits eine Adresse vorhanden ist, liefern wir sie zurück.
        if (address) {
            return this.config.hostip;
        }

        // Versuche, an die korrekte Schnittstelle zu binden
        try {
            // Falls gateway4sync() blockierend ist, kannst du diesen Aufruf in ein Promise packen:
            const {gateway, interface: iface} = await new Promise((resolve, reject) => {
                try {
                    //const res = gateway4sync();
                    //resolve(res);
                } catch (err) {
                    reject(err);
                }
            });
            this.config.hostip = ip.address(iface); // Liefert die IP der Schnittstelle, welche das Default Gateway hat
            this.config.gateway = true;
        } catch (e) {
            this.config.hostip = false;
            this.config.gateway = false;
        }

        // Falls keine IP (mit Gateway) verfügbar ist, hole eine alternative Adresse
        if (!this.config.hostip) {
            try {
                this.config.hostip = ip.address(); // Liefert auch eine IP, wenn kein Gateway verfügbar ist
            } catch (e) {
                loggingBridge.error("IosTaskDispatcher @ checkhostip: Unable to determine ip address", e);
                this.config.hostip = false;
                this.config.gateway = false;
            }
        }

        // Verfälschte Adressen (z. B. localhost) ignorieren
        if (this.config.hostip === "127.0.0.1") {
            this.config.hostip = false;
        }

        // Wenn die Multicast-Client nicht läuft, initialisieren
        if (this.config.hostip && !address) {
            try {
                // Falls init() asynchron umgesetzt werden kann, warten wir hier darauf.
                await this.multicastClient.init(this.config.gateway);
            } catch (err) {
                loggingBridge.error("IosTaskDispatcher @ checkhostip: Error initializing multicast client", err);
            }
        }

        return this.config.hostip;
    }

    /**
     * updates the language of the application
     */
    setnewlocale(payload) {
        loggingBridge.info(`IosTaskDispatcher @ set-new-locale: setting new locale to ${payload}`)
        i18n.locale = payload
    }

    /**
     * fetches the wlan info and returns it as an object
     * @returns {Object} {wlanInfo: Object}
     */
    async getwlaninfo() {
        return await Device.getInfo();
    }

    loginbip(biptest) {
        loggingBridge.info("IosTaskDispatcher @ loginBiP: opening bip window. testenvironment:", biptest)
        this.WindowHandler.createBiPLoginWin(biptest) //Todo replace with navigate see #386
    }

    reloadurl() {
        this.WindowHandler.createEasterWin() //Todo replace with navigate see #386
    }

    locallockdown(args) {
        loggingBridge.info("IosTaskDispatcher @ locallockdown: locking down client without teacher connection")

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
                    cmargin: {side: 'right', size: 3},
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

        this.communicationHandler.startExam(serverstatus)
    }

    register(args) {
        const clientname = args.clientname
        const pin = args.pin
        const serverip = args.serverip
        const servername = args.servername
        const clientip = ip.address()
        const hostname = os.hostname()
        const version = this.config.version
        const bipuserID = args.bipuserID

        if (this.multicastClient.clientinfo.token) { //#FIXME das sollte eigentlich vom server kommen
            event.returnValue = {sender: "client", message: t("control.alreadyregistered"), status: "error"}
        }


        const url = `https://${serverip}:${this.config.serverApiPort}/server/control/registerclient/${servername}/${pin}/${clientname}/${clientip}/${hostname}/${version}/${bipuserID}`;
        const signal = AbortSignal.timeout(8000); // 8000 Millisekunden = 8 Sekunden AbortSignal mit einem Timeout


        fetch(url, {method: 'GET', signal})
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

                    loggingBridge.info(`IosTaskDispatcher @ register: successfully registered at ${servername} @ ${serverip} as ${clientname}`);
                    event.returnValue = data;

                    //create exam folder in workfolder
                    let uniqueexamName = `${servername}-${pin}`
                    config.examdirectory = path.join(config.workdirectory, uniqueexamName)

                    if (!this.fileExists(config.examdirectory)) {
                        fs.mkdir(config.examdirectory, {recursive: true});
                    }
                } else {
                    if (data.version) {
                        // compare versions and display message (teacher needs upgrade.. client needs upgrade)
                        const comparisonResult = this.compareSoftware(config.version, config.info, data.version, data.versioninfo) //serverVersion, serverStatus, localVersion, localStatus
                        if (comparisonResult > 0) {
                            event.returnValue = {
                                status: "error",
                                message: "Ihre Version von Next-Exam ist neuer als die der Lehrperson!"
                            };
                        } else if (comparisonResult < 0) {
                            event.returnValue = {
                                status: "error",
                                message: "Ihre Version von Next-Exam ist zu alt. Laden sie sich eine aktuelle Version herunter!"
                            };
                        } else {
                            event.returnValue = {
                                status: "error",
                                message: "Unbekannter Fehler beim Verbindungsaufbau."
                            };
                        }
                    }
                    event.returnValue = {status: "error", message: data.message};
                }
            })
            .catch(async error => {
                // Fehlerbehandlung
                let errorMessage = error.message;
                if (error.name === 'AbortError') {
                    errorMessage = "The request timed out";
                } // Timeout-Nachricht anpassen
                loggingBridge.error(`IosTaskDispatcher @ register: ${errorMessage}`);

                // show warning message if the user does not want to reset the permissions
                event.returnValue = {
                    sender: "client",
                    message: "Es gibt ein Problem mit dem Netzwerk, den Firewallregeln oder den Netzwerkberechtigungen! Bitte beheben sie dieses Problem und starten Sie Next-Exam neu!",
                    status: "error"
                };
            });
    }

    gracefullyexit() {
        //loggingBridge.info(`IosTaskDispatcher @ gracefullyexit: gracefully leaving locked exam mode`)

        this.communicationHandler.gracefullyEndExam()
        this.communicationHandler.resetConnection()
    }

    async clipboard(text) {
        await Clipboard.write(text);
    }

    storehtml(args) {
        const htmlContent = args.editorcontent
        const filename = args.filename
        let htmlfilename = `${this.multicastClient.clientinfo.name}.bak`

        if (filename) {
            htmlfilename = `${filename}.bak`
        }

        const htmlfile = path.join(this.config.examdirectory, htmlfilename);

        if (htmlContent) {
            //loggingBridge.info("IosTaskDispatcher: storeHTML: saving students work to disk...")
            try {
                fs.writeFile({
                    path: htmlfile,
                    data: htmlContent,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });
            } catch (err) {
                //loggingBridge.error(`IosTaskDispatcher @ storeHTML: ${err.message}`);
                let alternatepath = `${htmlfile}-${this.multicastClient.clientinfo.token}.bak`
                //loggingBridge.warn("IosTaskDispatcher @ storeHTML: trying to write file as:", alternatepath)
                try {
                    fs.writeFile({
                        path: alternatepath,
                        data: htmlContent,
                        directory: Directory.Documents,
                        encoding: Encoding.UTF8
                    })
                    //loggingBridge.info("IosTaskDispatcher @ storeHTML: success!");
                    event.reply("loadfilelist")
                } catch (err) {
                    //loggingBridge.error(err.message);
                    //loggingBridge.error("IosTaskDispatcher @ storeHTML: giving up");
                    event.reply("fileerror", {sender: "client", message: err, status: "error"})
                }
                event.reply("loadfilelist")
            }
        }
    }

    printpdf(args) {
        // do not print if exam mode is not active anymore
        if (!this.multicastClient?.clientinfo?.exammode) {
            //loggingBridge.warn("IosTaskDispatcher @ printpdf: exammode is false - skipping print")
            return
        }

        if (this.isPrintingPdf) {
            //loggingBridge.warn("IosTaskDispatcher @ printpdf: print already in progress - skipping new request")
            return
        }

        if (this.WindowHandler.examwindow) {
            const options = { // define print options
                margins: {top: 0.5, right: 0, bottom: 0.5, left: 0},
                pageSize: 'A4',
                printBackground: false,
                printSelectionOnly: false,
                landscape: args.landscape,
                displayHeaderFooter: true,
                footerTemplate: "<div style='height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-bottom:10px;'><span class=pageNumber></span>|<span class=totalPages></span></div>",
                headerTemplate: `<div style='display: inline-block; height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-left: 30px; margin-top:10px;'><span style="float:left;">${args.servername}</span><span style="float:left;">&nbsp;|&nbsp; </span><span class=date style="float:left;"></span><span style="float:right;">${args.clientname}</span></div>`,
                preferCSSPageSize: false
            }

            let pdffilename = `${this.multicastClient.clientinfo.name}.pdf`  // default filename = clientname.pdf
            if (args.filename) {  // in case of manual backup the user can set a custom filename
                pdffilename = `${args.filename}.pdf`

            }
            const pdffilepath = path.join(this.config.examdirectory, pdffilename);  // path points to the current exam directory
            const alternatefilename = `${pdffilename}-aux.pdf`    //thomas.pdf-aux.pdf
            const alternatebackupfilename = `${pdffilename}-old.pdf`;   //thomas.pdf-old.pdf
            const alternatepath = path.join(this.config.examdirectory, alternatefilename);  // if something goes wrong we try to write a different file


            // aux files are files created if the main pdffilepath is not writeable (opened on windows)
            try {  // always check for old aux files and rename them
                const files = fs.readdir(this.config.examdirectory);
                files.forEach(file => {
                    if (file === alternatefilename) {
                        const newPath = path.join(this.config.examdirectory, alternatebackupfilename);
                        fs.rename({from: alternatepath, to: newPath});
                    }
                });
            } catch (err) {
                //loggingBridge.error(`IosTaskDispatcher @ printpdf: ${err.message}`);
            }

            const examWindow = this.WindowHandler.examwindow
            const webContents = examWindow?.webContents

            if (!webContents) {
                //loggingBridge.error("IosTaskDispatcher @ printpdf: no webContents found for examwindow")
                event.reply("fileerror", {
                    sender: "client",
                    message: "no webContents found for examwindow",
                    status: "error"
                })
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
                try {
                    if (fs.existsSync(pdffilepath)) {
                        fs.unlinkSync(pdffilepath);
                    }
                } catch (err) {
                    loggingBridge.error(`IosTaskDispatcher @ printpdf: ${err.message}`);
                }
                // write the pdf to the exam directory
                try {
                    fs.writeFile({
                        path: pdffilepath,
                        data: data,
                        directory: Directory.Documents,
                        encoding: Encoding.UTF8
                    })
                    if (args.reason === "teacherrequest") {
                        this.CommunicationHandler.sendToTeacher()
                    }
                    event.reply("loadfilelist")   //make sure students see the new file immediately
                } catch (err) {
                    //loggingBridge.warn(`IosTaskDispatcher @ printpdf: ${err.message} - writing file as: ${alternatepath} `);
                    // delete the old aux file if it exists
                    try {
                        if (fs.existsSync(alternatepath)) {
                            fs.unlinkSync(alternatepath);
                        }
                    } catch (err) {
                        //loggingBridge.error(`IosTaskDispatcher @ printpdf (alternativer Pfad): ${err.message}`);
                    }
                    // write the pdf to the alternate path
                    try {
                        fs.writeFile({
                            path: alternatepath,
                            data: data,
                            directory: Directory.Documents,
                            encoding: Encoding.UTF8
                        })
                        if (args.reason === "teacherrequest") {
                            this.CommunicationHandler.sendToTeacher()
                        }
                        event.reply("loadfilelist")   //make sure students see the new file immediately
                    } catch (err) {
                            //loggingBridge.error(err.message);
                            //loggingBridge.error("IosTaskDispatcher @ printpdf: giving up");
                            event.reply("fileerror", {sender: "client", message: err.message, status: "error"})
                    }
                }
            }).catch(error => {
                //loggingBridge.error(`IosTaskDispatcher @ printpdf: ${error.message}`)
                event.reply("fileerror", {sender: "client", message: error.message, status: "error"})
            }).finally(() => {
                this.isPrintingPdf = false
            });
        }
    }

    async getfileasync(args) {
        const workdir = path.join(config.examdirectory, "/")

        if (args.filename) { //return content of specific file as string (html) to replace in editor)
            // console.log("Received arguments:", filename, audio, docx);

            let filepath = path.join(workdir, args.filename)

            if (args.audio == true) { // audio file
                const audioData = fs.readFile({
                    path: filepath,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                    }).then((audioData) => audioData);
                return audioData.toString('base64');
            } else if (args.docx) {  //office open xml file
                let result = await mammoth.convertToHtml({path: filepath})
                    .then((data) => {
                        return data
                    })
                    .catch(function (error) {
                        console.error(error);
                    });
                return result
            } else {   //bak file
                try {
                    let data = fs.readFile({
                        path: filepath,
                        directory: Directory.Documents,
                        encoding: Encoding.UTF8
                    }).then(data => data);
                    return data
                } catch (err) {
                    //loggingBridge.error(`IosTaskDispatcher @ getfilesasync: ${err}`);
                    return false
                }
            }
        } else {  // return file list of exam directory
            try {
                if (!this.fileExists(workdir)) {
                    fs.mkdir(workdir, {recursive: true});
                } //do not crash if the directory is deleted after the app is started ^^
                let filelist = fs.readdir(workdir, {withFileTypes: true})
                    .filter(dirent => dirent.isFile())
                    .map(dirent => dirent.name)


                let files = []
                filelist.forEach(file => {
                    let mod = fs.stat(path.join(workdir, file)).mtime
                    if (path.extname(file).toLowerCase() === ".pdf") {
                        files.push({name: file, type: "pdf", mod: mod})
                    }         //pdf
                    else if (path.extname(file).toLowerCase() === ".bak") {
                        files.push({name: file, type: "bak", mod: mod})
                    }   // editor| backup file to replace editor content
                    else if (path.extname(file).toLowerCase() === ".docx") {
                        files.push({name: file, type: "docx", mod: mod})
                    }   // editor| content file (from teacher) to replace content and continue writing
                    else if (path.extname(file).toLowerCase() === ".ggb") {
                        files.push({name: file, type: "ggb", mod: mod})
                    }  // geogebra
                    else if (path.extname(file).toLowerCase() === ".mp3" || path.extname(file).toLowerCase() === ".ogg" || path.extname(file).toLowerCase() === ".wav") {
                        files.push({name: file, type: "audio", mod: mod})
                    }  // audio
                    else if (path.extname(file).toLowerCase() === ".jpg" || path.extname(file).toLowerCase() === ".png" || path.extname(file).toLowerCase() === ".gif") {
                        files.push({name: file, type: "image", mod: mod})
                    }  // images
                })
                this.multicastClient.clientinfo.numberOfFiles = filelist.length
                return files
            } catch (err) {
                //loggingBridge.error(`IosTaskDispatcher @ getfilesasync: ${err}`);
                return false;
            }
        }
    }

    async fileExists(path) {
        try {
            await fs.stat({
                path,
                directory: Directory.Documents
            });
            return true
        } catch (err) {
            return false;
        }
    }

    async getpdfbase64() {
        //loggingBridge.info("IosTaskDispatcher @ getPDFbase64: getting base64 encoded pdf")
        this.multicastClient.clientinfo.submissionnumber = args.submissionnumber + 1 // clientinfo keeps track of submissions for automated submissionnumbers at section change - but this obviously happens after manual submit
        let result = await this.CommunicationHandler.getBase64PDF(args.submissionnumber, args.sectionname, args.printBackground)   // why the hell is this function located in communicationhandler.js and not in ipchandler.js ? FIXME !
        return result
    }

    focuslost(ctrlalt) {
        //Todo Window Handler should be removed
        let answer = false
        if (this.config.development || !this.multicastClient.exammode) {
            answer = {sender: "client", focus: true}

        } else if (this.WindowHandler.screenlockwindows.length > 0) {
            answer = {sender: "client", focus: true}

        } else if (this.WindowHandler.focusTargetAllowed && ctrlalt == false) {
            //loggingBridge.warn(`IosTaskDispatcher @ focuslost: mouseleave event was triggered but target is allowed`)
            answer = {sender: "client", focus: true}

        } else {
            this.WindowHandler.examwindow.moveTop();
            this.WindowHandler.examwindow.setKiosk(true);
            this.WindowHandler.examwindow.show();
            this.WindowHandler.examwindow.focus();    // we keep focus on the window.. no matter what

            this.multicastClient.clientinfo.focus = false; // block everything and inform teacher  (probably an overkill on mouseleave - needs testing)
            answer = {sender: "client", focus: false}
        }

        return answer
    }

    startlanguagetool() {
        try {
            //TODO fix languagetool server
            //languageToolServer.startServer();
        } catch (err) {
            return false
        }
        return true
    }

    getbackupfile(filename) {
        //loggingBridge.info(`IosTaskDispatcher @ getbackupfile: Request received for filename: ${filename}`)
        const workdir = path.join(config.examdirectory, "/")
        if (filename) { //return content of specific file as string (html) to replace in editor)
            let filepath = path.join(workdir, filename)
            //loggingBridge.info(`IosTaskDispatcher @ getbackupfile: Full file path: ${filepath}`)
            try {
                if (!this.fileExists(filepath)) {
                    //loggingBridge.warn(`IosTaskDispatcher @ getbackupfile: backup file not found: ${filepath}`);
                    return false;
                }
                //loggingBridge.info(`IosTaskDispatcher @ getbackupfile: backup file exists, reading content`)
                let data = fs.readFile({
                    path: filepath,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                }).then(data => data);
                //loggingBridge.info(`IosTaskDispatcher @ getbackupfile: Successfully read backup file, content length: ${data.length}`)
                return data
            } catch (err) {
                //loggingBridge.error(`IosTaskDispatcher @ getbackupfile: Error reading backup file: ${err}`);
                //loggingBridge.error(`IosTaskDispatcher @ getbackupfile: Error stack: ${err.stack}`)
                return false
            }
        } else {
            //loggingBridge.warn(`IosTaskDispatcher @ getbackupfile: no filename provided`);
            return false;
        }
    }

    saveggb(args) {
        const content = args.content
        const filename = args.filename
        const reason = args.reason
        const ggbFilePath = path.join(this.config.examdirectory, filename);
        if (content) {
            //loggingBridge.info("ipchandler @ saveGGB: saving students work to disk...")
            const fileData = Buffer.from(content, 'base64');

            try {
                fs.writeFile(ggbFilePath, fileData);
                if (reason === "teacherrequest") {
                    this.CommunicationHandler.sendToTeacher()
                }
                return {sender: "client", message: t("data.filestored"), status: "success"}
            } catch (err) { //Todo Window Handling
                this.WindowHandler.examwindow.webContents.send('fileerror', err)

                //loggingBridge.error(`IosTaskDispatcher @ saveGGB: ${err}`)
                return {sender: "client", message: err, status: "error"}
            }
    }
}

    virtualized() {
        this.multicastClient.clientinfo.virtualized = true;
    }
}