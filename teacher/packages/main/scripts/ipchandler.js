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



import fs from 'fs'
//import i18n from '../../renderer/src/locales/locales.js'
//const { t } = i18n.global
import {  ipcMain, dialog } from 'electron'
import {join} from 'path'
import log from 'electron-log/main';
import { print } from "unix-print";
import { print as printWin } from "pdf-to-printer";
import { exec } from 'child_process';


const checkDiskSpace = require('check-disk-space').default

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

        ipcMain.on('openmsauth', (event) => { this.WindowHandler.createMsauthWindow();  event.returnValue = true })  

        ipcMain.on('getconfig', (event) => {  
            event.returnValue = this.copyConfig(config); 
        })  

        ipcMain.handle('getconfigasync', (event) => {  
            return this.copyConfig(config)
        })  

        ipcMain.handle('resetToken', async (event) => { 
            
            const win = this.WindowHandler.mainwindow; // Oder wie auch immer Sie auf Ihr BrowserWindow-Objekt zugreifen
            if (!win) return;

            
            await win.webContents.session.clearCache();
            await win.webContents.session.clearStorageData({
                storages: ['cookies']
              });

            config.accessToken = false

            log.info("ipchandler @ resetToken: Logged out of Office365")
            return this.copyConfig(config);  // we cant just copy the config because it contains examServerList which contains confic (circular structure)
        })  


        /**
         * öffnet datei in externem programm - plattform abhängig
         */
        ipcMain.handle('openfile', (event, filepath) => {  
            const cmd = process.platform === 'win32' ? `start "${filepath}"` :
            process.platform === 'darwin' ? `open "${filepath}"` :
            `xdg-open "${filepath}"`;

            try {
                exec(cmd, (error) => {
                    if (error) {
                        log.error('ipchandler @ openfile: Fehler beim Öffnen des PDF in externem Reader:', error);
                        return false
                    }
                    log.info('ipchandler @ openfile: Datei in expernem Reader geöffnet');
                    return true
                });
            }
            catch(err){
                log.error('ipchandler @ openfile: Fehler beim Öffnen des PDF:', err);
                return false
            }
        })  


        ipcMain.on('getCurrentWorkdir', (event) => {   event.returnValue = config.workdirectory  })


        ipcMain.handle('checkDiscspace', async () => {
       
                let diskSpace = await checkDiskSpace(config.workdirectory);
                let free = Math.round(diskSpace.free / 1024 / 1024 / 1024 * 1000) / 1000;
                //log.info("ipchandler @ checkDiskspace:",diskSpace)
                return free;
              
        });

        ipcMain.handle('setworkdir', async (event, arg) => {
            const result = await dialog.showOpenDialog( this.WindowHandler.mainwindow, { properties: ['openDirectory']  })
            if (!result.canceled){
                log.info('directories selected', result.filePaths)
                let message = ""
                try {
                    let testdir = join(result.filePaths[0]   , config.examdirectory)
                    if (!fs.existsSync(testdir)){fs.mkdirSync(testdir)}
                    message = "success"
                    config.workdirectory = testdir
                    log.info("setworkdir:", config)
                }
                catch (e){
                    message = "error"
                    log.error(e)
                }
                return {workdir: config.workdirectory, message : message}
            }
            else {
                return {workdir: config.workdirectory, message : 'canceled'}
            }
        })


        ipcMain.on('setPreviousWorkdir', async (event, workdir) => {
            if (workdir){
                log.info('previous directory selected', workdir)
                let message = ""
                try {
                    if (!fs.existsSync(workdir)){fs.mkdirSync(workdir)}
                    message = "success"
                    config.workdirectory = workdir
                }
                catch (e){
                    message = "error"
                    log.error(e)
                }
                event.returnValue = {workdir: config.workdirectory, message : message}
            }
            else {  event.returnValue = {workdir: config.workdirectory, message : 'canceled'} }
        })


        /**
         * returns old exam folders in workdirectory
         */
        ipcMain.handle('scanWorkdir', async (event, arg) => {
            let examfolders = []
            if (fs.existsSync(config.workdirectory)){
                    examfolders = fs.readdirSync(config.workdirectory, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            }
            return examfolders
        })


        /**
         * deletes old exam folder in workdirectory
         */
        ipcMain.handle('delPrevious', async (event, arg) => {
            let examdir = join( config.workdirectory, arg)
            if (fs.statSync(examdir).isDirectory()){
                try {
                    fs.rmSync(examdir, { recursive: true, force: true });
                }
                catch (e) {log.error(e)}
            }   
            return examdir
        })




        /**
         * get system printers
         */
        ipcMain.handle('getprinters', async (event, arg) => {
            const printers = await this.WindowHandler.mainwindow.webContents.getPrintersAsync();
            const printerNames = printers.map(printer => printer.name);
            //printerNames.push('dummy')
            return printerNames
        })



        /**
         * print pdf (or image) in new browserwindow process detached from the current exam view
         */
        // ipcMain.handle('printpdf-withoutoptions', async (event, pdfurl, defaultPrinter) => {
        //     log.info(`ipchandler: printpdf: ${pdfurl} defaultprinter: ${defaultPrinter}`)
            
        //     if (process.platform === "linux"){  //there is a problem on ubuntu and mint with the window.print() function  https://github.com/electron/electron/issues/31151
        //         let isKDE = false
        //         try {  isKDE = childProcess.execSync("echo $XDG_CURRENT_DESKTOP"); } 
        //         catch (err) { log.error(`Error: ${err.message}`);  }

        //         if (!isKDE.toString().trim().toLowerCase().includes('kde')){
        //             try { childProcess.exec(`xdg-open ${pdfurl}`)  }
        //             catch(err){log.error(err)}
        //             return    //exit here - other operating systems may directly launch the print dialog and do not need external apps
        //         }
        //         log.info("ipchandler: printpdf: printing on kde desktop")
        //     }
            
            
        //     let win = new BrowserWindow({ 
        //         show: false, 
        //         webPreferences: {
        //             webSecurity: false,
        //             nodeIntegration: false,
        //             contextIsolation: true,
        //         }
        //     });

        //     let printOptions = {}
        //     if (defaultPrinter){   // we do not use printoptions YET but if we can chose the default printer via dashboard ui then do not ask again here
        //         printOptions = {
        //             silent: true,
        //             printBackground: true,
        //             deviceName: defaultPrinter // Setzen des gewählten Druckers
        //           };
        //     }
        
        //     // Lesen Sie die PDF-Datei und konvertieren Sie sie in Base64
        //     let fBase64 = ""
        //     try {
        //         const fBuffer = fs.readFileSync(pdfurl);
        //         fBase64 = fBuffer.toString('base64');
        //     }
        //     catch (err) {
        //         log.info(`ipchandler: printpdf: ${err}`)
        //         win.show()
        //     }
           

        //     let framesource =  `<img src="data:image/png;base64,${fBase64}" alt="PNG or JPG" style="width:100%;" ">`;
        //     if (this.isPdfUrl(pdfurl)){
        //         framesource = `<iframe id="pdfFrame" src="data:application/pdf;base64,${fBase64}" style="width:100%; height:100vh;""></iframe>`
        //     }
           
        //     const htmlContent = `
        //         <!DOCTYPE html>
        //         <html>
        //         <head>
        //             <title>PDF Viewer</title>
        //             <script>
        //                 function printPdf() {
        //                     const iframe = document.getElementById('pdfFrame');
        //                     iframe.contentWindow.print();
        //                 }
        //                 function printPage() {
        //                     window.print(); // Diese Zeile druckt die gesamte Seite, einschließlich des iframes
        //                 }
        //             </script>
        //         </head>
        //         <body>
        //             ${framesource}  
        //         </body>
        //         </html>
        //     `;
        //     const dataUrl = `data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`;
        //     win.loadURL(dataUrl);

        //     win.webContents.on('did-finish-load', () => {
        //         log.info("ipchandler: printpdf: finished loading content preview window - opening print dialog")
        //         let jscode = `printPage()`
        //         if (this.isPdfUrl(pdfurl)){ jscode = `printPdf()` }

        //         win.webContents.executeJavaScript(jscode, true, () => {  // Code executed, now close the window
        //             win.close();
        //         }).catch(err => {
        //             log.error(err);
        //             win.show()
        //             win.webContents.openDevTools()
        //         });
        //     });
        // })




        ipcMain.handle('printpdf', async (event, pdfurl, defaultPrinter) => {
            log.info(`ipchandler: printpdf: ${pdfurl} defaultprinter: ${defaultPrinter}`)
            
            let printOptions = {}
            let printer = undefined

            if (defaultPrinter){   // we do not use printoptions YET but if we can chose the default printer via dashboard ui then do not ask again here
                printOptions = {
                    printDialog: false,
                    printer: defaultPrinter // Setzen des gewählten Druckers
                  };
                printer = defaultPrinter
            }

            if (process.platform === "linux" || process.platform === "darwin"){
                print(pdfurl, printer).then( ()=>{ log.info('ipchandler: printpdf: file sent to printer')} )
                .catch( (err) =>{
                    log.error(`ipchandler: printpdf (unix): ${err}`)
                });
            }
            else {
                printWin(pdfurl, printOptions).then( ()=>{ log.info('ipchandler: printpdf: file sent to printer')} )
                .catch( (err) =>{
                    log.error(`ipchandler: printpdf (win): ${err}`)
                });
            }
            
        })























        /**
         * Downloads the files for a specific student to his workdirectory (abgabe)
         */
        ipcMain.on('storeOnedriveFiles', async (event, args) => { 
            log.info("downloading onedrive files...")  
            const studentName = args.studentName
            const accessToken = args.accessToken
            const fileName = args.fileName
            const fileID = args.fileID
            const servername = args.servername

            // create user abgabe directory  // create archive directory
            let studentdirectory =  join(config.workdirectory, servername ,studentName)
            let time = new Date(new Date().getTime()).toLocaleTimeString();  //convert to locale string otherwise the foldernames will be created in UTC
            let tstring = String(time).replace(/:/g, "_");
            let studentarchivedir = join(studentdirectory, tstring)
            
            try {
                if (!fs.existsSync(studentdirectory)) { fs.mkdirSync(studentdirectory, { recursive: true });  }
                if (!fs.existsSync(studentarchivedir)){ fs.mkdirSync(studentarchivedir, { recursive: true }); }
            } catch (e) {log.error(e)}
         

            const fileResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileID}/content`, {
                headers: {'Authorization': `Bearer ${accessToken}`,  },
            }).catch( err => {log.error(err)});

            try {
                const fileBuffer = await fileResponse.arrayBuffer();
                fs.writeFileSync(join(studentarchivedir, fileName), Buffer.from(fileBuffer));
            } catch (e) {log.error(e)}

            const pdfFileResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileID}/content?format=pdf`, {
                headers: {'Authorization': `Bearer ${accessToken}`,  },
            }).catch( err => {log.error(err)});

            if (pdfFileResponse.ok) {
                const pdfFileBuffer = await pdfFileResponse.arrayBuffer();
                const pdfFilePath = join(studentarchivedir, `${fileName}.pdf`);
                try {
                    fs.writeFileSync(pdfFilePath, Buffer.from(pdfFileBuffer));
                    log.info(`Downloaded ${fileName} and ${fileName}.pdf`);
                } catch (e) {log.error(e)}  
            }
            else {
                log.error("there was a problem downloading the files as pdf")
            }
            
        })



    }

    isPdfUrl(url) {
        let pdf = false
        try {
           pdf =  url.toLowerCase().endsWith('.pdf');
        }
        catch (err) {
            log.info(`ipchandler: isPdfUrl: ${err}`) 
        }
        return pdf
    }

    copyConfig(conf) {
        let configCopy = {
            development: conf.development, 
            showdevtools: conf.showdevtools,
            workdirectory: conf.workdirectory,
            tempdirectory: conf.tempdirectory,
            examdirectory: conf.examdirectory,
            serverApiPort: conf.serverApiPort,
            multicastClientPort: conf.multicastClientPort,
            multicastServerClientPort: conf.multicastServerClientPort,
            multicastServerAdrr: conf.multicastServerAdrr,
            hostip: conf.hostip,
            gateway: conf.gateway,
            accessToken: conf.accessToken,
            version: conf.version,
            info: conf.info,
            buildforWEB: conf.buildforWEB
          };
        return configCopy
    }
}

export default new IpcHandler()
