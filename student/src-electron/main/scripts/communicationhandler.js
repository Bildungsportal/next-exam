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
import crypto from 'node:crypto'
import {disableRestrictions, enableRestrictions} from './platformrestrictions.js';
import fs from 'fs' 
import archiver from 'archiver'   // causes severe race conditions with electron's own versions - always keep the same version as electron
import extract from 'extract-zip'
import { join } from 'path'
import { screen, ipcMain, app, BrowserWindow, webContents } from 'electron'
import WindowHandler from './windowhandler.js'
import IpcHandler from './ipchandler.js'
import log from 'electron-log';
import {SchedulerService} from './schedulerservice.ts'
import platformDispatcher from './platformDispatcher.js';
import { encryptExamFileBytes, isExamFileEncryptedBytes } from './examFileCrypto.js';
import { runRemoteCheck } from './remoteCheck.js'
import { logNetworkActiveProcesses, findNonLanguageToolOn8088 } from './networkActiveProcesses.js'
import { getVMFindings } from './vmDetection.js'
import { examApiFetch } from '../../../../shared/examApiFetch.js'
import languageToolServer from './lt-server.js';
import { setClientFocusLock, clearClientFocusLock } from './focusLockState.js';
import { syncClientDisplayInfo } from './displayInfo.js';
import { detectRunningInCage } from './cageDetect.js';
import qemuService from './qemuService.js';
import { checkQemuAvailability } from '../../../../shared/qemuAvailability.js';
import { resolveLocalVmDisplayResolution } from '../../../../shared/localVmDisplayResolutions.js';
import { stopProxy } from './vncproxy.js';
import { switchExamSection } from './switchExamSection.js';
import {
    buildLocalSubmissionSigningSecret,
    deriveSigningP12,
    signSubmissionPdf,
    SUBMISSION_SIGN_MODE_BIP,
    SUBMISSION_SIGN_MODE_LOCAL,
} from '../../../../shared/submissionPdfSign.js';



 /**
  * Handles information fetching from the server and acts on status updates
  */
 
 class CommHandler {
    constructor () {
        this.multicastClient = null
        this.config = null
        this.updateStudentIntervall = null
        this.WindowHandler = null
        this.timer = 0
        this.bipSiteInfo = null
        this.cachedSubmissionSigningP12 = null
    }
 
    init (mc, config) {
        this.multicastClient = mc
        this.config = config
        this.lastExamWriteSaveReason = 'n/a' // updated on successful examdir writes; sent with ZIP to teacher /receive
        this.localVmStartState = 'idle' // idle|starting|blocked
        this.updateScheduler = new SchedulerService(this.requestUpdate.bind(this), 5000)
        this.updateScheduler.start()
    }

    /** Exam lockdown: focus=false + kiosk refocus; optional reason/message for overlay (IPC focusLock). */
    applySecurityFocusLost(reason = 'unknown', message = '') {
        if (this.config.development) return;


        log.warn(`communicationhandler @ applySecurityFocusLost: forcing lockdown (reason=${reason})`);
        const ci = this.multicastClient?.clientinfo;
        if (ci) setClientFocusLock(ci, reason, message);
        const examWin = WindowHandler?.examwindow;
        if (examWin && !this.config?.development) {
            examWin.moveTop();
            examWin.setKiosk(true);
            examWin.show();
            examWin.focus();
        }
        if (examWin?.webContents && !examWin.webContents.isDestroyed()) {
            examWin.webContents.send('focusLock', { reason: reason || '', message: message || '' });
        }
    }

    // Encrypts all unencrypted files in the current examdirectory. 
    async encryptExamdirectoryFiles() {
        if (this.multicastClient?.clientinfo?.examtype === 'localvm') return;
        const pw = String(this.multicastClient?.serverstatus?.encryptionPassword ?? '').trim();
        if (!pw) return;
        const dir = this.config?.examdirectory;
        if (!dir) return;
        let dirents;
        try {
            dirents = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch (e) {
            log.error('communicationhandler @ encryptExamdirectoryFiles: readdir failed', e);
            return;
        }
        for (const d of dirents) {
            if (!d.isFile()) continue;
            const name = d.name;
            if (name === 'next-exam-student.log') continue;
            const abs = join(dir, name);
            let raw;
            try {
                raw = await fs.promises.readFile(abs);
            } catch (e) {
                continue;
            }
            if (isExamFileEncryptedBytes(raw)) continue;
            let out;
            try {
                out = encryptExamFileBytes(raw, pw);
            } catch (e) {
                log.error(`communicationhandler @ encryptExamdirectoryFiles: encrypt failed ${name}`, e);
                continue;
            }
            log.info(`communicationhandler @ encryptExamdirectoryFiles: encrypted write ${name}`);
            const tmp = `${abs}.encpart`;
            try {
                await fs.promises.writeFile(tmp, out);
                await fs.promises.rename(tmp, abs);
            } catch (e) {
                try { await fs.promises.unlink(tmp); } catch {}
            }
        }
    }

    // Tell student UI to show compat-check Swal before slow QEMU / disk probes.
    notifyLocalVmCompatCheckStart() {
        this.multicastClient.clientinfo.examtype = 'localvm';
        this.multicastClient.clientinfo.localVMState = 'checking_compat';
        try {
            WindowHandler.mainwindow?.webContents?.send('localvm-compat-check-start');
        } catch (e) {
            log.debug('communicationhandler @ notifyLocalVmCompatCheckStart: send failed', e?.message);
        }
    }

    // Dismiss compat-check Swal when leaving checking_compat (success, failure, or next preflight state).
    notifyLocalVmCompatCheckEnd() {
        if (this.multicastClient.clientinfo.localVMState === 'checking_compat') {
            this.multicastClient.clientinfo.localVMState = null;
        }
        try {
            WindowHandler.mainwindow?.webContents?.send('localvm-compat-check-end');
        } catch (e) {
            log.debug('communicationhandler @ notifyLocalVmCompatCheckEnd: send failed', e?.message);
        }
    }

    // Notify renderer and block LocalVM exam start when qemu-system-x86_64 / qemu-img are missing.
    async ensureQemuAvailableForLocalVm() {
        try {
            const check = await checkQemuAvailability();
            if (check.ok) {
                return true;
            }
            log.warn('communicationhandler @ ensureQemuAvailableForLocalVm: QEMU missing', check.missing);
            try {
                WindowHandler.mainwindow?.webContents?.send('qemu-not-available', {
                    missing: check.missing,
                    hypervisorPlatform: check.hypervisorPlatform,
                });
            } catch (e) {
                log.debug('communicationhandler @ ensureQemuAvailableForLocalVm: send failed', e?.message);
            }
            return false;
        } catch (e) {
            log.error('communicationhandler @ ensureQemuAvailableForLocalVm', e);
            try {
                WindowHandler.mainwindow?.webContents?.send('qemu-not-available', { missing: [] });
            } catch (err) {}
            return false;
        }
    }

    // SHA-256 of base qcow2 before QEMU start (full read while VM runs starves guest disk I/O).
    async runLocalVmPreStartVerify(qcow2Name, expectedSha256, expectedSizeBytes) {
        try {
            if (expectedSha256) {
                log.info(`communicationhandler @ runLocalVmPreStartVerify: sha256 before start for ${qcow2Name}`);
            } else {
                log.info(`communicationhandler @ runLocalVmPreStartVerify: size check before start for ${qcow2Name} (expectedBytes=${expectedSizeBytes})`);
            }
            const verify = expectedSha256
                ? await qemuService.verifyDiskSha256({
                    workdirectory: this.config.workdirectory,
                    qcow2Name,
                    expectedSha256,
                })
                : await qemuService.verifyDiskSize({
                    workdirectory: this.config.workdirectory,
                    qcow2Name,
                    expectedSizeBytes,
                });
            if (!verify.ok) {
                if (verify.error === 'disk not found') {
                    this.multicastClient.clientinfo.localVMHost = null;
                    this.multicastClient.clientinfo.localVMState = 'missing';
                } else {
                    this.multicastClient.clientinfo.localVMHost = null;
                    this.multicastClient.clientinfo.localVMState = 'error';
                }
                return { allowStart: false };
            }
            if (!verify.match) {
                const mismatch = expectedSha256 ? 'hash mismatch' : 'size mismatch';
                log.warn(`communicationhandler @ runLocalVmPreStartVerify: ${mismatch} for ${qcow2Name}`);
                this.multicastClient.clientinfo.localVMHost = null;
                this.multicastClient.clientinfo.localVMState = 'hash_mismatch';
                return { allowStart: false };
            }
            if (expectedSha256) {
                log.info(`communicationhandler @ runLocalVmPreStartVerify: hash OK for ${qcow2Name}`);
            } else {
                log.info(`communicationhandler @ runLocalVmPreStartVerify: size OK for ${qcow2Name} (actualBytes=${verify.actual}, expectedBytes=${expectedSizeBytes})`);
            }
            return { allowStart: true };
        } catch (e) {
            log.error('communicationhandler @ runLocalVmPreStartVerify', e);
            this.multicastClient.clientinfo.localVMHost = null;
            this.multicastClient.clientinfo.localVMState = 'error';
            return { allowStart: false };
        }
    }

    async preflightLocalVm(serverstatus, effectiveSection) {
        const examSection = serverstatus.examSections[effectiveSection];
        const hasGroups = !!examSection?.groups;
        let group = this.multicastClient.clientinfo.group || 'a';
        if (hasGroups) {
            const clientname = this.multicastClient.clientinfo.name;
            const groupA = examSection.groupA?.users ?? [];
            const groupB = examSection.groupB?.users ?? [];
            if (groupB.includes(clientname)) group = 'b';
            else if (groupA.includes(clientname)) group = 'a';
            else group = 'a';
        } else {
            group = 'a';
        }

        const vmConfig = group === 'b'
            ? (examSection?.groupB?.examConfig?.localvm || {})
            : (examSection?.groupA?.examConfig?.localvm || {});

        const qcow2Name = vmConfig.qcow2Name;
        const vncPort = Number(vmConfig.vncPort || 5901);
        const calculateSha256 = vmConfig.calculateSha256 === true;
        const expectedSha256 = calculateSha256 ? vmConfig.qcow2Sha256 : null;
        const expectedSizeBytes = !calculateSha256 ? vmConfig.qcow2SizeBytes : null;
        const blockInternet = !!vmConfig.blockInternet;
        const display = resolveLocalVmDisplayResolution(vmConfig.displayResolution);

        this.multicastClient.clientinfo.examtype = 'localvm';
        this.multicastClient.clientinfo.localVMHost = null;
        this.multicastClient.clientinfo.localVMPort = vncPort;
        this.notifyLocalVmCompatCheckEnd();

        log.info(`communicationhandler @ preflightLocalVm: cfg (disk=${qcow2Name || '-'}, port=${vncPort}, display=${display.id}, blockInternet=${blockInternet}, calcHash=${calculateSha256}, hasHash=${!!expectedSha256}, hasSize=${typeof expectedSizeBytes === 'number'})`);

        if (!qcow2Name) {
            this.multicastClient.clientinfo.localVMState = 'missing';
            return { allowStart: false };
        }
        if (calculateSha256 && !expectedSha256) {
            log.error('communicationhandler @ preflightLocalVm: calculateSha256 enabled but qcow2Sha256 missing');
            this.multicastClient.clientinfo.localVMState = 'error';
            return { allowStart: false };
        }
        if (!calculateSha256 && (typeof expectedSizeBytes !== 'number' || !Number.isFinite(expectedSizeBytes) || expectedSizeBytes <= 0)) {
            log.error('communicationhandler @ preflightLocalVm: calculateSha256 disabled but qcow2SizeBytes missing');
            this.multicastClient.clientinfo.localVMState = 'error';
            return { allowStart: false };
        }

        this.multicastClient.clientinfo.localVMState = 'verifying_hash';
        const verifyRes = await this.runLocalVmPreStartVerify(qcow2Name, expectedSha256, calculateSha256 ? null : Number(expectedSizeBytes));
        if (!verifyRes.allowStart) {
            return { allowStart: false };
        }

        return {
            allowStart: true,
            qcow2Name,
            vncPort,
            overlayName: `${qcow2Name}.overlay.${this.multicastClient.clientinfo.servername || 'exam'}.${this.multicastClient.clientinfo.pin || '0'}.qcow2`,
            blockInternet,
            displayWidth: display.width,
            displayHeight: display.height,
        };
    }

    



    async requestUpdate(){
        syncClientDisplayInfo(this.multicastClient.clientinfo);
        this.multicastClient.clientinfo.isRunningInCage =
            process.platform === 'linux' ? detectRunningInCage() : false;

        this.timer++   // we use timer to time loops with different intervals without introducing new unneccesary schedulers
        if (this.timer % 20 === 0 ){  // run every 20*5 (updateloop) seconds

            // run both detectors in parallel on the same tick:
            // (1) runRemoteCheck = static keyword/port match against appsToClose
            // (2) networkActiveProcesses = algorithmic detection of any network-active app
            // merge process names into one keywords list so the teacher also sees apps we don't know by name
            const [keywordHit, netScan, ltFakes] = await Promise.all([
                runRemoteCheck(process.platform),
                logNetworkActiveProcesses({ mode: 'both' }).catch((err) => {
                    log.warn(`communicationhandler @ requestUpdate: networkActiveProcesses scan failed: ${err.message}`);
                    return { processes: [] };
                }),
                findNonLanguageToolOn8088().catch((err) => {
                    log.warn(`communicationhandler @ requestUpdate: port 8088 check failed: ${err.message}`);
                    return [];
                }),
            ]);

            if (ltFakes.length) {
                const occupantSummary = ltFakes.map((o) => `${o.name}(pid=${o.pid})`).join(', ');
                log.warn(
                    `communicationhandler @ requestUpdate: non-LanguageTool listener on port 8088: ${occupantSummary}`
                );
                if (this.multicastClient.clientinfo.exammode ) {
                    this.applySecurityFocusLost('ltPort8088');
                }
                const ra = this.multicastClient.clientinfo.remoteassistant || { keywords: [], ports: [] };
                this.multicastClient.clientinfo.remoteassistant = { ...ra, languagetoolFake: true };
            } else if (this.multicastClient.clientinfo.remoteassistant?.languagetoolFake) {
                const ra = { ...this.multicastClient.clientinfo.remoteassistant };
                delete ra.languagetoolFake;
                if (!ra.keywords?.length && !ra.ports?.length) {
                    delete this.multicastClient.clientinfo.remoteassistant;
                } else {
                    this.multicastClient.clientinfo.remoteassistant = ra;
                }
            }

            const algorithmicNames = [...new Set(netScan.processes.map((p) => p.name))];
            const keywordHits = keywordHit ? keywordHit.keywords : [];
            const mergedKeywords = [...new Set([...keywordHits, ...algorithmicNames])];

            if (mergedKeywords.length || (keywordHit && keywordHit.ports.length)) {
                if (keywordHit) {
                    log.warn('main @ ready: Possible remote assistance detected');
                    for (const keyword of keywordHit.keywords) {
                        log.warn(`main @ ready: Keyword ${keyword} detected`);
                    }
                    for (const port of keywordHit.ports) {
                        log.warn(`main @ ready: Port ${port} detected`);
                    }
                }
                const ra = this.multicastClient.clientinfo.remoteassistant || { keywords: [], ports: [] };
                this.multicastClient.clientinfo.remoteassistant = {
                    ...ra,
                    keywords: mergedKeywords,
                    ports: keywordHit ? keywordHit.ports : (ra.ports || []),
                };
            }

        }

        if (this.multicastClient.clientinfo.localLockdown
            && (this.multicastClient.clientinfo.serverip === '127.0.0.1' || this.multicastClient.clientinfo.servername === 'localhost')) {
            return;
        }

        // connection lost reset triggered  no serversignal for 20 seconds
        if (this.multicastClient.beaconsLost >= 5 ){  
             if (!this.multicastClient.kicked){
                log.warn("communicationhandler @ requestUpdate: Connection to Teacher lost! Removing registration.") //remove server registration locally (same as 'kick')
                this.multicastClient.beaconsLost = 0
                this.resetConnection()   // this also resets serverip therefore no api calls are made afterwards
                this.killScreenlock()       // just in case screens are blocked.. let students work
            }
        }  

        if (this.multicastClient.clientinfo.serverip) {  //check if server connected - get ip
            if (this.multicastClient.clientinfo.virtualized && !this.multicastClient.clientinfo.vmFindings) {
                this.multicastClient.clientinfo.vmFindings = getVMFindings();
            }
            const bearer = this.multicastClient.clientinfo.token
            if (bearer) {
                let payload = {clientinfo: this.multicastClient.clientinfo}

                examApiFetch(`https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/update`, {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${bearer}`,
                    },
                    body: JSON.stringify(payload),
                })
                .then(response => {
                    if (!response.ok) { throw new Error('Network response was not ok'); }
                    return response.json();
                })
                .then(data => {
                    if (data.status === "error") {
                        if      (data.message === "notavailable"){ log.warn('communicationhandler @ requestUpdate: Exam Instance not found!');        this.multicastClient.beaconsLost = 5; }    // exam instance not available but server reachable
                        else if (data.message === "removed"){
                            log.warn('communicationhandler @ requestUpdate: Student registration not found!');
                            this.kickStudent()
                        }   // student got kicked - we handle this differently now. teacher stores "kicked" for student to collect. student is removed from server when collecting kicked info. student closes exam and cleans up.
                        else if (data.message === "authrequired") {
                            log.warn('communicationhandler @ requestUpdate: missing or invalid Authorization Bearer')
                            this.multicastClient.beaconsLost += 1
                        }
                        else {                                     log.warn(`communicationhandler @ requestUpdate: ${this.multicastClient.beaconsLost} Heartbeat lost..`);              this.multicastClient.beaconsLost += 1;}   // heartbeat lost server not reachable
                    } else if (data.status === "success") {
                        this.multicastClient.beaconsLost = 0; // This also counts as a successful heartbeat - keep connection alive
                        this.multicastClient.clientinfo.printrequest = false  //set this to false after the request left the client to prevent double triggering
                        const serverStatusDeepCopy = JSON.parse(JSON.stringify(data.serverstatus));
                        const studentStatusDeepCopy = JSON.parse(JSON.stringify(data.studentstatus));
                        this.processUpdatedServerstatus(serverStatusDeepCopy, studentStatusDeepCopy);// Process received data
                    }
                })
                .catch(error => {
                    this.multicastClient.beaconsLost += 1;
                    log.error(`communicationhandler @ requestUpdate: (${this.multicastClient.beaconsLost}) ${error}`);
                });
            }
        }
        else { // prevent focus warning block if no connection 
            this.multicastClient.clientinfo.focus = true  // if not connected but still in exam mode you could trigger a focus warning and nobody is able to unlock you
        }
    }



    async kickStudent(studentstatus){
        log.warn("communicationhandler @ kickStudent: Student got kicked by Teacher")
        this.multicastClient.kicked = false
        this.multicastClient.beaconsLost = 0
        let serverstatus = {delfolderonexit: false}  // do not delete folder on exit because student got kicked
        if (studentstatus && studentstatus.delfolder){ serverstatus.delfolderonexit = true}
        
        this.endExam(serverstatus)
        this.resetConnection() 
        return   //this ends here because we got kicked by the teacher
    }





    /**
     * react to server status 
     * this currently only handle startexam & endexam
     * could also handle kick, focusrestore, and even trigger file requests
     */
    async processUpdatedServerstatus(serverstatus, studentstatus){
        this.multicastClient.serverstatus = serverstatus;

        let kicked = false;
        try {
            kicked = await this.handleStudentStatusUpdates(studentstatus);
        } catch (e) {
            log.error('communicationhandler @ processUpdatedServerstatus: handleStudentStatusUpdates failed (continuing with server sync)', e);
        }
        if (kicked) {
            return;
        }

        this.handleExamSections(serverstatus);
        this.handleGlobalServerStatus(serverstatus);
    }

    async handleStudentStatusUpdates(studentstatus){
        if (!studentstatus || Object.keys(studentstatus).length === 0) {
            return false;
        }

        if (studentstatus.printdenied && WindowHandler.examwindow) {
            WindowHandler.examwindow.webContents.send('denied');
        }

        if (studentstatus.sendexam === true){
            await this.sendExamToTeacher();
        }
        if (studentstatus.sendlog === true){
            await this.sendStudentLogToTeacher();
        }

        if (studentstatus.kicked) {
            await this.kickStudent(studentstatus);
            return true;
        }

        if (studentstatus.delfolder === true){
            log.info("communicationhandler @ processUpdatedServerstatus: cleaning exam workfolder");
            let delfolder = true;
            try {
                if (fs.existsSync(this.config.examdirectory)){
                    fs.rmSync(this.config.examdirectory, { recursive: true });
                    fs.mkdirSync(this.config.examdirectory);
                }
            } catch (error) { 
                delfolder = false;
                if (WindowHandler.examwindow) {
                    WindowHandler.examwindow.webContents.send('fileerror', error);
                }
                log.error(`communicationhandler @ processUpdatedServerstatus: Can not delete directory - ${error} `);
            }

            if (delfolder === false){
                if (fs.existsSync(this.config.examdirectory)) {
                    const files = fs.readdirSync(this.config.examdirectory);

                    files.forEach(file => {
                        const filePath = join(this.config.examdirectory, file);
                        try {
                            const stats = fs.statSync(filePath);
                            if (stats.isDirectory()) { fs.rmSync(filePath, { recursive: true }); }
                            else { fs.unlinkSync(filePath); }
                        }
                        catch (error) {
                            log.error(`communicationhandler @ processUpdatedServerstatus: (delfolder) Error deleting file/directory: ${filePath}`, error);
                        }
                    });
                }
            }
            if (WindowHandler.examwindow) {
                WindowHandler.examwindow.webContents.send('loadfilelist');
            }
        }

        if (studentstatus.focus === false){
            this.multicastClient.clientinfo.focus = false;
        }

        if (studentstatus.restorefocusstate === true){
            log.info("communicationhandler @ processUpdatedServerstatus: restoring focus state for student");
            clearClientFocusLock(this.multicastClient.clientinfo);
            this.multicastClient.clientinfo.focus = true;
            if (WindowHandler.examwindow && !this.config.development){ 
                WindowHandler.examwindow.setKiosk(true);
                WindowHandler.examwindow.focus();
            }
        }
        if (studentstatus.activatePrivateSpellcheck === true && this.multicastClient.clientinfo.privateSpellcheck.activated === false){
            log.info("communicationhandler @ processUpdatedServerstatus: activating spellcheck for student");
            this.multicastClient.clientinfo.privateSpellcheck.activate = true;
            this.multicastClient.clientinfo.privateSpellcheck.activated = true;
            ipcMain.emit("startLanguageTool");
        }
        if (studentstatus.activatePrivateSpellcheck === false && this.multicastClient.clientinfo.privateSpellcheck.activated === true) {
            log.info("communicationhandler @ processUpdatedServerstatus: de-activating spellcheck for student");
            this.multicastClient.clientinfo.privateSpellcheck.activate = false;
            this.multicastClient.clientinfo.privateSpellcheck.activated = false;
        }

        this.multicastClient.clientinfo.privateSpellcheck.suggestions = studentstatus.activatePrivateSuggestions;

        if (studentstatus.fetchfiles === true){
            this.requestFileFromServer(studentstatus.files);
        }
        if (studentstatus.getmaterials === true){
            if (WindowHandler.examwindow){  
                WindowHandler.examwindow.webContents.send('getmaterials');
            }
        }
        
        this.multicastClient.clientinfo.msofficeshare = studentstatus.msofficeshare;
        
        if (studentstatus.group){
            if (this.multicastClient.clientinfo.group !== studentstatus.group){
                this.multicastClient.clientinfo.group = studentstatus.group;
                if (WindowHandler.examwindow){  
                    WindowHandler.examwindow.webContents.send('getmaterials');
                }
            }
        }

        return false;
    }

    handleExamSections(serverstatus){
        if (WindowHandler.examwindow){
            if (serverstatus.allowSectionSwitch !== WindowHandler.examwindow.serverstatus.allowSectionSwitch){
                log.info("communicationhandler @ processUpdatedServerstatus: permission to switch exam section changed");
                WindowHandler.examwindow.serverstatus.allowSectionSwitch = serverstatus.allowSectionSwitch;
            }
        }

        if (serverstatus.exammode && this.multicastClient.clientinfo.exammode){
            if (serverstatus.useExamSections){
                if (!serverstatus.allowSectionSwitch){
                    if (serverstatus.lockedSection !== this.multicastClient.clientinfo.lockedSection){
                        switchExamSection(this, serverstatus, serverstatus.lockedSection);
                    }
                }
            }
        }

        const sectionForSync = serverstatus.allowSectionSwitch ? this.multicastClient.clientinfo.lockedSection : serverstatus.lockedSection;
        const section = serverstatus.examSections[sectionForSync];
        if (section?.groups) {
            this.multicastClient.clientinfo.groups = true;
            const clientname = this.multicastClient.clientinfo.name;
            const groupA = section.groupA?.users ?? [];
            const groupB = section.groupB?.users ?? [];
            const prevGroup = this.multicastClient.clientinfo.group;
            if (groupB.includes(clientname)) this.multicastClient.clientinfo.group = 'b';
            else if (groupA.includes(clientname)) this.multicastClient.clientinfo.group = 'a';
            else this.multicastClient.clientinfo.group = 'a';
            if (this.multicastClient.clientinfo.group !== prevGroup && WindowHandler.examwindow) {
                WindowHandler.examwindow.webContents.send('getmaterials');
            }
        } else {
            this.multicastClient.clientinfo.groups = false;
        }
    }

    handleGlobalServerStatus(serverstatus){
        if (serverstatus.screenslocked && !this.multicastClient.clientinfo.screenlock) {
            this.activateScreenlock();
        } else if (!serverstatus.screenslocked ) {
            this.killScreenlock();
        }

        if (serverstatus.screenshotinterval || serverstatus.screenshotinterval === 0) {
            if (this.multicastClient.clientinfo.screenshotinterval !== serverstatus.screenshotinterval*1000 ) {
                log.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval changed to", serverstatus.screenshotinterval*1000);
                this.multicastClient.clientinfo.screenshotinterval = serverstatus.screenshotinterval*1000;
                if ( serverstatus.screenshotinterval == 0) {
                    log.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval disabled!");
                }
                try {
                    WindowHandler.mainwindow?.webContents?.send('screenshot-config', {
                        screenshotinterval: this.multicastClient.clientinfo.screenshotinterval,
                        serverip: this.multicastClient.clientinfo.serverip
                    });
                } catch (e) {
                    log.debug('communicationhandler @ processUpdatedServerstatus: screenshot-config send', e?.message);
                }
            }
        }
        
        if (serverstatus.exammode && !this.multicastClient.clientinfo.exammode){
            const lockedSection = Number(serverstatus.lockedSection || 1);
            const examtype = serverstatus?.examSections?.[lockedSection]?.examtype;
            if (examtype === 'localvm' && this.localVmStartState !== 'idle') {
                log.info(`communicationhandler @ processUpdatedServerstatus: localvm start suppressed (state=${this.localVmStartState})`);
                return;
            }
            log.info("communicationhandler @ processUpdatedServerstatus: exammode activated");
            this.killScreenlock();
            this.startExam(serverstatus);
        }
        else if (!serverstatus.exammode && this.multicastClient.clientinfo.exammode){
            log.info("communicationhandler @ processUpdatedServerstatus: exammode deactivated");
            this.killScreenlock();
            this.endExam(serverstatus);
        }

        if (!serverstatus.exammode && this.multicastClient.clientinfo.examtype === 'localvm') {
            const st = this.multicastClient.clientinfo.localVMState;
            const keepFixUi = st === 'missing' || st === 'hash_mismatch' || st === 'error';
            if (!keepFixUi && st) {
                log.info(`communicationhandler @ processUpdatedServerstatus: localvm exammode off -> clearing transient vm state (${st})`);
                this.multicastClient.clientinfo.localVMState = null;
                this.multicastClient.clientinfo.localVMHost = null;
            }
            if (this.localVmStartState !== 'idle') {
                this.localVmStartState = 'idle';
            }
        }
    }














    // send base64 pdf to teacher
    sendBase64PDFtoTeacher(base64pdf, section=1, saveReason='sectionchange'){
        const url = `https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/submission/${this.multicastClient.clientinfo.servername}`;
        const sr = typeof saveReason === 'string' ? saveReason : 'sectionchange'
        const payload = {
            document: base64pdf,
            printrequest: false,
            submissionnumber: this.multicastClient.clientinfo.submissionnumber,
            lockedsection: section,
            saveReason: sr
        }
        examApiFetch(url, {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.multicastClient.clientinfo.token}` },
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
    // ATTENTION: there is a similar method in ipchandler.js that also generates a pdf but stores it as file in the exam directory
    async getBase64PDF(submissionnumber, sectionname, printBackground=false, saveReason){
        if (saveReason !== 'auto') log.info("communicationhandler @ getBase64PDF: getting base64 encoded pdf")
        const traceTiming = saveReason === 'previewSigned' || saveReason === 'directsend'
        const t0 = traceTiming ? Date.now() : 0

        // Wait for any ongoing print operation to finish (max 30 seconds)
        let waitCount = 0;
        const maxWait = 300; // 30 seconds with 100ms intervals
        while (IpcHandler.isPrintingPdf && waitCount < maxWait) {
            await this.sleep(100);
            waitCount++;
        }
        if (traceTiming && waitCount > 0) {
            log.info(`communicationhandler @ getBase64PDF: waited ${waitCount * 100}ms for printpdf lock (${saveReason})`)
        }

        if (IpcHandler.isPrintingPdf) {
            log.error("communicationhandler @ getBase64PDF: printToPDF lock timeout - another print operation is still running");
            return { sender: "client", message: "PDF generation timeout - another print operation is in progress", status: "error" };
        }

        const signReasons = new Set(['submit', 'directsend', 'submitexam', 'previewSigned'])
        const isSigningExport = signReasons.has(saveReason)
        const headerTemplate = `<div style='display: inline-block; height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-left: 30px; margin-top:10px;'><span style="float:left;">${this.multicastClient.clientinfo.servername}</span><span style="float:left;">&nbsp;|&nbsp; </span><span style="float:left;">${sectionname}</span><span style="float:left;">&nbsp;|&nbsp; </span><span class=date style="float:left;"></span><span style="float:left;">&nbsp;|&nbsp;Abgabe: ${submissionnumber}</span><span style="float:right;">${this.multicastClient.clientinfo.name}</span></div>`
        const footerTemplatePageNums = "<div style='height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-bottom:10px;'><span class=pageNumber></span>|<span class=totalPages></span></div>"
        
        var options = {
            margins: { top: 0.5, right: 0, bottom: isSigningExport ? 0 : 0.5, left: 0 },
            pageSize: 'A4',
            printBackground: isSigningExport ? false : printBackground,
            printSelectionOnly: false,
            landscape: false,
            displayHeaderFooter: true,
            footerTemplate: isSigningExport ? '<div></div>' : footerTemplatePageNums,
            headerTemplate,
            preferCSSPageSize: false
        }
        
        // set the title of the exam window and therefore the document title
        await WindowHandler.examwindow.webContents.executeJavaScript(`document.title = "${this.multicastClient.clientinfo.name} - ${this.multicastClient.clientinfo.servername} - Version ${submissionnumber}"`);
        
        // Set lock before starting PDF generation
        IpcHandler.isPrintingPdf = true;
        
        try {
            const tPrint = traceTiming ? Date.now() : 0
            const data = await WindowHandler.examwindow.webContents.printToPDF(options);
            if (traceTiming) {
                log.info(`communicationhandler @ getBase64PDF: printToPDF ${Date.now() - tPrint}ms (${saveReason})`)
            }
            let pdfBuf = Buffer.from(data);
            let signed = false
            let signMode = null
            if (isSigningExport) {
                try {
                    const tP12 = Date.now()
                    const { p12Buffer, mode } = this.ensureSubmissionSigningP12()
                    const p12Ms = Date.now() - tP12
                    signMode = mode
                    const signedAt = new Date()
                    const tSign = Date.now()
                    pdfBuf = await signSubmissionPdf(pdfBuf, p12Buffer, {
                        name: this.multicastClient.clientinfo.name,
                        signMode: mode,
                        signedAt,
                        logoPngPath: this.resolveSubmissionStampIconPath(),
                        reason: 'Next-Exam submission',
                        contactInfo: 'https://next-exam.at',
                        location: 'Next-Exam',
                    })
                    if (traceTiming) {
                        log.info(`communicationhandler @ getBase64PDF: p12 ${p12Ms}ms sign ${Date.now() - tSign}ms total ${Date.now() - t0}ms (${saveReason})`)
                    }
                    signed = true
                } catch (signErr) {
                    log.error('communicationhandler @ getBase64PDF: signing failed', signErr)
                    return { sender: 'client', message: 'PDF signing failed', status: 'error' }
                }
            }
            const base64pdf = pdfBuf.toString('base64');
            const dataUrl = `data:application/pdf;base64,${base64pdf}`;
            return { sender: "client", message:"PDF generated", dataUrl:dataUrl, base64pdf: base64pdf, status: "success", signed, signMode };
        } catch (error) {
            log.error("communicationhandler @ getBase64PDF: Error generating PDF:", error);
            return { sender: "client", message: "Error generating PDF", status: "error" };
        } finally {
            // Always release the lock, even if an error occurred
            IpcHandler.isPrintingPdf = false;
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
                WindowHandler.createScreenlockWindow(display)  // add screenlock windows for additional displays
            } 
        }
    }

    // remove temporary screenlockwindow
    killScreenlock(){
        try {
            for (let screenlockwindow of WindowHandler.screenlockwindows){
                if (screenlockwindow && !screenlockwindow.isDestroyed()) {
                    screenlockwindow.close(); 
                    screenlockwindow.destroy(); 
                }
            }
        } catch (e) { 
            log.error("communicationhandler @ killScreenlock: no functional screenlockwindow to handle")
        } 
        // Clear array completely after attempting to destroy all windows
        // The closed event handler will also clean up, but this ensures the array is empty
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
        // check if any dialog is open and log warning
        if (WindowHandler.exitWarningOpen || WindowHandler.exitQuestionOpen || WindowHandler.minimizeWarningOpen) {
            log.warn("communicationhandler @ startExam: Dialog is still open - exam will start anyway")
        }
  
        let displays = screen.getAllDisplays()
        let primary = screen.getPrimaryDisplay()
       
        if (!primary || primary === "" || !primary.id){ primary = displays[0] }       

        // when allowSectionSwitch: client chooses section, clientinfo.lockedSection is authoritative; do not overwrite with server
        if (!serverstatus.allowSectionSwitch || !this.multicastClient.clientinfo.lockedSection) {
            this.multicastClient.clientinfo.lockedSection = serverstatus.lockedSection;
        }
        const effectiveSection = this.multicastClient.clientinfo.lockedSection;

        const examtype = serverstatus.examSections[effectiveSection].examtype;

        // LocalVM must run preflight BEFORE exammode and BEFORE opening the exam window.
        if (examtype === 'localvm') {
            if (WindowHandler.examwindow) {
                log.warn('communicationhandler @ startExam: localvm requested but examwindow already exists');
                return;
            }
            if (this.localVmStartState !== 'idle') {
                log.info(`communicationhandler @ startExam: localvm start suppressed (state=${this.localVmStartState})`);
                return;
            }
            this.notifyLocalVmCompatCheckStart();
            let qemuOk = false;
            try {
                qemuOk = await this.ensureQemuAvailableForLocalVm();
            } finally {
                if (!qemuOk) {
                    this.notifyLocalVmCompatCheckEnd();
                }
            }
            if (!qemuOk) {
                this.multicastClient.clientinfo.exammode = false;
                return;
            }
            this.localVmStartState = 'starting';
            try {                
                let preflight = null;
                try {
                    preflight = await this.preflightLocalVm(serverstatus, effectiveSection);
                } catch (e) {
                    log.error('communicationhandler @ startExam: preflightLocalVm failed', e);
                    this.multicastClient.clientinfo.localVMState = 'error';
                    this.multicastClient.clientinfo.exammode = false;
                    this.localVmStartState = 'blocked';
                    return;
                }
                if (!preflight?.allowStart) {
                    this.multicastClient.clientinfo.exammode = false;
                    this.localVmStartState = 'blocked';
                    return;
                }
                try {
                    await qemuService.startHeadless({
                        workdirectory: this.config.workdirectory,
                        examdirectory: this.config.examdirectory,
                        qcow2Name: preflight.qcow2Name,
                        vncDisplay: ':1',
                        overlayName: preflight.overlayName,
                        blockInternet: preflight.blockInternet,
                        displayWidth: preflight.displayWidth,
                        displayHeight: preflight.displayHeight,
                    });
                    this.multicastClient.clientinfo.localVMHost = '127.0.0.1';
                    this.multicastClient.clientinfo.localVMPort = Number(preflight.vncPort) || 5901;
                    this.multicastClient.clientinfo.localVMState = 'running';
                } catch (e) {
                    log.error('communicationhandler @ startExam: qemu start failed', e);
                    this.multicastClient.clientinfo.localVMHost = null;
                    this.multicastClient.clientinfo.localVMState = 'error';
                    this.multicastClient.clientinfo.exammode = false;
                    this.localVmStartState = 'blocked';
                    return;
                }

                this.multicastClient.clientinfo.exammode = true
                this.multicastClient.clientinfo.examtype = examtype
                this.multicastClient.clientinfo.cmargin = serverstatus.examSections[effectiveSection].cmargin
                this.multicastClient.clientinfo.linespacing = serverstatus.examSections[effectiveSection].linespacing
                this.multicastClient.clientinfo.audioRepeat = serverstatus.examSections[effectiveSection].audioRepeat
                log.info("communicationhandler @ startExam: creating exam window")
                WindowHandler.createExamWindow(examtype, this.multicastClient.clientinfo.token, serverstatus, primary);
                this.localVmStartState = 'idle';
            } catch (e) {
                this.localVmStartState = 'blocked';
                throw e;
            }
            return;
        }

        this.multicastClient.clientinfo.exammode = true
        this.multicastClient.clientinfo.cmargin = serverstatus.examSections[effectiveSection].cmargin  // this is used to configure margin settings for the editor
        this.multicastClient.clientinfo.linespacing = serverstatus.examSections[effectiveSection].linespacing // we try to double linespacing on demand in pdf creation
        this.multicastClient.clientinfo.audioRepeat = serverstatus.examSections[effectiveSection].audioRepeat // restrict repetition of audio files (for listening comprehension)

        if (!WindowHandler.examwindow){  // why do we check? because exammode is left if the server connection gets lost but students could reconnect while the exam window is still open and we don't want to create a second one
            log.info("communicationhandler @ startExam: creating exam window")
            this.multicastClient.clientinfo.examtype = examtype
            WindowHandler.createExamWindow(examtype, this.multicastClient.clientinfo.token, serverstatus, primary);
        }
        else if (WindowHandler.examwindow){  //reconnect into active exam session with exam window already open
            log.error("communicationhandler @ startExam: found existing Examwindow..")
            try {  // switch existing window back to exam mode
                WindowHandler.examwindow.show() 
                if (!this.config.development) { 
                    WindowHandler.examwindow.setFullScreen(true)  //go fullscreen again
                    WindowHandler.examwindow.setAlwaysOnTop(true, "screen-saver", 1)  //make sure the window is 1 level above everything
                    await enableRestrictions(WindowHandler)
                    await this.sleep(2000) // wait an additional 2 sec for windows restrictions to kick in (they steal focus)
                    WindowHandler.addBlurListener();
                    await this.sleep(500)
                    WindowHandler.examwindow.moveTop()
                    WindowHandler.examwindow.focus()
                }   
            }
            catch (e) { //examwindow variable is still set but the window is not managable anymore (manually closed in dev mode?)
                log.error("communicationhandler @ startExam: no functional examwindow found.. resetting")
                
                disableRestrictions(WindowHandler.examwindow)  //examwindow is given but not used in disableRestrictions
                WindowHandler.examwindow = null;
                this.multicastClient.clientinfo.exammode = false
                this.multicastClient.clientinfo.focus = true
                this.multicastClient.clientinfo.token = false
                return  // in that case.. we are finished here !
            }
        }
    }





    /**
     * Disables Exam mode
     * closes exam window
     * disables restrictions and blur 
     */
    /** Stores BiP site_info secrets in main only (never log). */
    setBipSiteInfo(info) {
        const key = String(info?.userprivateaccesskey ?? '').trim()
        if (!key) {
            this.bipSiteInfo = null
            this.invalidateSubmissionSigningP12()
            return { status: 'success', active: false }
        }
        this.bipSiteInfo = {
            userprivateaccesskey: key,
            userid: info?.userid ?? null,
            fullname: String(info?.fullname ?? '').trim(),
        }
        this.invalidateSubmissionSigningP12()
        return { status: 'success', active: true }
    }

    clearBipSiteInfo() {
        this.bipSiteInfo = null
        this.invalidateSubmissionSigningP12()
        return { status: 'success' }
    }

    /** Drops cached P12 so the next sign uses fresh BiP/local identity material. */
    invalidateSubmissionSigningP12() {
        this.cachedSubmissionSigningP12 = null
    }

    /** Builds signing P12 once per exam session (or after BiP login); reused for every submission. */
    ensureSubmissionSigningP12() {
        if (this.cachedSubmissionSigningP12?.p12Buffer?.length) {
            return this.cachedSubmissionSigningP12
        }
        this.cachedSubmissionSigningP12 = this.materializeSubmissionSigningP12()
        return this.cachedSubmissionSigningP12
    }

    /** Warms RSA/P12 on main after exam view load so submit does not block the UI. */
    prewarmSubmissionSigningP12() {
        return new Promise((resolve) => {
            setImmediate(() => {
                try {
                    const t0 = Date.now()
                    this.ensureSubmissionSigningP12()
                    log.info(`communicationhandler @ prewarmSubmissionSigningP12: ready in ${Date.now() - t0}ms`)
                    resolve({ status: 'success' })
                } catch (e) {
                    log.error('communicationhandler @ prewarmSubmissionSigningP12', e)
                    resolve({ status: 'error', message: e?.message || String(e) })
                }
            })
        })
    }

    /** Resolves student public/icons/icon.png for the submission stamp (dev + packaged). */
    resolveSubmissionStampIconPath() {
        const here = import.meta.dirname;
        const candidates = [
            join(app.getAppPath(), 'public/icons/icon.png'),
            join(process.resourcesPath, 'app.asar.unpacked', 'public/icons/icon.png'),
            join(here, '../../../public/icons/icon.png'),
            join(here, '../../public/icons/icon.png'),
        ];
        for (const p of candidates) {
            try {
                if (p && fs.existsSync(p)) {
                    return p;
                }
            } catch {
                // try next candidate
            }
        }
        log.warn('communicationhandler @ resolveSubmissionStampIconPath: icon.png not found');
        return null;
    }

    /** Creates P12: BiP userprivateaccesskey or local pin+token+time secret (called once per cache cycle). */
    materializeSubmissionSigningP12() {
        const displayName = String(this.multicastClient?.clientinfo?.name || 'Next-Exam Student').trim()
        const saltHex = crypto.randomBytes(16).toString('hex')
        const bip = this.bipSiteInfo?.userprivateaccesskey
        if (bip) {
            return deriveSigningP12(bip, saltHex, this.bipSiteInfo.fullname || displayName, {
                mode: SUBMISSION_SIGN_MODE_BIP,
                bipUserId: this.bipSiteInfo.userid,
            })
        }
        const pin = this.multicastClient?.clientinfo?.pin ?? ''
        const token = this.multicastClient?.clientinfo?.token ?? ''
        const timeMs = Date.now()
        const secret = buildLocalSubmissionSigningSecret(pin, token, timeMs)
        return deriveSigningP12(secret, saltHex, displayName, { mode: SUBMISSION_SIGN_MODE_LOCAL })
    }

    async endExam(serverstatus){
        this.clearBipSiteInfo()
        WindowHandler.removeBlurListener();
      
        //only disable restrictions if not in exam mode ( seriosuly.. how could this ever happen? )
        if (this.multicastClient.clientinfo.exammode){
            this.multicastClient.clientinfo.exammode = false
            disableRestrictions()
        }

        // delete students work on students pc (makes sense if exam is written on school property)
        if (serverstatus && serverstatus.delfolderonexit === true){
            log.info("communicationhandler @ endExam: cleaning exam workfolder on exit")
            try {
                if (fs.existsSync(this.config.examdirectory)){   // set by server.js (desktop path + examdir)
                    fs.rmSync(this.config.examdirectory, { recursive: true });
                    fs.mkdirSync(this.config.examdirectory);
                }
            } catch (error) { log.error("communicationhandler @ endExam: ",error); }
        }


        if (WindowHandler.examwindow){ // in some edge cases in development this is set but still unusable - use try/catch   
            try { 
                // destroy devtools window
                if (this.config.development || this.config.showdevtools){
                    const allWebContents = webContents.getAllWebContents()                        // all WebViews of the child
                    for (const wc of allWebContents) {
                        if (WindowHandler.examwindow && wc.hostWebContents?.id === WindowHandler.examwindow.webContents.id && wc.isDevToolsOpened?.()){
                            log.info("communicationhandler @ endExam: destroying devtools window")
                            wc.closeDevTools()                                                 // Close DevTools of the WebView (also when detached)
                        }
                    }
                    // Wait for all DevTools to be closed before closing the exam window
                    await this.sleep(1000)                                                       // ensure all closeDevTools() calls are completed
                }
                // always try to close the exam window safely after devtools handling
                this.closeExamWindowSafely()
            }
            catch(e){ log.error('communicationhandler @ endExam: ',e)}
        }
        
        this.multicastClient.clientinfo.msofficeshare = false
        this.multicastClient.clientinfo.focus = true
        this.multicastClient.clientinfo.localLockdown = false;

        // stop VNC proxy + shutdown VM after window teardown to avoid reconnect loops
        stopProxy();
        try {
            log.info('communicationhandler @ endExam: requesting VM shutdown');
            await qemuService.stopVmAsync({ graceful: true, shutdownTimeoutMs: 8000, killTimeoutMs: 8000 });
        } catch (e) {
            log.warn('communicationhandler @ endExam: shutdown failed, killing VM');
            await qemuService.stopVmAsync({ graceful: false, killTimeoutMs: 8000 });
        }
        try {
            await qemuService.killAllLocalQemu(this.config.workdirectory);
        } catch (e) {
            log.warn('communicationhandler @ endExam: killAllLocalQemu sweep', e);
        }

        if (languageToolServer.languageToolProcess){
            languageToolServer.stopServer(); // Kill LanguageTool server when exam window is closed
        }
        // ask student to quit app after finishing exam
        await WindowHandler.showExitQuestion()
    }







    
    /**
     * Closes examwindow only when no printToPDF operation is running
     */
    closeExamWindowSafely(){
        const examWin = WindowHandler.examwindow
        if (!examWin){ return }

        if (IpcHandler.isPrintingPdf){
            log.warn("communicationhandler @ closeExamWindowSafely: printToPDF in progress - retry in 1s")
            setTimeout(() => { this.closeExamWindowSafely() }, 1000) // retry until printing is finished
            return
        }

        try {
            if (!examWin.isDestroyed?.()){
                examWin.close() // normal close, on('close') handler does the rest
            }
        } catch (e){
            log.error("communicationhandler @ closeExamWindowSafely: error while closing examwindow", e)
        } finally {
            WindowHandler.examwindow = null
        }
    }

    // this is manually triggered if connection is lost during exam - we allow the student to get out of the kiosk mode 
    // INFO: this is basically redundant 
    async gracefullyEndExam(){
        this.endExam()
    }

    // reset all variables that signal or need a valid teacher connection
    resetConnection(){
        this.multicastClient.clientinfo.token = false
        this.multicastClient.clientinfo.ip = false
        this.multicastClient.clientinfo.serverip = false
        this.multicastClient.clientinfo.servername = false
        this.multicastClient.clientinfo.focus = true  // we are focused
        //this.multicastClient.clientinfo.exammode = false   // do not set to false until exam window is actually closed  (this is done in endExam())
        this.multicastClient.clientinfo.timestamp = false
        this.multicastClient.clientinfo.localLockdown = false
        //this.multicastClient.clientinfo.virtualized = false  // this check happens only at the application start.. do not reset once set
        // Do not reset desktop capture stream here: kiosk/exam cannot show OS getDisplayMedia prompts; stream must live until app quit.
    }
 



    /**
     * fetches files made available for download by the teacher
     * the trigger and file list are received via the update interval
     * @param {*} files
     */
    requestFileFromServer(files){
        let servername = this.multicastClient.clientinfo.servername
        let serverip = this.multicastClient.clientinfo.serverip
        let studenttoken = this.multicastClient.clientinfo.token
        let backupfile = false
        for (const file of files) {
            if (file.name && file.name.toLowerCase().endsWith('.htm')){   // this will always set the last htm backup as backup file if there is more than one
                backupfile = file.name
            }
        }
        

        // Prepare data for the POST request
        let data = JSON.stringify({ 'files': files, 'type': 'studentfilerequest' });

        // Fetch request with the corresponding options
        examApiFetch(`https://${serverip}:${this.config.serverApiPort}/server/data/download/${servername}`, {
            method: "POST",
            body: data,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studenttoken}` },
        })
        .then(response => response.arrayBuffer()) // Antwort als ArrayBuffer erhalten
        .then(buffer => {
            let absoluteFilepath = join(this.config.tempdirectory, studenttoken.concat('.zip'));
            fs.writeFile(absoluteFilepath, Buffer.from(buffer), (err) => {
                if (err) { log.error(err);  }
                else {
                    extract(absoluteFilepath, { dir: this.config.examdirectory })
                    .then(() => {
                        log.info("CommunicationHandler @ requestFileFromServer: files received and extracted");
                        return fs.promises.unlink(absoluteFilepath); // Using the promise-based fs API
                    })
                    .then(async () => {
                        await this.encryptExamdirectoryFiles();
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
            // localvm has no renderer-side save flow; send ZIP directly
            if (this.multicastClient?.clientinfo?.examtype === 'localvm') {
                this.sendToTeacher()
                return
            }
            try {
                WindowHandler.examwindow.webContents.send('save','teacherrequest')   //trigger, why  (teacherrequest will also trigger sendToTeacher() but only after saving the pdf is complete)
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

        //  this is the logfile path try to copy the logfile to the examdirectory before making the zip file
        let logfilepath = platformDispatcher.logfile;
        if (fs.existsSync(logfilepath)){
            try {
                fs.copyFileSync(logfilepath, join(this.config.examdirectory, 'next-exam-student.log'));
            } catch (e){ log.error('communicationhandler @ sendToTeacher: could not copy logfile to examdirectory'); }
        }

        let zipfilename = this.multicastClient.clientinfo.name.concat('.zip')
        let servername = this.multicastClient.clientinfo.servername
        let serverip = this.multicastClient.clientinfo.serverip
        let studenttoken = this.multicastClient.clientinfo.token
        let zipfilepath = join(this.config.tempdirectory, zipfilename);
     

        let base64File = null
        try {
            await this.zipDirectory(this.config.examdirectory, zipfilepath)
            const fileContent = fs.readFileSync(zipfilepath);
            base64File = fileContent.toString('base64');
        }catch (e){  log.error(e)  }

        // sending the whole directory as zip file base64encoded via JSON isn't probably the best method but it works while all formData approaches failed with
        // fetch() while they worked with ax ios() - not even chatgpt or stackoverflow could help ^^ i think it is related to the specific formData module that cant be imported without "window error"
        const url = `https://${serverip}:${this.config.serverApiPort}/server/data/receive/${servername}`;
        const zipPayload = {
            file: base64File,
            filename: zipfilename,
            lastExamWriteSaveReason: typeof this.lastExamWriteSaveReason === 'string' ? this.lastExamWriteSaveReason : 'n/a'
        }
        examApiFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studenttoken}` },
            body: JSON.stringify(zipPayload),
        })
        .then(response => response.json())
        .then(data => {
            log.info(`communicationhandler @ sendExamToTeacher: teacher response: ${data.message}`);
            if (data && (data.status === 'success' || data.message === 'success')) {
                this.lastExamWriteSaveReason = 'n/a';
            }
        })
        .catch(error => {log.error(`communicationhandler @ sendExamToTeacher: ${error}`); });
     }

    // Upload next-exam-student.log from workdirectory root when teacher requests log snapshot (separate from ZIP backup).
    async sendStudentLogToTeacher(){
        const logPath = platformDispatcher.logfile
        if (!fs.existsSync(logPath)) {
            log.warn(`communicationhandler @ sendStudentLogToTeacher: missing ${logPath}`)
            return
        }
        let base64File
        try {
            base64File = fs.readFileSync(logPath).toString('base64')
        } catch (e) {
            log.error(`communicationhandler @ sendStudentLogToTeacher: read failed ${e}`)
            return
        }
        const servername = this.multicastClient.clientinfo.servername
        const serverip = this.multicastClient.clientinfo.serverip
        const studenttoken = this.multicastClient.clientinfo.token
        const clientname = this.multicastClient.clientinfo.name
        const url = `https://${serverip}:${this.config.serverApiPort}/server/data/studentlog/${servername}`
        try {
            const response = await examApiFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studenttoken}` },
                body: JSON.stringify({ file: base64File, clientname }),
            })
            const data = await response.json()
            log.info(`communicationhandler @ sendStudentLogToTeacher: ${data.message || data.status}`)
        } catch (error) {
            log.error(`communicationhandler @ sendStudentLogToTeacher: ${error}`)
        }
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
 
