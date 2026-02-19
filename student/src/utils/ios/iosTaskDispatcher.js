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
import log from "electron-log";
import i18n from "../../locales/locales.js";
import path from "path";
import fs from "fs";
import {gateway4sync} from "default-gateway";
import ip from "ip";
import os from "os";
import {ensureNetworkOrReset} from "../../../src-electron/main/scripts/testpermissionsMac.js";
import {app} from "electron";

//import { MyCustomNativePlugin } from './plugins/MyCustomNativePlugin';

class IosTaskDispatcher {

    constructor() {
        this.multicastClient = null;
        this.config = null;
        this.communicationHandler = null;
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
                this.setnewlocale(payload);
                break;
            case 'submitexam':
                return
            case 'getPDFbase64':
                return
            case 'getbackupfile':
                return
            case 'getfilesasync':
                return
            case 'storeHTML':
                return
            case 'printpdf':
                return
            case 'checkhostip':
                return this.checkhostip(payload);
            case 'loginBiP':
                this.loginbip(payload);
                break;
            case 'reload-url':
                this.reloadurl()
                break;
            case 'locallockdown':
                this.locallockdown(payload);
                break;
            case 'register':
                this.register(payload);
                break;
            case 'collapse-browserview':
                this.collapsebrowserview();
                break;
            case 'gracefullyexit':
                this.gracefullyexit();
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
            log.error("IosTaskDispatcher @ checkhostip: multicastclient not running");
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
                    const res = gateway4sync();
                    resolve(res);
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
                log.error("IosTaskDispatcher @ checkhostip: Unable to determine ip address", e);
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
                log.error("IosTaskDispatcher @ checkhostip: Error initializing multicast client", err);
            }
        }

        return this.config.hostip;
    }

    /**
     * updates the language of the application
     */
    setnewlocale(payload) {
        log.info(`IosTaskDispatcher @ set-new-locale: setting new locale to ${payload}`)
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
        log.info("IosTaskDispatcher @ loginBiP: opening bip window. testenvironment:", biptest)
        this.WindowHandler.createBiPLoginWin(biptest) //Todo replace with navigate see #386
    }

    reloadurl() {
        this.WindowHandler.createEasterWin() //Todo replace with navigate see #386
    }

    locallockdown(args) {
        log.info("IosTaskDispatcher @ locallockdown: locking down client without teacher connection")

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

                    log.info(`IosTaskDispatcher @ register: successfully registered at ${servername} @ ${serverip} as ${clientname}`);
                    event.returnValue = data;

                    //create exam folder in workfolder
                    let uniqueexamName = `${servername}-${pin}`
                    config.examdirectory = path.join(config.workdirectory, uniqueexamName)
                    if (!fs.existsSync(config.examdirectory)) {
                        fs.mkdirSync(config.examdirectory, {recursive: true});
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
                log.error(`IosTaskDispatcher @ register: ${errorMessage}`);

                // on macos the permission settings in rare cases mess up the ability to fetch the teacher api
                // check for network permissions on macOS and reset them if needed
                if (process.platform === "darwin") {
                    let response = await ensureNetworkOrReset(serverip, this.config.serverApiPort);
                    if (response && response === "reset") {   // quit the app if the user wants to reset the permissions
                        app.quit();
                        return
                    }
                }

                // show warning message if the user does not want to reset the permissions
                event.returnValue = {
                    sender: "client",
                    message: "Es gibt ein Problem mit dem Netzwerk, den Firewallregeln oder den Netzwerkberechtigungen! Bitte beheben sie dieses Problem und starten Sie Next-Exam neu!",
                    status: "error"
                };
            });
    }

    collapsebrowserview() {
        const mainWindow = this.WindowHandler.examwindow
        if (!mainWindow){ return }
        const contentView = mainWindow.getBrowserView(0); // assuming it's the 1st added view
        contentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }

    gracefullyexit() {
        log.info(`IosTaskDispatcher @ gracefullyexit: gracefully leaving locked exam mode`)

        this.communicationHandler.gracefullyEndExam()
        this.communicationHandler.resetConnection()
    }
}