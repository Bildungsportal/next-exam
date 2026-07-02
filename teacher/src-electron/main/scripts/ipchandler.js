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
import { ipcMain, dialog, session, shell } from 'electron'
import path, { join } from 'path'
import log from 'electron-log';
import { decryptBufferIfNeeded, isNxe1ExamEncrypted, unwrapNxe1ExamBuffer } from './examFileCryptoContext.js';
import {
    decodeBipWstoken,
    fetchBipSiteInfo,
    pdfHasEmbeddedSignature,
    verifySubmissionPdfBipIdentity,
    verifySubmissionPdfIntegrity,
    SUBMISSION_SIGN_MODE_BIP,
} from '../../../../shared/submissionPdfSign.js';
import { networkInterfaces } from 'os'
import { exec } from 'child_process';
import { gateway4sync} from 'default-gateway';
import ip from 'ip'
import dns from 'dns'
import net from 'node:net'
import qemuService from './qemuService.js'
import {
    checkQemuAvailability,
    getQemuInstallInfo,
    getWindowsHypervisorPlatformState,
    requestEnableWindowsHypervisorPlatform,
} from '../../../../shared/qemuAvailability.js'
import archiver from 'archiver'

import server from "../../server/src/server.js"
import { resolvePathUnderRoot, isSafePathSegment } from '../../server/src/utils/safePaths.js'
import checkDiskSpace from 'check-disk-space';
import { enqueuePrintJob } from './printjobhandler.js'
import { buildTeacherCombinedLatestPdf } from './getLatestCombinedPdf.js'
import multiCastserver from './multicastserver.js'
import i18n from '../../../src/locales/locales.js'
import {loadSEBConfig} from "./sebintegration.js";

const { t } = i18n.global

/** Zip a folder for dashboard explorer download (same behaviour as data.js zipDirectory). */
function zipExplorerDirectory(sourceDir, outPath) {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const stream = fs.createWriteStream(outPath)
    return new Promise((resolve, reject) => {
        archive
            .directory(sourceDir, false)
            .on('error', (err) => reject(err))
            .pipe(stream)
        stream.on('close', () => resolve())
        archive.finalize()
    })
}

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



        /** Returns the in-memory serverstatus object for a running exam server, or false if none. */
        ipcMain.handle('getserverstatus', (event, servername) => { 
            const mcServer = this.config.examServerList[servername]
            if (mcServer ) { return mcServer.serverstatus  }
            else {           return false  }
        }) 

        /** Reads serverstatus.json for a loaded exam server, sets mcServer.serverinfo.pin from the file, returns { status, serverstatus } with parsed JSON or serverstatus false when the file is missing or unreadable (error envelope when the server is not in memory). */
        ipcMain.handle('getServerStatusFromDisk', async (_event, servername) => {
            const mcServer = this.config.examServerList[servername]
            if (!mcServer) {
                return { sender: 'server', status: 'error', message: t('control.notfound'), serverstatus: false }
            }
            const filePath = join(this.config.workdirectory, mcServer.serverinfo.servername, 'serverstatus.json')
            try {
                const fileContent = await fs.promises.readFile(filePath, 'utf-8')
                const parsed = JSON.parse(fileContent)
                mcServer.serverinfo.pin = parsed.pin
                return { sender: 'server', status: 'success', serverstatus: parsed }
            } catch (_err) {
                return { sender: 'server', status: 'success', serverstatus: false }
            }
        })

        /** Applies payload.serverstatus to mcServer, validates optional 4-digit pin when present, writes serverstatus.json under workdir and mirrors it to backupdirectory when configured. */
        ipcMain.handle('setServerStatus', async (_event, payload) => {
            const { servername, serverstatus: incoming } = payload || {}
            const mcServer = this.config.examServerList[servername]
            if (!mcServer) {
                return { sender: 'server', message: t('control.notfound'), status: 'error' }
            }
            if (!incoming || typeof incoming !== 'object') {
                return { sender: 'server', message: t('control.invalidpayload'), status: 'error' }
            }
            let normalizedPin = null
            if (incoming.pin !== undefined && incoming.pin !== null) {
                const pinStr = String(incoming.pin).trim()
                if (!/^\d{4}$/.test(pinStr)) {
                    return { sender: 'server', message: t('control.invalidpin'), status: 'error' }
                }
                normalizedPin = pinStr
            }
            const examSections = incoming.examSections
            const activeSection = incoming.activeSection
            if (!examSections || typeof examSections !== 'object' || activeSection == null || examSections[activeSection] == null || typeof examSections[activeSection] !== 'object') {
                log.warn('ipchandler @ setServerStatus: invalid examSections or activeSection')
                return { sender: 'server', message: t('control.invalidpayload'), status: 'error' }
            }
            mcServer.serverstatus = incoming
            if (normalizedPin !== null) {
                mcServer.serverinfo.pin = normalizedPin
            }
            log.info('ipchandler @ setServerStatus: saving server status to disc')
            const workdir = resolvePathUnderRoot(this.config.workdirectory, [mcServer.serverinfo.servername])
            const filePath = resolvePathUnderRoot(this.config.workdirectory, [mcServer.serverinfo.servername, 'serverstatus.json'])
            try {
                if (!workdir || !filePath) {
                    log.error('ipchandler @ setServerStatus: unsafe workdir or filePath')
                    return { sender: 'server', message: 'could not save serverstatus to disc', status: 'error' }
                }
                await fs.promises.mkdir(workdir, { recursive: true })
                const jsonString = JSON.stringify(mcServer.serverstatus, null, 2)
                JSON.parse(jsonString)
                await fs.promises.writeFile(filePath, jsonString)
                if (this.config.backupdirectory) {
                    const backupExamDir = resolvePathUnderRoot(this.config.backupdirectory, [mcServer.serverinfo.servername])
                    const backupFilePath = resolvePathUnderRoot(this.config.backupdirectory, [mcServer.serverinfo.servername, 'serverstatus.json'])
                    try {
                        if (!backupExamDir || !backupFilePath) {
                            log.error('ipchandler @ setServerStatus: unsafe backup path')
                        } else {
                            await fs.promises.mkdir(backupExamDir, { recursive: true })
                            await fs.promises.writeFile(backupFilePath, jsonString)
                        }
                    } catch (backupErr) {
                        log.error('ipchandler @ setServerStatus: backup mirror failed', backupErr)
                    }
                }
            } catch (error) {
                log.error(`ipchandler @ setServerStatus: ${error}`)
                return { sender: 'server', message: 'could not save serverstatus to disc', status: 'error' }
            }
            return { sender: 'server', message: t('general.ok'), status: 'success' }
        })

        /** Merges flags into student.status for one token or all; sendexam+sendlog; fetchfiles+files queues client download; msofficeshare; restorefocus; print/group/kick/materials; spellcheck if activatePrivateSpellcheck key present; may remove kicked student after timestamp gate. */
        ipcMain.handle('setStudentStatus', (_event, payload) => {
            const p = payload || {}
            const servername = p.servername
            const studenttoken = p.studenttoken
            if (typeof servername !== 'string' || !servername) {
                return { sender: 'server', message: t('control.notfound'), status: 'error' }
            }
            const mcServer = this.config.examServerList[servername]
            if (!mcServer) {
                return { sender: 'server', message: t('control.notfound'), status: 'error' }
            }
            const printdenied = p.printdenied
            const delfolder = p.delfolder
            const activatePrivateSpellcheck = p.activatePrivateSpellcheck
            const activatePrivateSuggestions = p.activatePrivateSuggestions
            const removeprintrequest = p.removeprintrequest
            const group = p.group
            const kicked = p.kick
            const msofficeshare = p.msofficeshare
            const getmaterials = p.getmaterials
            const sendlog = p.sendlog
            const sendexam = p.sendexam
            const fetchfiles = p.fetchfiles
            const filesPayload = p.files

            if (studenttoken === 'all') {
                for (const student of mcServer.studentList) {
                    if (sendexam) {
                        student.status.sendexam = true
                    }
                    if (sendlog) {
                        student.status.sendlog = true
                    }
                    if (fetchfiles && filesPayload !== undefined) {
                        student.status.fetchfiles = true
                        student.status.files = filesPayload
                    }
                    if (delfolder) {
                        student.status.delfolder = true
                    }
                    if (group) {
                        student.status.group = group
                    }
                    if (typeof msofficeshare !== 'undefined') {
                        student.status.msofficeshare = msofficeshare
                    }
                    if (getmaterials) {
                        student.status.getmaterials = true
                    }
                }
            } else {
                const student = mcServer.studentList.find((element) => element.token === studenttoken)
                if (student) {
                    if (sendexam) {
                        student.status.sendexam = true
                    }
                    if (sendlog) {
                        student.status.sendlog = true
                    }
                    if (fetchfiles && filesPayload !== undefined) {
                        student.status.fetchfiles = true
                        student.status.files = filesPayload
                    }
                    if (p.restorefocusstate === true) {
                        student.status.restorefocusstate = true
                    }
                    if (printdenied) {
                        student.status.printdenied = true
                        student.printrequest = false
                    }
                    if (delfolder) {
                        student.status.delfolder = true
                    }
                    if (Object.prototype.hasOwnProperty.call(p, 'activatePrivateSpellcheck')) {
                        if (activatePrivateSpellcheck) {
                            student.status.activatePrivateSpellcheck = true
                            student.status.activatePrivateSuggestions = activatePrivateSuggestions
                        } else {
                            student.status.activatePrivateSpellcheck = false
                            student.status.activateSuggestions = false
                        }
                    }
                    if (removeprintrequest === true) {
                        student.printrequest = false
                    }
                    if (group) {
                        student.status.group = group
                    }
                    if (typeof msofficeshare !== 'undefined') {
                        student.status.msofficeshare = msofficeshare
                    }
                    if (kicked) {
                        student.status.kicked = true
                    }
                    if (getmaterials) {
                        student.status.getmaterials = true
                    }
                    const now = Date.now()
                    if (now - 20000 > student.timestamp && student.status.kicked) {
                        mcServer.studentList = mcServer.studentList.filter((el) => el.token !== studenttoken)
                    }
                }
            }
            return {
                sender: 'server',
                message: (sendexam || fetchfiles) ? t('control.examrequest') : t('control.studentupdate'),
                status: 'success',
            }
        })

        /** Returns pin, servertoken, server ip, and id for a running exam server (wrapped in status/data) or an error when that server is not loaded. */
        ipcMain.handle('getServerInfoForDashboard', (_event, servername) => {
            const mcServer = this.config.examServerList[servername]
            if (!mcServer) {
                return { sender: 'server', message: 'server not found', status: 'error' }
            }
            return {
                sender: 'server',
                message: 'success',
                status: 'success',
                data: {
                    pin: mcServer.serverinfo.pin,
                    servertoken: mcServer.serverinfo.servertoken,
                    serverip: mcServer.serverinfo.ip,
                    id: mcServer.serverinfo.id,
                },
            }
        })


        /** Creates and registers a new multiCastserver for servername with a random PIN (fixed 1111 in development), optional exam password and BiP flags, and ensures the per-server workdir folder exists. */
        ipcMain.handle('startExamServer', async (_event, payload) => {
            try {
                const { servername: rawName, passwd: examPasswd, bip, bipId } = payload || {}
                const servername = typeof rawName === 'string' ? rawName.trim().toLowerCase() : ''
                if (!servername) {
                    return { sender: 'server', message: t('control.notfound'), status: 'error' }
                }
                const mcExisting = this.config.examServerList[servername]
                if (mcExisting) {
                    return { sender: 'server', message: t('control.serverexists'), status: 'error' }
                }
                for (const exam of this.multicastClient.examServerList) {
                    if (servername === exam.servername) {
                        return { sender: 'server', message: t('control.serverexistsLAN'), status: 'error' }
                    }
                }
                let pin = String(Math.floor(Math.random() * 9000) + 1000)
                if (this.config.development) { pin = '1111' }
                log.info(`ipchandler @ startExamServer: Initializing new Exam Server: ${servername}`)
                const mcs = new multiCastserver()
                const pwd = typeof examPasswd === 'string' && examPasswd ? examPasswd : ''
                if (!pwd) {
                    mcs.init(servername, pin, '', bip, bipId)
                } else {
                    mcs.init(servername, pin, pwd, bip, bipId)
                }
                this.config.examServerList[servername] = mcs
                const serverinstancedir = join(this.config.workdirectory, servername)
                try {
                    await fs.promises.mkdir(serverinstancedir, { recursive: true })
                } catch (_err) {
                    // Directory might already exist
                }
                return { sender: 'server', message: t('control.serverstarted'), status: 'success' }
            } catch (err) {
                log.error('ipchandler @ startExamServer:', err)
                return { sender: 'server', message: String(err && err.message ? err.message : err), status: 'error' }
            }
        })


        /** Stops broadcast interval and HTTPS listener for the exam server, removes it from examServerList and from the multicast client LAN server list. */
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
        ipcMain.handle('qemu-check-available', async (_event, opts = {}) => {
            const quick = opts?.deep === false || opts?.quick === true;
            log.info(`ipchandler @ qemu-check-available: start quick=${quick} opts=${JSON.stringify(opts || {})}`);
            try {
                const res = await checkQemuAvailability(opts);
                log.info(`ipchandler @ qemu-check-available: ok=${res.ok} missing=${(res.missing || []).join(',') || '-'}`);
                return res;
            } catch (e) {
                log.error('ipchandler @ qemu-check-available', e)
                const install = getQemuInstallInfo()
                return {
                    ok: false,
                    missing: ['qemu-system-x86_64', 'qemu-img'],
                    downloadUrl: install.downloadUrl,
                    installHint: install.installHint,
                }
            }
        })

        ipcMain.handle('qemu-open-install-page', async () => {
            try {
                const { downloadUrl } = getQemuInstallInfo()
                await shell.openExternal(downloadUrl)
                return { ok: true }
            } catch (e) {
                log.error('ipchandler @ qemu-open-install-page', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })

        ipcMain.handle('qemu-check-hypervisor-platform', async () => {
            try {
                return await getWindowsHypervisorPlatformState()
            } catch (e) {
                log.error('ipchandler @ qemu-check-hypervisor-platform', e)
                return { supported: false, enabled: false, state: 'error' }
            }
        })

        ipcMain.handle('qemu-request-enable-hypervisor-platform', async () => {
            try {
                return requestEnableWindowsHypervisorPlatform()
            } catch (e) {
                log.error('ipchandler @ qemu-request-enable-hypervisor-platform', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })

        ipcMain.handle('qemu-list-disks', async () => {
            log.info(`ipchandler @ qemu-list-disks: workdirectory=${config.workdirectory}`);
            try {
                const disks = await qemuService.listDisks({ workdirectory: config.workdirectory });
                log.info(`ipchandler @ qemu-list-disks: returning ${disks.length} name(s)`);
                return disks;
            } catch (e) {
                log.error('ipchandler @ qemu-list-disks', e)
                return []
            }
        })

        ipcMain.handle('qemu-install-default', async () => {
            try {
                const avail = await checkQemuAvailability()
                if (!avail.ok) {
                    log.warn('ipchandler @ qemu-install-default: QEMU not available', avail.missing)
                    return { ok: false, qemuMissing: true, missing: avail.missing }
                }
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
            const { qcow2Name, useOverlay } = payload || {};
            log.info(`ipchandler @ qemu-boot-disk: qcow2=${qcow2Name} useOverlay=${!!useOverlay}`);
            try {
                log.info('ipchandler @ qemu-boot-disk: deep QEMU check…');
                const avail = await checkQemuAvailability();
                if (!avail.ok) {
                    log.warn('ipchandler @ qemu-boot-disk: QEMU not available', avail.missing)
                    return { ok: false, qemuMissing: true, missing: avail.missing }
                }
                return await qemuService.bootDisk({
                    workdirectory: config.workdirectory,
                    qcow2Name,
                    useOverlay: useOverlay === true,
                })
            } catch (e) {
                log.error('ipchandler @ qemu-boot-disk', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })

        ipcMain.handle('qemu-pick-disk-file', async () => {
            log.info('ipchandler @ qemu-pick-disk-file: opening file dialog…');
            try {
                const result = await dialog.showOpenDialog(this.WindowHandler.mainwindow, {
                    properties: ['openFile'],
                    filters: [{ name: 'QEMU Disk', extensions: ['qcow2'] }],
                })
                if (result.canceled || !result.filePaths || !result.filePaths[0]) {
                    log.info('ipchandler @ qemu-pick-disk-file: cancelled');
                    return { ok: false, cancelled: true }
                }
                log.info(`ipchandler @ qemu-pick-disk-file: selected ${result.filePaths[0]}`);
                return { ok: true, sourcePath: result.filePaths[0] }
            } catch (e) {
                log.error('ipchandler @ qemu-pick-disk-file', e)
                return { ok: false, error: String(e?.message || e) }
            }
        })

        ipcMain.handle('qemu-import-disk', async (event, payload = {}) => {
            try {
                const { sourcePath } = payload || {}
                if (!sourcePath) {
                    log.warn('ipchandler @ qemu-import-disk: missing sourcePath');
                    return { ok: false, error: 'invalid sourcePath' }
                }
                log.info(`ipchandler @ qemu-import-disk: import ${sourcePath}`);
                const sendProgress = (p) => {
                    try { event.sender?.send?.('qemu-import-progress', p); } catch (e) {}
                };
                const res = await qemuService.importDisk({
                    workdirectory: config.workdirectory,
                    sourcePath,
                    onProgress: sendProgress,
                });
                log.info(`ipchandler @ qemu-import-disk: done ok=${res.ok} filename=${res.filename} skipped=${!!res.skipped} linked=${!!res.linked}`);
                return res;
            } catch (e) {
                log.error('ipchandler @ qemu-import-disk', e)
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

        /** Deletes file/dir under workdir/<servername>. Called from teacher/src/utils/filemanager.js fdelete (explorer delete confirm). */
        ipcMain.handle('deleteWorkdirItem', async (_event, payload = {}) => {
            const servername = payload?.servername
            const filepath = payload?.filepath
            if (!servername || typeof filepath !== 'string' || !filepath.trim()) {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            const mcServer = this.config.examServerList[servername]
            if (!mcServer) {
                return { status: 'error', sender: 'server', message: t('data.tokennotvalid') }
            }
            const examRoot = path.resolve(path.join(this.config.workdirectory, mcServer.serverinfo.servername))
            const absTarget = path.resolve(filepath)
            const rel = path.relative(examRoot, absTarget)
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
                log.warn(`ipchandler @ deleteWorkdirItem: path outside exam root (${filepath})`)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            try {
                const stats = await fs.promises.stat(absTarget)
                if (stats.isDirectory()) {
                    await fs.promises.rm(absTarget, { recursive: true, force: true })
                } else {
                    await fs.promises.unlink(absTarget)
                }
                return { status: 'success', sender: 'server', message: t('data.fdeleted') }
            } catch (err) {
                log.error('ipchandler @ deleteWorkdirItem:', err)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
        })

        /** Dashboard explorer: download one file or zip a folder. Called from teacher/src/utils/filemanager.js downloadFile. */
        ipcMain.handle('workdownloadExplorerItem', async (_event, payload = {}) => {
            const servername = payload?.servername
            const servertoken = payload?.servertoken
            const type = payload?.type
            const filename = payload?.filename
            const filepath = payload?.path ?? payload?.filepath
            const mcServer = this.config.examServerList[servername]
            if (!mcServer || servertoken !== mcServer.serverinfo?.servertoken) {
                return { status: 'error', sender: 'server', message: t('data.tokennotvalid') }
            }
            if (!filepath || typeof filepath !== 'string') {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            const examRoot = path.resolve(path.join(this.config.workdirectory, mcServer.serverinfo.servername))
            const absTarget = path.resolve(filepath)
            const rel = path.relative(examRoot, absTarget)
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
                log.warn(`ipchandler @ workdownloadExplorerItem: path outside exam root (${filepath})`)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            try {
                if (type === 'file') {
                    const raw = await fs.promises.readFile(absTarget)
                    const out = decryptBufferIfNeeded(raw, mcServer, 'ipchandler @ workdownloadExplorerItem')
                    return { status: 'success', sender: 'server', data: out }
                }
                if (type === 'dir') {
                    const base = path.basename(String(filename ?? 'export').trim() || 'export')
                    const zipSegment = base.toLowerCase().endsWith('.zip') ? base : `${base}.zip`
                    if (!isSafePathSegment(zipSegment)) {
                        return { status: 'error', sender: 'server', message: t('data.fileerror') }
                    }
                    const zipfilepath = resolvePathUnderRoot(this.config.tempdirectory, [zipSegment])
                    if (!zipfilepath) {
                        return { status: 'error', sender: 'server', message: t('data.fileerror') }
                    }
                    await zipExplorerDirectory(absTarget, zipfilepath)
                    const zipBuf = await fs.promises.readFile(zipfilepath)
                    try {
                        await fs.promises.unlink(zipfilepath)
                    } catch (e) {
                        /* ignore */
                    }
                    return { status: 'success', sender: 'server', data: zipBuf }
                }
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            } catch (err) {
                log.error('ipchandler @ workdownloadExplorerItem:', err)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
        })


        /** Teacher UPLOADS + student fetchfiles flags. Called from teacher/src/utils/exammanagement.js sendFiles (swal file picker). */
        ipcMain.handle('uploadTeacherFiles', async (_event, payload = {}) => {
            const servername = payload?.servername
            const servertoken = payload?.servertoken
            const studenttoken = payload?.who ?? payload?.studenttoken
            const fileItems = payload?.files
            const mcServer = this.config.examServerList[servername]
            if (!mcServer || servertoken !== mcServer.serverinfo?.servertoken) {
                return { status: 'error', sender: 'server', message: t('data.tokennotvalid') }
            }
            if (!Array.isArray(fileItems) || fileItems.length === 0) {
                return { status: 'error', sender: 'server', message: 'No files uploaded' }
            }
            let uploaddirectory = resolvePathUnderRoot(this.config.workdirectory, [mcServer.serverinfo.servername, 'UPLOADS'])
            try {
                if (!uploaddirectory) {
                    log.error('ipchandler @ uploadTeacherFiles: unsafe UPLOADS path')
                    return { status: 'error', sender: 'server', message: 'Invalid path' }
                }
                await fs.promises.mkdir(uploaddirectory, { recursive: true })
            } catch (err) {
                /* directory may already exist */
            }
            const storedFiles = []
            for (const item of fileItems) {
                const rawName = item?.name ?? 'upload'
                let filename = path.basename(decodeURIComponent(rawName))
                if (!isSafePathSegment(filename)) {
                    log.error(`ipchandler @ uploadTeacherFiles: rejected unsafe upload name (${rawName})`)
                    continue
                }
                const absoluteFilepath = resolvePathUnderRoot(uploaddirectory, [filename])
                if (!absoluteFilepath) {
                    log.error(`ipchandler @ uploadTeacherFiles: rejected path for (${filename})`)
                    continue
                }
                const data = item?.data
                const buf = Buffer.isBuffer(data) ? data : Buffer.from(data ?? [])
                try {
                    await fs.promises.writeFile(absoluteFilepath, buf)
                    storedFiles.push({ name: filename, path: absoluteFilepath })
                } catch (e) {
                    log.error('ipchandler @ uploadTeacherFiles: write failed', e)
                }
            }
            const files = storedFiles
            if (studenttoken === 'all') {
                for (const student of mcServer.studentList) {
                    student.status['fetchfiles'] = true
                    student.status['files'] = files
                }
            } else if (studenttoken === 'a' || studenttoken === 'b') {
                let groupArray = []
                if (studenttoken === 'a') {
                    groupArray = mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupA.users
                }
                if (studenttoken === 'b') {
                    groupArray = mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupB.users
                }
                if (groupArray.length > 0) {
                    for (const name of groupArray) {
                        const student = mcServer.studentList.find((element) => element.clientname === name)
                        if (student) {
                            student.status['fetchfiles'] = true
                            student.status['files'] = files
                        }
                    }
                } else {
                    return { status: 'error', sender: 'server', message: 'No students found' }
                }
            } else {
                const student = mcServer.studentList.find((element) => element.token === studenttoken)
                if (student) {
                    student.status['fetchfiles'] = true
                    student.status['files'] = files
                }
            }
            return { status: 'success', sender: 'server', message: 'Files uploaded' }
        })

        /** Lists workdir tree for dashboard explorer; called from teacher/src/utils/filemanager.js loadFilelist (explorer + refresh). */
        ipcMain.handle('listTeacherWorkdir', async (_event, payload = {}) => {
            const servername = payload?.servername
            const servertoken = payload?.servertoken
            const dirRaw = payload?.dir
            const mcServer = this.config.examServerList[servername]
            if (!mcServer || servertoken !== mcServer.serverinfo?.servertoken) {
                return { status: 'error', message: t('data.tokennotvalid') }
            }
            if (!dirRaw || typeof dirRaw !== 'string') {
                return { status: 'error', message: t('data.fileerror') }
            }
            const examRoot = path.resolve(path.join(this.config.workdirectory, mcServer.serverinfo.servername))
            const absDir = path.resolve(dirRaw)
            const rel = path.relative(examRoot, absDir)
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
                log.warn(`ipchandler @ listTeacherWorkdir: dir outside exam root (${dirRaw})`)
                return { status: 'error', message: t('data.fileerror') }
            }
            const folders = []
            folders.push({ currentdirectory: absDir, parentdirectory: path.dirname(absDir) })
            const omitExtensions = ['.json']
            try {
                const names = await fs.promises.readdir(absDir)
                for (const file of names) {
                    const filepath = path.join(absDir, file)
                    const ext = path.extname(file).toLowerCase()
                    const allowListedJson = ext === '.json' && file.endsWith('_editor_timeline.json')
                    try {
                        const stats = await fs.promises.stat(filepath)
                        if (stats.isDirectory()) {
                            folders.push({ path: filepath, name: file, type: 'dir', ext: '', parent: absDir })
                        } else if (stats.isFile() && (allowListedJson || !omitExtensions.includes(ext))) {
                            folders.push({ path: filepath, name: file, type: 'file', ext: ext, parent: absDir })
                        }
                    } catch (innerErr) {
                        log.error('ipchandler @ listTeacherWorkdir: stat failed', innerErr)
                    }
                }
            } catch (err) {
                log.error('ipchandler @ listTeacherWorkdir: readdir failed', err)
                return { status: 'error', message: t('data.fileerror') }
            }
            return { status: 'success', filelist: folders }
        })

        /** Teacher workdir read + NXE1 decrypt in main; called from teacher/src/utils/filemanager.js loadPDF, loadTextFile, loadImage. */
        ipcMain.handle('readTeacherWorkdirFile', async (_event, payload = {}) => {
            const servername = payload?.servername
            const servertoken = payload?.servertoken
            const filepath = payload?.filepath
            const mcServer = this.config.examServerList[servername]
            if (!mcServer || servertoken !== mcServer.serverinfo?.servertoken) {
                return { status: 'error', sender: 'server', message: t('data.tokennotvalid') }
            }
            if (!filepath || typeof filepath !== 'string') {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            const examRoot = path.resolve(path.join(this.config.workdirectory, mcServer.serverinfo.servername))
            const absTarget = path.resolve(filepath)
            const rel = path.relative(examRoot, absTarget)
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
                log.warn(`ipchandler @ readTeacherWorkdirFile: path outside exam root (${filepath})`)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            try {
                const raw = await fs.promises.readFile(absTarget)
                const out = decryptBufferIfNeeded(raw, mcServer, 'ipchandler @ readTeacherWorkdirFile')
                return { status: 'success', sender: 'server', data: out }
            } catch (err) {
                if (err && err.code === 'ENOENT') {
                    return { status: 'error', sender: 'server', message: t('data.fileerror'), code: 'ENOENT' }
                }
                log.error('ipchandler @ readTeacherWorkdirFile:', err)
                return { status: 'error', sender: 'server', message: t('data.fileerror'), code: err?.code }
            }
        })

        /** Active Sheets correction template: JSON in .htm under workdir/<server>/activesheets/<pdfStem>_korrekturvorlage.htm */
        ipcMain.handle('saveActivesheetsCorrectionTemplate', async (_event, payload = {}) => {
            const servername = payload?.servername
            const servertoken = payload?.servertoken
            const sourcePdfFilename = payload?.sourcePdfFilename
            const formData = payload?.formData
            const mcServer = this.config.examServerList[servername]
            if (!mcServer || servertoken !== mcServer.serverinfo?.servertoken) {
                return { status: 'error', sender: 'server', message: t('data.tokennotvalid') }
            }
            if (!formData || typeof formData !== 'object') {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            const pdfBase = path.basename(String(sourcePdfFilename || formData.filename || 'unknown.pdf').trim()) || 'unknown.pdf'
            const stem = path.basename(pdfBase, path.extname(pdfBase)) || 'unknown'
            const safeStem = stem.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120) || 'unknown'
            const htmName = `${safeStem}_korrekturvorlage.htm`
            if (!isSafePathSegment(htmName)) {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            const absTarget = resolvePathUnderRoot(this.config.workdirectory, [
                mcServer.serverinfo.servername,
                'activesheets',
                htmName,
            ])
            if (!absTarget) {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            try {
                await fs.promises.mkdir(path.dirname(absTarget), { recursive: true })
                const jsonData = JSON.stringify(formData, null, 2)
                await fs.promises.writeFile(absTarget, jsonData, 'utf8')
                const examRoot = path.resolve(path.join(this.config.workdirectory, mcServer.serverinfo.servername))
                const relativePath = path.relative(examRoot, absTarget)
                log.info(`ipchandler @ saveActivesheetsCorrectionTemplate: wrote ${relativePath}`)
                return {
                    status: 'success',
                    sender: 'server',
                    filename: htmName,
                    relativePath: relativePath.split(path.sep).join('/'),
                    filepath: absTarget,
                }
            } catch (err) {
                log.error('ipchandler @ saveActivesheetsCorrectionTemplate:', err)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
        })

        /** Captures visible teacher window as PDF (activesheets correction save). */
        ipcMain.handle('captureTeacherPreviewPdf', async () => {
            const wc = this.WindowHandler?.mainwindow?.webContents
            if (!wc) {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            try {
                const data = await wc.printToPDF({
                    printBackground: true,
                    pageSize: 'A4',
                    landscape: false,
                    margins: { top: 0, right: 0, bottom: 0, left: 0 },
                })
                return { status: 'success', sender: 'server', base64pdf: Buffer.from(data).toString('base64') }
            } catch (err) {
                log.error('ipchandler @ captureTeacherPreviewPdf:', err)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
        })

        /** Overwrites a student ABGABE submission PDF from teacher correction preview. */
        ipcMain.handle('overwriteTeacherAbgabePdf', async (_event, payload = {}) => {
            const servername = payload?.servername
            const servertoken = payload?.servertoken
            const filepath = payload?.filepath
            const base64pdf = payload?.base64pdf
            const mcServer = this.config.examServerList[servername]
            if (!mcServer || servertoken !== mcServer.serverinfo?.servertoken) {
                return { status: 'error', sender: 'server', message: t('data.tokennotvalid') }
            }
            if (!filepath || typeof filepath !== 'string' || typeof base64pdf !== 'string') {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            const examRoot = path.resolve(path.join(this.config.workdirectory, mcServer.serverinfo.servername))
            const absTarget = path.resolve(filepath)
            const rel = path.relative(examRoot, absTarget).replace(/\\/g, '/')
            if (rel.startsWith('..') || path.isAbsolute(rel) || !rel.includes('ABGABE/')) {
                log.warn(`ipchandler @ overwriteTeacherAbgabePdf: rejected path (${filepath})`)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            try {
                const pdfBuffer = Buffer.from(base64pdf, 'base64')
                await fs.promises.writeFile(absTarget, pdfBuffer)
                return { status: 'success', sender: 'server', filepath: absTarget }
            } catch (err) {
                log.error('ipchandler @ overwriteTeacherAbgabePdf:', err)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
        })

        /** Writes UTF-8 JSON from trusted teacher renderer; basename must end with _editor_timeline.json. */
        ipcMain.handle('writeTeacherWorkdirUtf8File', async (_event, payload = {}) => {
            const servername = payload?.servername
            const filepath = payload?.filepath
            const utf8 = payload?.utf8
            const mcServer = this.config.examServerList[servername]
            if (!mcServer) {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            if (!filepath || typeof filepath !== 'string' || typeof utf8 !== 'string') {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            const base = path.basename(filepath)
            if (!base.endsWith('_editor_timeline.json')) {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            const absTarget = path.resolve(filepath)
            try {
                await fs.promises.mkdir(path.dirname(absTarget), { recursive: true })
                await fs.promises.writeFile(absTarget, utf8, 'utf8')
                return { status: 'success', sender: 'server', message: 'ok' }
            } catch (err) {
                log.error('ipchandler @ writeTeacherWorkdirUtf8File:', err)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
        })

        /** Builds index.pdf + merged combined.pdf from submission paths; called from teacher/src/utils/filemanager.js getLatest. */
        ipcMain.handle('buildTeacherCombinedLatestPdf', async (_event, payload = {}) => {
            const servername = payload?.servername
            const servertoken = payload?.servertoken
            const submissions = payload?.submissions
            const mcServer = this.config.examServerList[servername]
            if (!mcServer || servertoken !== mcServer.serverinfo?.servertoken) {
                return { status: 'error', sender: 'server', message: t('data.tokennotvalid') }
            }
            if (!Array.isArray(submissions)) {
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
            try {
                const result = await buildTeacherCombinedLatestPdf({
                    workdirectory: this.config.workdirectory,
                    backupdirectory: this.config.backupdirectory,
                    mcServer,
                    submissions,
                })
                return { status: 'success', sender: 'server', ...result }
            } catch (err) {
                log.error('ipchandler @ buildTeacherCombinedLatestPdf:', err)
                return { status: 'error', sender: 'server', message: t('data.fileerror') }
            }
        })


        /** Get Specific Submission by filepath as base64 string */
        ipcMain.handle('getSpecificSubmissionBase64', async (event, filepath) => {
            try {
                if (!/\.pdf$/i.test(String(filepath || ''))) {
                    return { submission: false, status: 'error', message: 'not a pdf' }
                }
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

        ipcMain.handle('submissionPdfHasSignature', (_event, { pdfBase64 } = {}) => {
            try {
                const buf = Buffer.from(String(pdfBase64 || ''), 'base64')
                return { hasSignature: pdfHasEmbeddedSignature(buf) }
            } catch (e) {
                log.error('ipchandler @ submissionPdfHasSignature', e)
                return { hasSignature: false }
            }
        })

        ipcMain.handle('verifySubmissionPdfIntegrity', (_event, { pdfBase64 } = {}) => {
            try {
                const buf = Buffer.from(String(pdfBase64 || ''), 'base64')
                const result = verifySubmissionPdfIntegrity(buf)
                return {
                    ok: !!result.integrityValid,
                    code: result.code,
                    hasSignature: result.hasSignature,
                    integrityValid: result.integrityValid,
                    signMode: result.signMode,
                    verifyError: result.verifyError || null,
                }
            } catch (e) {
                log.error('ipchandler @ verifySubmissionPdfIntegrity', e)
                return { ok: false, code: 'ERROR', verifyError: String(e?.message || e) }
            }
        })

        ipcMain.handle('verifySubmissionPdfViaBip', async (_event, { pdfBase64, biptest } = {}) => {
            try {
                const buf = Buffer.from(String(pdfBase64 || ''), 'base64')
                const pre = verifySubmissionPdfIntegrity(buf)
                if (!pre.hasSignature) {
                    return { ok: false, ...pre, code: 'NO_SIGNATURE' }
                }
                if (pre.signMode !== SUBMISSION_SIGN_MODE_BIP) {
                    return { ok: false, ...pre, code: 'NOT_BIP_SIGNED' }
                }
                const rawToken = await this.WindowHandler.waitForBipAuthToken(!!biptest)
                const wstoken = decodeBipWstoken(rawToken)
                if (!wstoken) {
                    return { ok: false, code: 'BIP_TOKEN_INVALID', verifyError: 'invalid bip token' }
                }
                const baseUrl = this.WindowHandler.getBiPUrl(!!biptest)
                const site = await fetchBipSiteInfo({ baseUrl, wstoken })
                const key = String(site?.userprivateaccesskey ?? '').trim()
                if (!key) {
                    return { ok: false, code: 'BIP_SECRET_MISSING', verifyError: 'no userprivateaccesskey' }
                }
                const result = verifySubmissionPdfBipIdentity(buf, key)
                return {
                    ok: !!result.ok,
                    code: result.code,
                    hasSignature: result.hasSignature,
                    integrityValid: result.integrityValid,
                    signMode: result.signMode,
                    bipIdentityValid: result.bipIdentityValid,
                    bipUserIdInCert: result.bipUserIdInCert ?? null,
                    verifyError: result.verifyError || null,
                }
            } catch (e) {
                log.error('ipchandler @ verifySubmissionPdfViaBip', e)
                const msg = String(e?.message || e)
                const bipFlowCodes = new Set(['BIP_AUTH_CANCELLED', 'BIP_AUTH_PENDING', 'BIP_LOGIN_TIMEOUT'])
                if (bipFlowCodes.has(msg)) {
                    return { ok: false, code: msg, verifyError: null }
                }
                return { ok: false, code: 'ERROR', verifyError: msg }
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
                                .filter((file) => /\.pdf$/i.test(file)) // ignore sidecar .htm form data

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
         * get latest student html backup (.htm) from specific student directory
         */
        ipcMain.handle('getLatestBakFile', async (event, servername, studentName) => {
            const mcServer = this.config.examServerList[servername]
            if (!mcServer) { return { sender: "server", message:"notfound", status: "error", filepath: false } }
            let latestBakFile = null
            let dir =  join( config.workdirectory, mcServer.serverinfo.servername, studentName);
    
            //check if directory exists
            if (!fs.existsSync(dir)) { return { sender: "server", message:"notfound", status: "error", filepath: false } }

            //in the student directroy there are several backup directories  that contain an htm backup /20251112_10_20_13/
            // the backup naming scheme is studentname.htm ... we only need the latest one that has the studentname as filename
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
            const latestBakFilepath = join(dir, latestBackupDirectory, studentName + '.htm')
            const latestBackupDirectoryPath = join(dir, latestBackupDirectory)
            
            //get latest htm backup  - check if file exists
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
                // Filter out bridge (br*) and vpn (vpn*) interfaces by name
                if (interfaceName.startsWith('br') || interfaceName.startsWith('vpn')) { return }
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


        ipcMain.handle('loadSEBConfig', async (event, configFile, password, bek) => {
            try {
                return await loadSEBConfig(configFile, password, bek);
            } catch (e) {
                console.error(e);
                return undefined;
            }
        });

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
