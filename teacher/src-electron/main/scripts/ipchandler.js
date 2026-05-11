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
import { ipcMain, dialog, session } from 'electron'
import path, { join } from 'path'
import log from 'electron-log';
import { decryptBufferIfNeeded, isNxe1ExamEncrypted, unwrapNxe1ExamBuffer } from './examFileCryptoContext.js';
import { networkInterfaces } from 'os'
import { exec } from 'child_process';
import { gateway4sync} from 'default-gateway';
import ip from 'ip'
import dns from 'dns'
import net from 'node:net'
import qemuService from './qemuService.js'

import server from "../../server/src/server.js"
import checkDiskSpace from 'check-disk-space';
import { enqueuePrintJob } from './printjobhandler.js'

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
        ipcMain.on('loginBiP', (event, biptest) => {
            log.info("ipchandler @ loginBiP: opening bip window. testenvironment:", biptest)
            this.WindowHandler.createBiPLoginWin(biptest)
            event.returnValue = "hello from bip logon"
        })

        /** Clears BiP web session (same default session as BiP BrowserWindow) so the next login shows the portal login again. */
        ipcMain.handle('clearBipPortalSession', async (_event, biptest) => {
            const ses = session.defaultSession
            const origins = biptest
                ? ['https://q.bildung.gv.at']
                : ['https://bildung.gv.at', 'https://www.bildung.gv.at']
            const storages = ['cookies', 'localstorage', 'sessionstorage', 'indexdb', 'websql']
            for (const origin of origins) {
                try {
                    await ses.clearStorageData({ origin, storages })
                } catch (e) {
                    log.warn(`ipchandler @ clearBipPortalSession: ${origin}`, e)
                }
            }
            log.info('ipchandler @ clearBipPortalSession: done')
            return true
        })



        // returns the current serverstatus object of the given server(name)
        ipcMain.handle('getserverstatus', (event, servername) => { 
            const mcServer = this.config.examServerList[servername]
            if (mcServer ) { return mcServer.serverstatus  }
            else {           return false  }
        }) 


        // stops the current exam server 
        // (this is a copy of the /stopserver/:servername route in control.js )
        // rethink concept that local requests go to the API (this had a non electron server version in mind but makes no sense in electron only app)
        ipcMain.handle('stopserver', (event, servername) => { 
            const mcServer = this.config.examServerList[servername]
            if (mcServer ) { 
                mcServer.broadcastInterval.stop()
                mcServer.server.close();
                delete config.examServerList[servername]    //delete mcServer
                this.multicastClient.examServerList = this.multicastClient.examServerList.filter(exam => exam.servername !== servername)  // multicastclient keeps track of running servers in the lan
                return true
            }
            else {  return false  }
        }) 


        //return current studentlist
        ipcMain.handle('studentlist', (event, servername) => { 
            const mcServer = this.config.examServerList[servername]
            if (mcServer ) { 
                return {studentlist: mcServer.studentList}
            }
            else {  
                return {sender: "server", message:"notfound", status: "error", studentlist: []}
            }
        }) 

        /** Persist current student screenshot (data URL) into workdir/<server>/<student>/screenshots/ */
        ipcMain.handle('saveStudentScreenshot', async (_event, payload) => {
            try {
                const servername = typeof payload?.servername === 'string' ? payload.servername.trim() : ''
                const clientname = typeof payload?.clientname === 'string' ? payload.clientname.trim() : ''
                const imageDataUrl = typeof payload?.imageDataUrl === 'string' ? payload.imageDataUrl : ''
                if (!servername || !clientname || !imageDataUrl) {
                    return { ok: false, error: 'invalid_arguments' }
                }
                if (clientname.includes('..') || clientname.includes('/') || clientname.includes('\\')) {
                    return { ok: false, error: 'invalid_clientname' }
                }
                const mcServer = this.config.examServerList[servername]
                if (!mcServer) {
                    return { ok: false, error: 'server_not_found' }
                }
                const comma = imageDataUrl.indexOf(',')
                if (comma < 12 || !imageDataUrl.startsWith('data:image/')) {
                    return { ok: false, error: 'invalid_image_dataurl' }
                }
                const header = imageDataUrl.slice(0, comma).toLowerCase()
                const b64 = imageDataUrl.slice(comma + 1)
                if (!header.includes(';base64')) {
                    return { ok: false, error: 'invalid_image_dataurl' }
                }
                let ext = '.jpg'
                if (header.includes('image/png')) ext = '.png'
                else if (header.includes('image/webp')) ext = '.webp'
                else if (header.includes('image/jpeg') || header.includes('image/jpg')) ext = '.jpg'
                const buf = Buffer.from(b64, 'base64')
                if (!buf.length) {
                    return { ok: false, error: 'empty_image' }
                }
                const now = new Date()
                const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
                const timeStr = now.toISOString().substr(11, 8).replace(/:/g, '_')
                const screenshotsDir = join(this.config.workdirectory, servername, clientname, 'screenshots')
                await fs.promises.mkdir(screenshotsDir, { recursive: true })
                const filename = `screenshot-${dateStr}-${timeStr}${ext}`
                const absoluteFilename = join(screenshotsDir, filename)
                await fs.promises.writeFile(absoluteFilename, buf)
                log.info(`ipchandler @ saveStudentScreenshot: wrote ${absoluteFilename}`)
                return { ok: true, path: absoluteFilename }
            } catch (e) {
                log.error('ipchandler @ saveStudentScreenshot', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })




        // opens a loginwindow for microsoft 365
        ipcMain.on('openmsauth', (event) => { this.WindowHandler.createMsauthWindow();  event.returnValue = true })  


        // returns current config
        ipcMain.on('getconfig', (event) => {  
            event.returnValue = this.copyConfig(config); 
        })  


        // returns current config async
        ipcMain.handle('getconfigasync', (event) => {  
            return this.copyConfig(config)
        })  


        /**
         * QEMU integration (LocalVM, qcow2 in workdir/QEMU)
         */
        ipcMain.handle('qemu-list-disks', async () => {
            try {
                return await qemuService.listDisks({ workdirectory: config.workdirectory })
            } catch (e) {
                log.error('ipchandler @ qemu-list-disks', e)
                return []
            }
        })

        ipcMain.handle('qemu-install-default', async () => {
            try {
                log.info('ipchandler @ qemu-install-default: requested');
                const sendProgress = (p) => {
                    try { this.WindowHandler?.mainwindow?.webContents?.send?.('qemu-install-progress', p); } catch (e) {}
                };
                sendProgress({ phase: 'start', file: null, percent: 0 });
                const res = await qemuService.installDefaultVm({ workdirectory: config.workdirectory, onProgress: sendProgress })
                sendProgress({ phase: 'end', file: null, percent: 100 });
                return res;
            } catch (e) {
                log.error('ipchandler @ qemu-install-default', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })

        ipcMain.handle('qemu-hash-disk', async (_event, payload = {}) => {
            try {
                const { qcow2Name } = payload || {}
                const sha256 = await qemuService.hashDisk({ workdirectory: config.workdirectory, qcow2Name })
                return { ok: true, sha256 }
            } catch (e) {
                log.error('ipchandler @ qemu-hash-disk', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })

        ipcMain.handle('qemu-stat-disk', async (_event, payload = {}) => {
            try {
                const { qcow2Name } = payload || {}
                const { size } = await qemuService.statDisk({ workdirectory: config.workdirectory, qcow2Name })
                return { ok: true, size }
            } catch (e) {
                log.error('ipchandler @ qemu-stat-disk', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })

        ipcMain.handle('qemu-boot-disk', async (_event, payload = {}) => {
            try {
                const { qcow2Name } = payload || {}
                return await qemuService.bootDisk({ workdirectory: config.workdirectory, qcow2Name })
            } catch (e) {
                log.error('ipchandler @ qemu-boot-disk', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })

        ipcMain.handle('qemu-pick-import-disk', async () => {
            try {
                const result = await dialog.showOpenDialog(this.WindowHandler.mainwindow, {
                    properties: ['openFile'],
                    filters: [{ name: 'QEMU Disk', extensions: ['qcow2'] }],
                })
                if (result.canceled || !result.filePaths || !result.filePaths[0]) {
                    return { ok: false, cancelled: true }
                }
                return await qemuService.importDisk({ workdirectory: config.workdirectory, sourcePath: result.filePaths[0] })
            } catch (e) {
                log.error('ipchandler @ qemu-pick-import-disk', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })


        // log out of microsoft 365
        ipcMain.handle('resetToken', async (event) => { 
            const win = this.WindowHandler.mainwindow; // Oder wie auch immer Sie auf Ihr BrowserWindow-Objekt zugreifen
            if (!win) return;

            await win.webContents.session.clearCache();
            await win.webContents.session.clearStorageData({
                storages: ['cookies']
              });

            config.accessToken = false

            log.info("ipchandler @ resetToken: Logged out of Office365")
            return this.copyConfig(config);  // we cant just copy the config because it contains examServerList which contains config (circular structure)
        })  


        /**
         * opens file in external program - platform dependent
         */
        ipcMain.handle('openfile', (event, filepath) => {  
            const cmd = process.platform === 'win32' ? `start " " "${filepath}"` :
            process.platform === 'darwin' ? `open "${filepath}"` :
            `xdg-open "${filepath}"`;

            try {
                exec(cmd, (error) => {
                    if (error) {
                        log.error('ipchandler @ openfile: Error opening PDF in external reader:', error);
                        return false
                    }
                    log.info('ipchandler @ openfile: File opened in external reader');
                    return true
                });
            }
            catch(err){
                log.error('ipchandler @ openfile: Error opening PDF:', err);
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

        ipcMain.handle('setbackupdir', async (event, arg) => {
            const result = await dialog.showOpenDialog( this.WindowHandler.mainwindow, { properties: ['openDirectory']  })
            if (!result.canceled){
                log.info('directories selected', result.filePaths)
                let message = ""
                try {
                    let testdir = join(result.filePaths[0]   , config.serverdirectory)
                    if (!fs.existsSync(testdir)){fs.mkdirSync(testdir)}
                    message = "success"
                    //config.workdirectory = testdir
                    config.backupdirectory = testdir
                    log.info("ipchandler @ setbackupdir:", config)
                }
                catch (e){
                    message = "error"
                    log.error(e)
                }
                return {backupdir: config.backupdirectory, message : message}
            }
            else {
                return {backupdir: config.backupdirectory, message : 'canceled'}
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


        ipcMain.handle('createBipExamdirectory', async (event, exam) => {
            let message = ""
            const workdir = join(config.workdirectory, exam.examName)
            const filePath = join(workdir, 'serverstatus.json');
            

            try {
                if (!fs.existsSync(workdir)){fs.mkdirSync(workdir)}
                message = "success"
            }
            catch (e){
                message = e.message
                log.error(e)
            }

            try {  
                const jsonString = JSON.stringify(exam, null, 2);
                // Validate JSON before writing to prevent invalid JSON files
                JSON.parse(jsonString);
                fs.writeFileSync(filePath, jsonString);  
            }   // save mcServer.serverstatus as JSON file
            catch (error) {  
                log.error(`ipchandler @ createBipExamdirectory: JSON validation or write failed: ${error}`);
                message = "error";
            }
                  
            event.returnValue = {message : message}

        })

         /**
         * ASYNC GET LOG FILE from examdirectory
         */ 
        ipcMain.handle('getlog', async (event) => {   
            const workdir = join(config.workdirectory,"/")
            let filepath = join(workdir,"next-exam-teacher.log")
           
            try {
                let data = fs.readFileSync(filepath, 'utf8')
                
                let serverlog = data.trim()
                .split('\n')
                .map(line => {
                  const match = line.match(/^\[(.+?)\]\s+\[(.+?)\]\s+(.*)$/);
                  if (match) {
                    const [, date, type, rawText] = match;
                    
                    // Set color based on log type
                    let color;
                    switch (type.toLowerCase()) {
                      case 'info':
                        color = '#0aa2c0';
                        break;
                      case 'warn':
                        color = 'var(--bs-warning)';
                        break;
                      case 'error':
                        color = 'var(--bs-danger)';
                        break;
                      default:
                        color = 'var(--bs-cyan)';
                    }
                    
                    // Default values
                    let source = 'next-exam';
                    let text = rawText;
                    
                    // If a colon is present: everything before the first colon as 'source'
                    if (rawText.includes(':')) {
                      const colonIndex = rawText.indexOf(':');
                      source = rawText.substring(0, colonIndex).trim();
                      text = rawText.substring(colonIndex + 1).trim();
                    }
                    
                    return { date, type, text, color, source };
                  }
                  return null;
                })
                .filter(item => item !== null);


                return serverlog
            }
            catch (err) {
                log.error(`ipchandler @ getlog: ${err}`); 
                return false
            }
            
        })


        /**
         * Save exam event log to <workdir>/<servername>/examlog.json
         */
        ipcMain.handle('saveExamLog', async (event, servername, payload) => {
            const filePath = join(config.workdirectory, servername, 'examlog.json')
            try {
                await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2))
                return true
            } catch (err) {
                log.error(`ipchandler @ saveExamLog: ${err}`)
                return false
            }
        })

        /**
         * Load exam event log from <workdir>/<servername>/examlog.json
         */
        ipcMain.handle('loadExamLog', async (event, servername) => {
            const filePath = join(config.workdirectory, servername, 'examlog.json')
            try {
                const raw = await fs.promises.readFile(filePath, 'utf-8')
                return JSON.parse(raw)
            } catch (err) {
                return null  // file not found or invalid — start fresh
            }
        })


        /**
         * returns old exam folders in workdirectory
         */

        ipcMain.handle('scanWorkdir', async (event, arg) => {
            let examfolders = [] // array for results
            if (fs.existsSync(config.workdirectory)) { // check if base dir exists
                const folders = fs.readdirSync(config.workdirectory, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name)
                for (const dirname of folders) { // iterate over directory names
                    const serverstatusPath = join(config.workdirectory, dirname, 'serverstatus.json')
                    if (fs.existsSync(serverstatusPath)) { // check if file exists
                    try {
                        const serverstatus = JSON.parse(fs.readFileSync(serverstatusPath, 'utf-8')) // parse JSON to object
                        if (!serverstatus.examName) {
                            serverstatus.examName = dirname
                        }
                        examfolders.push(serverstatus) // add object to array
                    } catch (e) {
                        log.error(`ipchandler @ scanWorkdir: Error parsing serverstatus.json in ${dirname}:`, e)
                    }
                    }
                }
            }
            return examfolders // return results
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


        /** Get Specific Submission by filepath as base64 string */
        ipcMain.handle('getSpecificSubmissionBase64', async (event, filepath) => {
            try {
                let raw = fs.readFileSync(filepath)
                const rel = path.relative(this.config.workdirectory, filepath)
                const servername = rel.split(path.sep)[0]
                const mcServer = this.config.examServerList[servername]
                if (mcServer) {
                    raw = decryptBufferIfNeeded(raw, mcServer, 'ipchandler @ getSpecificSubmissionBase64')
                }
                const submission = raw.toString('base64')
                return { submission: submission, status: "success" }
            }
            catch (e) {
                log.error(`ipchandler @ getSpecificSubmissionBase64: ${e}`)
                return { submission: false, status: "error" }
            }
        })

        /** Pick a PDF from disk; decrypt NXE1 layers with encryption secret when present; return base64 for preview. */
        ipcMain.handle('pickEncryptedPdfForPreview', async (_event, encryptionPassword) => {
            const win = this.WindowHandler?.mainwindow
            try {
                const dlg = await dialog.showOpenDialog(win || undefined, {
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }],
                })
                if (dlg.canceled || !dlg.filePaths?.[0]) {
                    return { ok: false, cancelled: true }
                }
                const filePath = dlg.filePaths[0]
                let plain = await fs.promises.readFile(filePath)
                if (isNxe1ExamEncrypted(plain)) {
                    const unwrapped = unwrapNxe1ExamBuffer(plain, encryptionPassword, 'pickEncryptedPdfForPreview')
                    if (!unwrapped.ok) {
                        return { ok: false, code: unwrapped.code }
                    }
                    plain = unwrapped.buffer
                }
                const probe = plain.subarray(0, Math.min(plain.length, 2048)).toString('binary')
                if (!probe.includes('%PDF-')) {
                    return { ok: false, code: 'NOT_PDF' }
                }
                return {
                    ok: true,
                    base64: plain.toString('base64'),
                    filename: path.basename(filePath),
                    filePath,
                }
            } catch (e) {
                log.error('ipchandler @ pickEncryptedPdfForPreview', e)
                return { ok: false, code: 'ERROR', message: String(e?.message || e) }
            }
        })




       /**
         * get latest submisions from all students
         * return array of objects with studentname, latestfilepath, latestfilename and submissiondate (timestamp)
         * @param servername the name of the server to get the submissions from
         * @return { sender: "server", message:"success", status: "success", submissions: submissions }
         */
       ipcMain.handle('getSubmissions', async (event, servername, currentserverstatus) => {
            const mcServer = this.config.examServerList[servername]
            const serverstatus = JSON.parse(currentserverstatus)
            if (!mcServer) { return { sender: "server", message:"notfound", status: "error", submissions: [] } }
            let submissions = []
            let dir =  join( config.workdirectory, mcServer.serverinfo.servername);
           
            if (fs.existsSync(dir)) { // check if base dir exists
                const folders = fs.readdirSync(dir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name)

                for (const studentName of folders) { // iterate over directory names
                    if (studentName.toUpperCase() === 'UPLOADS') { // ignore UPLOADS directory
                        continue
                    }
                    
                    let sections = {}
                    let submissionDir = join(dir, studentName, "ABGABE")
                    
                    // iterate over exam sections 1-4
                    for (let section = 1; section <= 4; section++) {
                        let sectionDir = join(submissionDir, String(section))
                        
                        // initialize section with default values
                        sections[section] = {
                            path: null,
                            filename: "",
                            date: false,
                            sectionname: ""
                        }
                        
                        if (fs.existsSync(sectionDir)) {
                            let sectionFiles = fs.readdirSync(sectionDir, { withFileTypes: true })
                                .filter(dirent => dirent.isFile()) // only files, not directories
                                .map(dirent => dirent.name)
                            
                            if (sectionFiles.length > 0) {
                                let latestSubmission = sectionFiles
                                    .map(file => {
                                        let filePath = join(sectionDir, file)
                                        return { file, mtime: fs.statSync(filePath).mtime }
                                    })
                                    .sort((a, b) => b.mtime - a.mtime)[0]
                                
                                sections[section] = {
                                    path: join(sectionDir, latestSubmission.file),
                                    filename: latestSubmission.file,
                                    date: latestSubmission.mtime,
                                    sectionname: serverstatus.examSections[section].sectionname
                                }
                            }
                        }
                    }
                    
                    submissions.push({
                        studentName: studentName,
                        sections: sections
                    })
                }
            }
            return submissions
        })













         /**
         * get latest bak file from specific student directory
         */
        ipcMain.handle('getLatestBakFile', async (event, servername, studentName) => {
            const mcServer = this.config.examServerList[servername]
            if (!mcServer) { return { sender: "server", message:"notfound", status: "error", filepath: false } }
            let latestBakFile = null
            let dir =  join( config.workdirectory, mcServer.serverinfo.servername, studentName);
    
            //check if directory exists
            if (!fs.existsSync(dir)) { return { sender: "server", message:"notfound", status: "error", filepath: false } }

            //in the student directroy there are several backup directories  that contain a bak file /20251112_10_20_13/
            // the bakfile naming scheme is studentname.bak ... we only need the latest one that has the studentname as filename
            // ignore directories: ABGABE and focuslost
            const backupDirectories = fs.readdirSync(dir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory() && dirent.name !== 'ABGABE' && dirent.name !== 'focuslost')
                .map(dirent => {
                    let filePath = join(dir, dirent.name)
                    return { name: dirent.name, mtime: fs.statSync(filePath).mtime }
                })
                .sort((a, b) => b.mtime - a.mtime)
            
            if (backupDirectories.length === 0) {
                return { sender: "server", message:"notfound", status: "error", filepath: false }
            }
            
            let latestBackupDirectory = backupDirectories[0].name
            log.info("ipchandler @ getLatestBakFile: Searching for latest backup file in:", dir, latestBackupDirectory)
            const latestBakFilepath = join(dir, latestBackupDirectory, studentName + '.bak')
            const latestBackupDirectoryPath = join(dir, latestBackupDirectory)
            
            //get latest bak file  - check if file exists
            if (!fs.existsSync(latestBakFilepath)) { return { sender: "server", message:"notfound", status: "error", filepath: false, latestBackupDirectoryPath:latestBackupDirectoryPath || false } }
            //return the existing and checked filepath or if no file was found false
            return { sender: "server", message:"success", status: "success", filepath: latestBakFilepath, latestBackupDirectoryPath: latestBackupDirectoryPath }

        })











        /**
         * get system printers
         */
        ipcMain.handle('getprinters', async () => {
            const printers = await this.WindowHandler.mainwindow.webContents.getPrintersAsync();
            //log.info('ipchandler @ getprinters: printers', printers)
            const printerData = printers.map(printer => ({
                printerName: printer.name,
                isDefault: printers.length === 1 ? true : printer.isDefault, // deprecated in electron 36, set to true if only one printer
                description: printer.description
            }));

            return printerData
        })





        /**
         * Print a document as base64 (PDF or image); queue + raster pipeline live in printjobhandler.js
         */
        ipcMain.handle('printBase64', async (event, docBase64, printerName, previewType, jobTitle) => {
            try {
                return await enqueuePrintJob(docBase64, printerName, previewType, jobTitle)
            } catch (error) {
                log.warn(`ipchandler @ printBase64: returning error to renderer: ${error.message}`);
                return { success: false, error: error.message };
            }
        });




        /**
         * re-check hostip and enable multicast client
         */ 
        ipcMain.handle('checkhostip', async () => {
            // Collect all available network interfaces with IP addresses
            const interfaces = networkInterfaces()
            this.availableInterfaces = null
            
            // Collect all IPv4 addresses
            Object.keys(interfaces).forEach((interfaceName) => {
                interfaces[interfaceName].forEach((iface) => {
                    // Filter out loopback and local addresses
                    if (iface.family === 'IPv4' &&
                        !iface.address.startsWith('127.') &&
                        !iface.address.startsWith('169.254.')) {
                        if (!this.availableInterfaces) {
                            this.availableInterfaces = []
                        }
                        this.availableInterfaces.push({
                            name: interfaceName,
                            address: iface.address
                        })
                    }
                })
            })

            // Save the old IP address
            const oldHostIp = this.config.hostip

            // If a preferred interface is set, use it to quickly get an IP
            if (this.preferredInterface) {
                const preferred = this.availableInterfaces?.find(iface => iface.name === this.preferredInterface)
                if (preferred) {
                    this.config.hostip = preferred.address
                    this.config.interface = preferred.name
                    // Check if a gateway exists for the preferred interface
                    try {
                        const {gateway, version, int} = gateway4sync(preferred.name)
                        this.config.gateway = int === this.preferredInterface
                    } catch (e) {
                        this.config.gateway = false
                    }
                }
            }
            else {
                try {
                    const {gateway, version, int} =  gateway4sync()
                    this.config.hostip = ip.address(int)
                    this.config.interface = int
                    this.config.gateway = true
                }
                catch (e) {
                    this.config.hostip = false
                    this.config.gateway = false
                }

                if (!this.config.hostip) {
                    try {
                        this.config.hostip = ip.address() //this delivers an ip even if gateway is not set - the first ip address of the system
                        // use this address to find the name of the interface
                        const interfaceName = Object.keys(interfaces).find(key => interfaces[key].some(iface => iface.address === this.config.hostip))
                        this.config.interface = interfaceName

                    }
                    catch (e) {
                        log.error("ipcHandler @ checkhostip: Unable to determine ip address")
                        this.config.hostip = false
                        this.config.gateway = false
                        this.config.interface = false
                    }
                }
            }

            // check if multicast client is running - otherwise start it
            if (this.config.hostip == "127.0.0.1") { this.config.hostip = false }

            // Check if the IP has changed and reinitialize everything if necessary
            if (oldHostIp !== this.config.hostip && this.config.hostip) {
                log.info(`main: IP changed from ${oldHostIp} to ${this.config.hostip}, reinitializing services...`)

                // Reinitialize multicast client on IP change (multicastclient is only used for discovery of other exam servers)
                if (this.multicastClient && this.multicastClient.client.address()) { // check if multicast client is actually running
                    try {
                        await this.multicastClient.stop()
                        this.multicastClient.init(this.config.gateway)
                        log.info('main: Multicast client reinitialized')
                    }
                    catch (e) {
                        log.error('main: Failed to reinitialize multicast client:', e)
                    }
                }

                // Restart Express server on IP change
                if (server) {
                    if (server.listening) {
                        server.close(() => {
                            log.info(`main: Express server stopped due to IP change`)
                            server.listen(config.serverApiPort, () => {
                                log.info(`main: Express server restarted on https://${config.hostip}:${config.serverApiPort}`)
                            })
                        })
                    }
                    else {
                        server.listen(config.serverApiPort, () => {
                            log.info(`main: Express server started on https://${config.hostip}:${config.serverApiPort}`)
                        })
                    }
                }
            }

            return { 
                hostip: this.config.hostip, 
                interface: this.config.interface,
                availableInterfaces: this.availableInterfaces,
                preferredInterface: this.preferredInterface 
            }
        })

        ipcMain.on('checkhostip', async (event) => { 
            // Collect all available network interfaces with IP addresses
            const interfaces = networkInterfaces()
            this.availableInterfaces = null
            
            // Collect all IPv4 addresses
            Object.keys(interfaces).forEach((interfaceName) => {
                interfaces[interfaceName].forEach((iface) => {
                    // Filter out loopback and local addresses
                    if (iface.family === 'IPv4' && 
                        !iface.address.startsWith('127.') && 
                        !iface.address.startsWith('169.254.')) {
                        if (!this.availableInterfaces) {
                            this.availableInterfaces = []
                        }
                        this.availableInterfaces.push({
                            name: interfaceName,
                            address: iface.address
                        })
                    }
                })
            })

            // Save the old IP address
            const oldHostIp = this.config.hostip

            // If a preferred interface is set, use it to quickly get an IP
            if (this.preferredInterface) {
                const preferred = this.availableInterfaces?.find(iface => iface.name === this.preferredInterface)
                if (preferred) {
                    this.config.hostip = preferred.address
                    this.config.interface = preferred.name
                    // Check if a gateway exists for the preferred interface
                    try {
                        const {gateway, version, int} = gateway4sync(preferred.name)
                        this.config.gateway = int === this.preferredInterface
                    } catch (e) {
                        this.config.gateway = false
                    }
                }
            } 
            else {
                try { 
                    const {gateway, version, int} =  gateway4sync()
                    this.config.hostip = ip.address(int)
                    this.config.interface = int
                    this.config.gateway = true
                }
                catch (e) {
                    this.config.hostip = false
                    this.config.gateway = false
                }

                if (!this.config.hostip) {
                    try {
                        this.config.hostip = ip.address() //this delivers an ip even if gateway is not set - the first ip address of the system
                        // use this address to find the name of the interface
                        const interfaceName = Object.keys(interfaces).find(key => interfaces[key].some(iface => iface.address === this.config.hostip))
                        this.config.interface = interfaceName

                    }  
                    catch (e) {
                        log.error("ipcHandler @ checkhostip: Unable to determine ip address")
                        this.config.hostip = false
                        this.config.gateway = false
                        this.config.interface = false
                    }
                }
            }
           
            // check if multicast client is running - otherwise start it
            if (this.config.hostip == "127.0.0.1") { this.config.hostip = false }

            // Check if the IP has changed and reinitialize everything if necessary
            if (oldHostIp !== this.config.hostip && this.config.hostip) {
                log.info(`main: IP changed from ${oldHostIp} to ${this.config.hostip}, reinitializing services...`)

                // Reinitialize multicast client on IP change (multicastclient is only used for discovery of other exam servers)
                if (this.multicastClient && this.multicastClient.client.address()) { // check if multicast client is actually running
                    try {
                        await this.multicastClient.stop()
                        this.multicastClient.init(this.config.gateway)
                        log.info('main: Multicast client reinitialized')
                    } 
                    catch (e) {
                        log.error('main: Failed to reinitialize multicast client:', e)
                    }
                }

                // Restart Express server on IP change
                if (server) {
                    if (server.listening) {
                        server.close(() => {
                            log.info(`main: Express server stopped due to IP change`)
                            server.listen(config.serverApiPort, () => {
                                log.info(`main: Express server restarted on https://${config.hostip}:${config.serverApiPort}`)
                            })
                        })
                    } 
                    else {
                        server.listen(config.serverApiPort, () => {
                            log.info(`main: Express server started on https://${config.hostip}:${config.serverApiPort}`)
                        })
                    }
                }
            } 
            // else if (this.config.hostip && this.multicastClient && !this.multicastClient.client.address()) {  // If no IP change but multicast client is not running
            //     this.multicastClient.init(this.config.gateway)
            // }
              
            event.returnValue = { 
                hostip: this.config.hostip, 
                interface: this.config.interface,
                availableInterfaces: this.availableInterfaces,
                preferredInterface: this.preferredInterface 
            }
        })

        // does what it says..  if more than one interface is found this will set the preferred interface
        ipcMain.handle('setPreferredInterface', (event, arg) => {
            this.preferredInterface = arg
        })

        ipcMain.on('unsetPreferredInterface', (event) => {
            this.preferredInterface = false
            event.returnValue = { 
                hostip: this.config.hostip, 
                interface: this.config.interface,
                availableInterfaces: this.availableInterfaces,
                preferredInterface: this.preferredInterface 
            }
        })

        /**
         * Resolve a hostname to an IPv4 address for LanguageTool configuration (teacher app)
         */ 
        ipcMain.handle('resolveHostToIp', async (_event, host) => {
            if (!host || typeof host !== 'string') {
                return { ok: false, ip: null, error: 'invalid-host' };
            }
            try {
                const lookupHost = host.trim().replace(/^https?:\/\//i, '').split('/')[0];
                if (!lookupHost) {
                    return { ok: false, ip: null, error: 'empty-host' };
                }
                const result = await dns.promises.lookup(lookupHost, { family: 4 });
                return { ok: true, ip: result.address, error: null };
            } catch (err) {
                log.warn('teacher ipchandler @ resolveHostToIp: failed');
                return { ok: false, ip: null, error: err?.message || 'lookup-failed' };
            }
        })

        /**
         * Check whether a host is reachable on a TCP port (teacher app)
         */
        ipcMain.handle('checkHostReachable', async (_event, host, port = 443, timeoutMs = 1500) => {
            if (!host || typeof host !== 'string') {
                return { ok: false, error: 'invalid-host' };
            }
            const lookupHost = host.trim().replace(/^https?:\/\//i, '').split('/')[0];
            if (!lookupHost) {
                return { ok: false, error: 'empty-host' };
            }
            const p = typeof port === 'number' && Number.isFinite(port) ? port : 443;
            const t = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) ? timeoutMs : 1500;
            const tryConnect = async (targetHost) =>
                await new Promise((resolve) => {
                    let done = false;
                    const finish = (ok, error) => {
                        if (done) return;
                        done = true;
                        resolve({ ok, error: error || null });
                    };
                    try {
                        const socket = net.connect({ host: targetHost, port: p });
                        socket.setTimeout(t);
                        socket.once('connect', () => {
                            socket.end();
                            finish(true, null);
                        });
                        socket.once('timeout', () => {
                            socket.destroy();
                            finish(false, 'timeout');
                        });
                        socket.once('error', (err) => {
                            socket.destroy();
                            finish(false, err?.code || err?.message || 'error');
                        });
                    } catch (err) {
                        finish(false, err?.message || 'error');
                    }
                });

            let addrs = null;
            try {
                addrs = await dns.promises.lookup(lookupHost, { all: true });
            } catch (e) {
                addrs = null;
            }

            const targets = Array.isArray(addrs) && addrs.length ? addrs.map((a) => a.address) : [lookupHost];
            let lastErr = null;
            for (const th of targets) {
                const r = await tryConnect(th);
                if (r.ok) return { ok: true, error: null };
                lastErr = r.error || lastErr;
            }
            return { ok: false, error: lastErr || 'unreachable' };
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
                const buf = Buffer.from(fileBuffer);
                fs.writeFileSync(join(studentarchivedir, fileName), buf);
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


    // this is a littlebit of a bad design choice - because of recursion we need to copy the config object but 
    // we need to make sure we update this part everytime wie add something to the config   or it will get lost here
    copyConfig(conf) {
        let configCopy = {
            development: conf.development, 
            showdevtools: conf.showdevtools,
            bipIntegration: conf.bipIntegration,
            bipDemo: conf.bipDemo,
            bipApiUrl: conf.bipApiUrl,
            workdirectory: conf.workdirectory,
            tempdirectory: conf.tempdirectory,
            backupdirectory: conf.backupdirectory,
            serverdirectory: conf.serverdirectory,
           
            serverApiPort: conf.serverApiPort,
            multicastClientPort: conf.multicastClientPort,
            multicastServerClientPort: conf.multicastServerClientPort,
           
            multicastServerAdrr: conf.multicastServerAdrr,
            hostip: conf.hostip,
            gateway: conf.gateway,
            accessToken: conf.accessToken,
            version: conf.version,
            buildDate: conf.buildDate,
            buildNumber: conf.buildNumber,
            info: conf.info,
            buildforWEB: conf.buildforWEB,
            exammodes: conf.exammodes
          };
        return configCopy
    }
}

export default new IpcHandler()
