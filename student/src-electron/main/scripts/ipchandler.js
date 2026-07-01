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
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import ip from 'ip'
import net from 'net'
import dns from 'dns'
import i18n from '../../../src/locales/locales.js'
const {t} = i18n.global
import { ipcMain, clipboard, app, webContents, dialog, shell } from 'electron'
import { gateway4sync } from 'default-gateway';
import os, { networkInterfaces } from 'os'
import log from 'electron-log';
import {disableRestrictions} from './platformrestrictions.js';
import * as webFilter from './webFilter.js';
import mammoth from 'mammoth';

import languageToolServer from './lt-server';
import platformDispatcher from './platformDispatcher.js';
import { isAssessmentSessionActive } from './assessmentSession.js';
import { updateSystemTray } from './traymenu.js';
import { ensureNetworkOrReset } from './testpermissionsMac.js';
import { getWlanInfo } from './getwlaninfo.js';
import { switchExamSection } from './switchExamSection.js';
import { startProxy, stopProxy } from './vncproxy.js';
import qemuService from './qemuService.js';
import {
    checkQemuAvailability,
    getQemuInstallInfo,
    getWindowsHypervisorPlatformState,
    requestEnableWindowsHypervisorPlatform,
} from '../../../../shared/qemuAvailability.js';
import { pickLocalVmGroupConfig } from '../../../../shared/localVmDisplayResolutions.js';
import { getVMFindings } from './vmDetection.js';
import { decryptExamFileBytes, decryptExamFileAllLayers, decryptExamFileAllLayersAsync, encryptExamFileBytes, isExamFileEncryptedBytes } from './examFileCrypto.js';
import { examApiFetch } from '../../../../shared/examApiFetch.js';
import { normalizeStudentClientName } from '../../../../shared/normalizeStudentClientName.js';
import { buildNextExamMoodleProof } from '../../../../shared/buildNextExamMoodleProof.js';
import { DEFAULT_EDITOR_EXAM_CONFIG } from '../../../../shared/editorExamConfig.js';
import { NEXT_EXAM_MOODLE_PROOF_HEADER } from '../../../../shared/nextExamMoodleProofSecret.js';
import { setClientFocusLock, clearClientFocusLock } from './focusLockState.js';
import { syncClientDisplayInfo } from './displayInfo.js';
import { captureActiveWindowScreenshot } from './cageScreenshotCapture.js';
import {
    detectCageInstalled,
    detectCageKioskAppImageInstalled,
    detectCageKioskDesktopInstalled,
    detectRunningInCage,
    needsCageKioskSetup,
    resolveRunnableCageKioskInstallScript,
} from './cageDetect.js';
import {
    detectRunningInWindowsKiosk,
    isWindowsKioskOsUser,
    isWindowsAssignedAccessSessionActive,
    detectWindowsKioskInstalled,
    detectWindowsKioskUserExists,
    needsWindowsKioskSetup,
    initiateKioskSetup as initiateWindowsKioskSetup,
    readKioskLauncherApps,
    readKioskSystemAllowedApps,
    syncAllowedKioskAppsClientinfo,
    launchKioskAllowedApp,
} from './win/windowsKioskSetup.js';

// Skip info-level file-save log noise when the renderer marks the write as periodic auto-save.
const logSaveInfoUnlessAuto = (saveReason, message) => {
    if (saveReason === 'auto') return
    log.info(message)
}

/** Per-guest webRequest hooks for eduvidual Moodle proof headers. */
const eduvidualMoodleProofHooks = new Map();

/** Remove Moodle proof header injection for an eduvidual webview guest. */
const detachEduvidualMoodleProofHeaders = (guestId) => {
    const id = Number(guestId);
    const entry = eduvidualMoodleProofHooks.get(id);
    if (!entry) return;
    try {
        entry.session.webRequest.onBeforeSendHeaders(entry.filter, null);
    } catch (e) {
        log.debug('ipchandler @ detachEduvidualMoodleProofHeaders:', e?.message || e);
    }
    eduvidualMoodleProofHooks.delete(id);
};

/** Attach HMAC proof header on requests to moodleDomain (quizaccess_nextexam contract). */
const attachEduvidualMoodleProofHeaders = (guest, { moodleDomain, moodleTestId, exammode, sebConfigHash, sebBekHash }) => {
    if (!guest || guest.isDestroyed?.()) return false;
    detachEduvidualMoodleProofHeaders(guest.id);
    if (!exammode || !moodleDomain || moodleTestId == null || moodleTestId === '') return false;

    const proof = buildNextExamMoodleProof(moodleTestId);
    const host = String(moodleDomain).replace(/^https?:\/\//i, '').split('/')[0];
    const filter = { urls: !host.startsWith('localhost') ?
            [`*://${host}/*`, `*://*.${host}/*`] :
            [`http://${host}/*`, `https://${host}/*`] };
    const handler = (details, callback) => {
        details.requestHeaders[NEXT_EXAM_MOODLE_PROOF_HEADER] = proof;
        details.requestHeaders['X-Next-Exam-Client'] = '1';
        if (sebConfigHash != null) details.requestHeaders['X-SafeExamBrowser-ConfigKeyHash'] = sebConfigHash;
        if (sebBekHash != null) details.requestHeaders['X-SafeExamBrowser-RequestHash'] = sebBekHash;
        callback({ requestHeaders: details.requestHeaders });
    };
    guest.session.webRequest.onBeforeSendHeaders(filter, handler);
    eduvidualMoodleProofHooks.set(guest.id, { session: guest.session, filter, handler });
    log.info(`ipchandler @ attachEduvidualMoodleProofHeaders: guest ${guest.id} quiz ${moodleTestId} host ${host}`);
    return true;
};

/** Exam file key: serverstatus.encryptionPassword; local lockdown uses serverstatus.password only. */
const resolveExamDecryptPassword = (multicastClient) => {
    const examPw = String(multicastClient?.serverstatus?.encryptionPassword ?? '').trim();
    if (examPw) return examPw;
    if (multicastClient?.clientinfo?.localLockdown) {
        return String(multicastClient?.serverstatus?.password ?? '').trim();
    }
    return '';
};

// Encrypt once for disk; if buffer is already NXE1, write as-is (avoids nested ciphertext).
const encryptExamFileBytesUnlessAlready = (plainBuf, pw) => {
    const buf = Buffer.isBuffer(plainBuf) ? plainBuf : Buffer.from(plainBuf);
    if (isExamFileEncryptedBytes(buf)) return buf;
    return pw ? encryptExamFileBytes(buf, pw) : buf;
};

// Resolves a single-segment filename under rootDir or returns null (blocks path traversal from IPC/renderer).
const resolveWritablePathUnderExamDir = (rootDir, name, allowedLowerExtensions = null) => {
    if (rootDir == null || typeof rootDir !== 'string' || name == null || typeof name !== 'string') return null;
    const n = name.trim();
    if (!n || n.includes('\0')) return null;
    if (n !== path.basename(n)) return null;
    if (n === '.' || n === '..') return null;
    const ext = path.extname(n).toLowerCase();
    if (allowedLowerExtensions?.length && !allowedLowerExtensions.includes(ext)) return null;
    const stem = path.parse(n).name;
    if (/^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i.test(stem)) return null;
    const rootResolved = path.resolve(rootDir);
    const absTarget = path.resolve(path.join(rootResolved, n));
    const rel = path.relative(rootResolved, absTarget);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return absTarget;
};

const checkPortOpen = (port, host = '127.0.0.1', timeout = 1500) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const finish = (running, error = null) => {
            socket.destroy();
            resolve({ running, port, host, error });
        };
        socket.setTimeout(timeout);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false, 'timeout'));
        socket.once('error', (err) => finish(false, err.message));
        try {
            socket.connect(port, host);
        } catch (err) {
            finish(false, err.message);
        }
    });
};

  ////////////////////////////////
 // IPC handling (Backend) START
////////////////////////////////

class IpcHandler {
    constructor () {
        this.multicastClient = null
        this.config = null
        this.WindowHandler = null
        this.isPrintingPdf = false // flag to prevent closing window while printing
    }
    init (mc, config, wh, ch) {
        this.multicastClient = mc
        this.config = config
        this.WindowHandler = wh  
        this.CommunicationHandler = ch
        

        // Single source of truth: platformDispatcher.platform decides which kiosk model applies.
        // win32 = AssignedAccess, linux = Cage, darwin = no kiosk (all flags false). platform/displayServer always set.
        ipcMain.handle('get-platform-info', () => {
            const platform = platformDispatcher.platform;
            const base = { displayServer: platformDispatcher.displayServer, platform };
            if (platform === 'win32') {
                const installed = detectWindowsKioskInstalled() && detectWindowsKioskUserExists();
                return {
                    ...base,
                    cageInstalled: detectWindowsKioskUserExists(),
                    runningInCage: detectRunningInWindowsKiosk(),
                    isWindowsKioskUser: isWindowsKioskOsUser(),
                    assignedAccessActive: isWindowsAssignedAccessSessionActive(),
                    cageKioskAppImageInstalled: detectWindowsKioskInstalled(),
                    cageKioskDesktopInstalled: installed,
                    needsCageKioskSetup: needsWindowsKioskSetup(),
                };
            }
            if (platform === 'linux') {
                return {
                    ...base,
                    cageInstalled: detectCageInstalled(),
                    runningInCage: detectRunningInCage(),
                    cageKioskAppImageInstalled: detectCageKioskAppImageInstalled(),
                    cageKioskDesktopInstalled: detectCageKioskDesktopInstalled(),
                    needsCageKioskSetup: needsCageKioskSetup(),
                };
            }
            // darwin (and any other): no kiosk model, no cage/AssignedAccess checks.
            return {
                ...base,
                cageInstalled: false,
                runningInCage: false,
                cageKioskAppImageInstalled: false,
                cageKioskDesktopInstalled: false,
                needsCageKioskSetup: false,
            };
        });

        ipcMain.handle('get-mac-arch-info', () => platformDispatcher.macRosettaEmulation);

        ipcMain.handle('quit-app', () => {
            // Route through mainwindow.close so the cage exit warning in windowhandler.on('close') is the single source of truth.
            if (this.WindowHandler?.mainwindow) this.WindowHandler.mainwindow.close();
            else app.quit();
        });

        ipcMain.handle('capture-screenshot-frame', async () => {
            return captureActiveWindowScreenshot(this.WindowHandler, this.multicastClient);
        });

        // channel name kept for renderer compatibility; win32 routes to UAC + PowerShell payload.
        ipcMain.handle('get-kiosk-launcher-apps', () => (process.platform === 'win32' ? readKioskLauncherApps() : []));

        ipcMain.handle('get-kiosk-system-allowed-apps', () => (
            process.platform === 'win32' ? readKioskSystemAllowedApps() : { ok: false, error: 'win32 only' }
        ));

        ipcMain.handle('launch-kiosk-allowed-app', (_event, exePath) => (
            process.platform === 'win32' ? launchKioskAllowedApp(exePath) : { ok: false, error: 'win32 only' }
        ));

        ipcMain.handle('install-linux-cage-kiosk', () => {
            if (process.platform === 'win32') {
                // optional EXAM-STUDENT hooks; passed through to PS only if each file exists
                const extraAppsFile = path.join(this.config.workdirectory, 'kiosk-allowed-apps.txt');
                const firewallRulesScript = path.join(this.config.workdirectory, 'firewall-rules.ps1');
                return initiateWindowsKioskSetup(process.execPath, extraAppsFile, firewallRulesScript);
            }
            const source = process.env.APPIMAGE || process.execPath;
            const bundled = app.isPackaged
                ? path.join(process.resourcesPath, 'linux', 'install-cage-kiosk.sh')
                : path.join(process.cwd(), 'src-electron/resources/linux/install-cage-kiosk.sh');
            const script = resolveRunnableCageKioskInstallScript(bundled);
            if (!script) {
                return Promise.resolve({ ok: false, error: `install script not found: ${bundled}` });
            }
            return new Promise((resolve) => {
                const child = spawn('pkexec', ['/bin/sh', script, source], { env: process.env });
                let stderr = '';
                child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
                child.on('error', (err) => resolve({ ok: false, error: err.message }));
                child.on('close', (code) => {
                    if (code === 0) resolve({ ok: true });
                    else resolve({ ok: false, error: stderr.trim() || `exit ${code}` });
                });
            });
        });

        ipcMain.on('set-new-locale', (event, locale) => {
            log.info(`ipchandler @ set-new-locale: setting new locale to ${locale}`)
            i18n.locale = locale
            updateSystemTray(i18n.locale);
        })


        ipcMain.handle('getExamMaterials', async (event) => { 
      
            let clientinfo = this.multicastClient.clientinfo
            let servername = clientinfo.servername
            let serverip = clientinfo.serverip
            let studenttoken = clientinfo.token
           
            let payload = {
                group: clientinfo.group,
                lockedSection: clientinfo.lockedSection,
            }

            let examMaterials = false
            if (this.multicastClient.clientinfo.localLockdown){
                return false
            }
            else{
                // Fetch request with the corresponding options
                examMaterials = await examApiFetch(`https://${serverip}:${this.config.serverApiPort}/server/data/getexammaterials/${servername}`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studenttoken}` },
                })
                .then(response => response.json()) // Receive response as JSON
                .then(data => {
                    // log.info("ipchandler @ getExamMaterials: received data", data)
                    return data
                })
                .catch(err => log.error(`ipchandler @ getExamMaterials: ${err}`));
                return examMaterials
            }
        }) 

        ipcMain.handle('start-proxy', async (event, payload) => {
            try {
                const { host, port } = payload || {};
                if (!host || !port) {
                    throw new Error('Invalid proxy target');
                }
                const result = await startProxy({ host, port });
                return { port: result };
            } catch (err) {
                log.error('ipchandler @ start-proxy:', err);
                return { port: null, error: err.message };
            }
        });

        // shut down the VNC proxy helper from renderer (e.g. localvmview beforeUnmount)
        ipcMain.handle('stop-proxy', async () => {
            try {
                stopProxy();
                return { ok: true };
            } catch (err) {
                log.error('ipchandler @ stop-proxy:', err);
                return { ok: false, error: err.message };
            }
        });

        ipcMain.handle('qemu-check-available', async (_event, opts = {}) => {
            try {
                return await checkQemuAvailability(opts);
            } catch (e) {
                log.error('ipchandler @ qemu-check-available', e);
                const install = getQemuInstallInfo();
                return {
                    ok: false,
                    missing: ['qemu-system-x86_64', 'qemu-img'],
                    downloadUrl: install.downloadUrl,
                    installHint: install.installHint,
                };
            }
        });

        ipcMain.handle('qemu-open-install-page', async () => {
            try {
                const { downloadUrl } = getQemuInstallInfo();
                await shell.openExternal(downloadUrl);
                return { ok: true };
            } catch (e) {
                log.error('ipchandler @ qemu-open-install-page', e);
                return { ok: false, error: String(e?.message || e) };
            }
        });

        ipcMain.handle('qemu-check-hypervisor-platform', async () => {
            try {
                return await getWindowsHypervisorPlatformState();
            } catch (e) {
                log.error('ipchandler @ qemu-check-hypervisor-platform', e);
                return { supported: false, enabled: false, state: 'error' };
            }
        });

        ipcMain.handle('qemu-request-enable-hypervisor-platform', async () => {
            try {
                return requestEnableWindowsHypervisorPlatform();
            } catch (e) {
                log.error('ipchandler @ qemu-request-enable-hypervisor-platform', e);
                return { ok: false, error: String(e?.message || e) };
            }
        });

        ipcMain.handle('qemu-start-headless', async (_event, payload = {}) => {
            try {
                const avail = await checkQemuAvailability();
                if (!avail.ok) {
                    log.warn('ipchandler @ qemu-start-headless: QEMU not available', avail.missing);
                    return { ok: false, qemuMissing: true, missing: avail.missing };
                }
                const { qcow2Name, vncPort, overlayName, blockInternet, expectedSha256, expectedSizeBytes, forceFreshOverlay } = payload || {};
                const effectiveSection = this.multicastClient?.clientinfo?.lockedSection
                    || this.multicastClient?.serverstatus?.lockedSection
                    || this.multicastClient?.serverstatus?.activeSection
                    || 1;
                const examSection = this.multicastClient?.serverstatus?.examSections?.[effectiveSection];
                const { display } = pickLocalVmGroupConfig(examSection, this.multicastClient?.clientinfo?.name);
                const displayWidth = Number(payload?.displayWidth) > 0 ? Number(payload.displayWidth) : display.width;
                const displayHeight = Number(payload?.displayHeight) > 0 ? Number(payload.displayHeight) : display.height;
                log.info(`ipchandler @ qemu-start-headless: start requested (disk=${qcow2Name}, port=${vncPort}, display=${displayWidth}x${displayHeight}, blockInternet=${!!blockInternet}, hasHash=${!!expectedSha256}, hasSize=${typeof expectedSizeBytes === 'number'})`);
                const vncDisplay = Number(vncPort) === 5901 ? ':1' : ':1';
                if (this.multicastClient?.clientinfo) {
                    this.multicastClient.clientinfo.localVMHost = null;
                    this.multicastClient.clientinfo.localVMPort = Number(vncPort) || 5901;
                    this.multicastClient.clientinfo.localVMState = (expectedSha256 || expectedSizeBytes) ? 'verifying_hash' : 'starting';
                }
                if (expectedSha256 || expectedSizeBytes) {
                    if (!this.CommunicationHandler?.runLocalVmPreStartVerify) {
                        throw new Error('runLocalVmPreStartVerify unavailable');
                    }
                    const pre = await this.CommunicationHandler.runLocalVmPreStartVerify(qcow2Name, expectedSha256 || null, expectedSha256 ? null : expectedSizeBytes);
                    if (!pre.allowStart) {
                        log.warn(`ipchandler @ qemu-start-headless: pre-start verify blocked start for ${qcow2Name}`);
                        return { ok: false, error: 'localvm hash verify failed or disk missing' };
                    }
                }
                const result = await qemuService.startHeadless({
                    workdirectory: this.config.workdirectory,
                    examdirectory: this.config.examdirectory,
                    qcow2Name,
                    vncDisplay,
                    overlayName,
                    blockInternet: !!blockInternet,
                    forceFreshOverlay: !!forceFreshOverlay,
                    displayWidth,
                    displayHeight,
                });
                if (this.multicastClient?.clientinfo) {
                    this.multicastClient.clientinfo.localVMHost = '127.0.0.1';
                    this.multicastClient.clientinfo.localVMPort = Number(vncPort) || 5901;
                    this.multicastClient.clientinfo.localVMState = (expectedSha256 || expectedSizeBytes) ? 'running' : 'unverified_hash';
                }
                return { ok: true, result };
            } catch (err) {
                log.error('ipchandler @ qemu-start-headless', err);
                if (this.multicastClient?.clientinfo) {
                    this.multicastClient.clientinfo.localVMHost = null;
                    this.multicastClient.clientinfo.localVMState = 'error';
                }
                return { ok: false, error: String(err?.message || err) };
            }
        });

        ipcMain.handle('qemu-stop', async () => {
            try {
                await qemuService.stopVmAsync({ graceful: true, shutdownTimeoutMs: 8000, killTimeoutMs: 8000 });
                await qemuService.killAllLocalQemu(this.config.workdirectory);
                return { ok: true };
            } catch (err) {
                log.error('ipchandler @ qemu-stop', err);
                return { ok: false, error: String(err?.message || err) };
            }
        });

        ipcMain.handle('qemu-reset-hard', async () => {
            try {
                const res = await qemuService.resetVmHard();
                return { ok: true, result: res };
            } catch (err) {
                log.error('ipchandler @ qemu-reset-hard', err);
                return { ok: false, error: String(err?.message || err) };
            }
        });

        ipcMain.handle('qemu-pick-disk-file', async () => {
            try {
                const result = await dialog.showOpenDialog(this.WindowHandler.mainwindow, {
                    properties: ['openFile'],
                    filters: [{ name: 'QEMU Disk', extensions: ['qcow2'] }],
                });
                if (result.canceled || !result.filePaths?.[0]) {
                    return { ok: false, cancelled: true };
                }
                return { ok: true, sourcePath: result.filePaths[0] };
            } catch (err) {
                log.error('ipchandler @ qemu-pick-disk-file', err);
                return { ok: false, error: String(err?.message || err) };
            }
        });

        ipcMain.handle('qemu-import-disk', async (_event, payload = {}) => {
            try {
                const sourcePath = payload?.sourcePath;
                if (!sourcePath) {
                    return { ok: false, error: 'invalid sourcePath' };
                }
                const sendProgress = (p) => {
                    try { this.WindowHandler?.mainwindow?.webContents?.send?.('qemu-download-progress', p); } catch (e) {}
                };
                const importRes = await qemuService.importDisk({
                    workdirectory: this.config.workdirectory,
                    sourcePath,
                    onProgress: sendProgress,
                });
                if (importRes?.ok && this.multicastClient?.serverstatus?.exammode) {
                    if (this.CommunicationHandler.localVmStartState === 'starting') {
                        log.info('ipchandler @ qemu-import-disk: localvm start already in progress, skip startExam');
                    } else {
                        if (this.CommunicationHandler.localVmStartState === 'blocked') {
                            this.CommunicationHandler.localVmStartState = 'idle';
                        }
                        this.CommunicationHandler.startExam(this.multicastClient.serverstatus);
                    }
                }
                return importRes;
            } catch (err) {
                log.error('ipchandler @ qemu-import-disk', err);
                return { ok: false, error: String(err?.message || err) };
            }
        });

        ipcMain.handle('localvm-retry-start', async () => {
            try {
                const serverstatus = this.multicastClient?.serverstatus;
                if (!serverstatus?.exammode) {
                    return { ok: false, error: 'exam not active' };
                }
                if (this.CommunicationHandler.localVmStartState === 'starting') {
                    return { ok: false, error: 'start already in progress' };
                }
                this.CommunicationHandler.localVmStartState = 'idle';
                this.multicastClient.clientinfo.localVMState = null;
                this.multicastClient.clientinfo.localVMHost = null;
                await this.CommunicationHandler.startExam(serverstatus);
                return { ok: true };
            } catch (err) {
                log.error('ipchandler @ localvm-retry-start', err);
                return { ok: false, error: String(err?.message || err) };
            }
        });

        ipcMain.handle('qemu-download-disk', async (_event, payload = {}) => {
            try {
                const { serverip, serverApiPort, servername, studenttoken, filename, overwrite } = payload || {};
                log.info(`ipchandler @ qemu-download-disk: downloading ${filename} from teacher ${servername}@${serverip}:${serverApiPort}`);
                const sendProgress = (p) => {
                    try { this.WindowHandler?.mainwindow?.webContents?.send?.('qemu-download-progress', p); } catch (e) {}
                };
                sendProgress({ phase: 'start', filename, percent: 0 });
                const result = await qemuService.downloadDiskFromTeacher({
                    serverip,
                    serverApiPort,
                    servername,
                    studenttoken,
                    filename,
                    workdirectory: this.config.workdirectory,
                    overwrite: !!overwrite,
                    onProgress: sendProgress,
                });
                log.info(`ipchandler @ qemu-download-disk: download finished (skipped=${!!result?.skipped}) ${filename}`);
                sendProgress({ phase: 'end', filename, percent: 100 });
                if (this.multicastClient?.serverstatus?.exammode) {
                    if (this.CommunicationHandler.localVmStartState === 'starting') {
                        log.info('ipchandler @ qemu-download-disk: localvm start already in progress, skip startExam');
                    } else {
                        if (this.CommunicationHandler.localVmStartState === 'blocked') {
                            this.CommunicationHandler.localVmStartState = 'idle';
                        }
                        this.CommunicationHandler.startExam(this.multicastClient.serverstatus);
                    }
                }
                return { ok: true, result };
            } catch (err) {
                log.error('ipchandler @ qemu-download-disk', err);
                return { ok: false, error: String(err?.message || err) };
            }
        });

        // Helper function for common exception URLs (used by all exam modes)
        const checkCommonExceptions = (targetUrl) => {
            if (targetUrl.includes("login") && targetUrl.includes("Microsoft")) return true;
            if (targetUrl.includes("login") && targetUrl.includes("Google")) return true;
            if (targetUrl.includes("accounts") && targetUrl.includes("google.com")) return true;
            if (targetUrl.includes("mysignins") && targetUrl.includes("microsoft")) return true;
            if (targetUrl.includes("account") && targetUrl.includes("windowsazure")) return true;
            if (targetUrl.includes("login") && targetUrl.includes("microsoftonline")) return true;
            if (targetUrl.includes("lookup") && targetUrl.includes("google")) return true;
            if (targetUrl.includes("bildung.gv.at") && targetUrl.includes("SAML2")) return true;
            if (targetUrl.includes("Shibboleth") && targetUrl.includes("SAML2")) return true;
            if (targetUrl.includes("id-austria.gv.at") && targetUrl.includes("authHandler")) return true;
            
            if (targetUrl.includes("eu-mobile.events.data") && targetUrl.includes("microsoft")) return true;   // LMS
            if (targetUrl.includes("gstatic.com")) return true;   // LMS
            if (targetUrl.includes("aadcdn") && targetUrl.includes("microsoftonline")) return true;   // LMS
            if (targetUrl.includes("login") && targetUrl.includes("live.com")) return true;   // LMS
            if (targetUrl.includes("login") && targetUrl.includes("msftauth.net")) return true;   // LMS
            if (targetUrl.includes("aadcdn") && targetUrl.includes("msftauth.net")) return true;   // LMS
            if (targetUrl.includes("googlesyndication.com")) return true; 


            return false;
        };

        ipcMain.handle('start-blocking-for-webview', (event, { guestId, allowedUrls }) => {
            const guest = webContents.fromId(Number(guestId));
            if (!guest || guest.isDestroyed?.()) return false;

            // Remove old listeners to prevent duplicate registrations
            guest.removeAllListeners('will-navigate');

            // Normalize allowedUrls to object format for webFilter compatibility
            // Supports both legacy string format and new object format {url, blockSubdomains, blockSubfolders}
            const normalizedUrls = allowedUrls.map(entry => {
                if (typeof entry === 'object' && entry.url) {
                    return entry;
                }
                // Legacy string format - default to not blocking subdomains/subfolders
                return { url: String(entry), blockSubdomains: false, blockSubfolders: false };
            });

            // Helper: is target in allowed list? Only the entry whose domain matches the target applies; use only that entry's reason
            const getAllowResult = (targetUrl) => {
                if (!targetUrl) return { allowed: false, reason: 'no target URL' };
                if (checkCommonExceptions(String(targetUrl).toLowerCase())) return { allowed: true };

                let reasonFromMatchingEntry = null;
                for (const entry of normalizedUrls) {
                    const result = webFilter.getUrlAllowResult(targetUrl, entry.url, entry.blockSubdomains, entry.blockSubfolders);
                    if (result.allowed) return { allowed: true };
                    if (result.domainMatched) {
                        reasonFromMatchingEntry = result.reason;
                        break; // this entry applies (domain matches); use its reason only
                    }
                }
                return { allowed: false, reason: reasonFromMatchingEntry || 'domain not in allowed URLs' };
            };

            // Handle target="_blank" links and window.open - block BEFORE navigation
            guest.setWindowOpenHandler(({ url }) => {
                const { allowed, reason } = getAllowResult(url);
                if (allowed) {
                    log.info("ipchandler @ start-blocking-for-webview: allowed window.open to", url);
                    guest.loadURL(url); // Open in same webview
                    return { action: 'deny' }; // Prevent new window
                } else {
                    log.warn("ipchandler @ start-blocking-for-webview: blocked window.open to", url, "-", reason);
                    return { action: 'deny' };
                }
            });

            // Handle will-navigate on webContents level - fires BEFORE navigation happens
            guest.on('will-navigate', (e, url) => {
                const { allowed, reason } = getAllowResult(url);
                if (!allowed) {
                    log.warn("ipchandler @ start-blocking-for-webview: blocked navigation to", url, "-", reason);
                    e.preventDefault(); // Block navigation completely
                    guest.stop(); // Stop any loading immediately
                } else {
                    log.info("ipchandler @ start-blocking-for-webview: allowed navigation to", url);
                }
            });

            return true;
        });

        // IPC handler for mode-specific webview blocking - supports eduvidual, forms, rdp modes
        // For website mode, prefer using start-blocking-for-webview with webFilter.js instead
        ipcMain.handle('detach-eduvidual-moodle-proof', (event, { guestId }) => {
            detachEduvidualMoodleProofHeaders(guestId);
            return true;
        });

        ipcMain.handle('start-blocking-for-website-webview', (event, { guestId, mode, allowedDomain, baseUrl, blockSubdomains, blockSubfolders, moodleTestId, moodleDomain, formsUrl, exammode, sebConfigHash, sebBekHash }) => {
            const guest = webContents.fromId(Number(guestId));
            if (!guest || guest.isDestroyed?.()) return false;

            // Remove old listeners to prevent duplicate registrations
            guest.removeAllListeners('will-navigate');

            // Precompute Forms URL info (formsUrl must be a full URL)
            let formsUrlObj = null;
            if (typeof formsUrl === 'string' && formsUrl) {
                try {
                    formsUrlObj = new URL(formsUrl);
                } catch (e) {
                    formsUrlObj = null;
                }
            }

            // URL validation function - different logic based on mode; returns { allowed, reason? } for website mode
            const getAllowResult = (targetUrl) => {
                if (mode === "website") {
                    if (!targetUrl) return { allowed: true };
                    if (checkCommonExceptions(String(targetUrl).toLowerCase())) return { allowed: true };

                    const result = webFilter.getUrlAllowResult(targetUrl, baseUrl || allowedDomain, !!blockSubdomains, !!blockSubfolders);
                    return result;
                } else if (mode === "eduvidual") {
                    if (targetUrl.includes(moodleTestId)) return { allowed: true };
                    if (targetUrl.includes("startattempt.php") && targetUrl.includes(moodleDomain)) return { allowed: true };
                    if (targetUrl.includes("processattempt.php") && targetUrl.includes(moodleDomain)) return { allowed: true };
                    if (targetUrl.includes("logout") && targetUrl.includes(moodleDomain)) return { allowed: true };
                    if (targetUrl.includes("login") && targetUrl.includes("eduvidual")) return { allowed: true };
                    if (targetUrl.includes("login") && targetUrl.includes(moodleDomain)) return { allowed: true };
                    if (targetUrl.includes("policy") && targetUrl.includes(moodleDomain)) return { allowed: true };
                    if (targetUrl.includes("auth") && targetUrl.includes(moodleDomain)) return { allowed: true };
                    if (targetUrl.includes("SAML2") && targetUrl.includes("portal.tirol.gv.at")) return { allowed: true };
                    if (targetUrl.includes("login") && targetUrl.includes("portal.tirol.gv.at")) return { allowed: true };
                    if (targetUrl.includes("login") && targetUrl.includes("tirol.gv.at")) return { allowed: true };
                    return { allowed: false, reason: 'not in eduvidual allow list' };
                } else if (mode === "forms") {
                    const lowerUrl = String(targetUrl).toLowerCase();
                    if (checkCommonExceptions(lowerUrl)) return { allowed: true };

                    // Lock to same origin of the configured forms URL
                    if (formsUrlObj) {
                        try {
                            const currentObj = new URL(targetUrl);
                            if (currentObj.origin === formsUrlObj.origin) {
                                return { allowed: true };
                            }
                        } catch (e) {
                            return { allowed: false, reason: 'invalid target URL for forms mode' };
                        }
                    }

                    // If we have no valid base URL or URL is outside allowed scope, block
                    return { allowed: false, reason: 'not in forms allow list' };
                } else if (mode === "rdp") {
                    return { allowed: true };
                }

                const allowed = checkCommonExceptions(targetUrl);
                return allowed ? { allowed: true } : { allowed: false, reason: 'not in common exceptions' };
            };

            guest.setWindowOpenHandler(({ url }) => {
                const { allowed, reason } = getAllowResult(url);
                if (allowed) {
                    log.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed window.open to`, url);
                    guest.loadURL(url); // Open in same webview
                    return { action: 'deny' };
                } else {
                    log.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked window.open to`, url, "-", reason);
                    return { action: 'deny' };
                }
            });

            guest.on('will-navigate', (e, url) => {
                const { allowed, reason } = getAllowResult(url);
                if (!allowed) {
                    log.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked navigation to`, url, "-", reason);
                    e.preventDefault();
                    guest.stop();
                } else {
                    log.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed navigation to`, url);
                }
            });

            if (mode === 'eduvidual') {
                attachEduvidualMoodleProofHeaders(guest, { moodleDomain, moodleTestId, exammode, sebConfigHash, sebBekHash });
            }

            return true;
        });

        // Alias for eduvidual mode - redirects to unified handler
        ipcMain.handle('start-blocking-for-eduvidual-webview', (event, { guestId, moodleTestId, moodleDomain }) => {
            // Call the unified handler with eduvidual mode
            const unifiedHandler = ipcMain.listeners('start-blocking-for-website-webview')[0];
            if (unifiedHandler) {
                return unifiedHandler(event, { guestId, mode: 'eduvidual', moodleTestId, moodleDomain });
            }
            return false;
        });
          

        /**
         * Reload the browser view
         */
        ipcMain.handle('reload-browser-view', (event, url) => {
            const browserView = this.WindowHandler.getMs365BrowserView();
            if (!browserView) return;
            browserView.webContents.loadURL(url);
        });
























        /**
         * Start languageTool API Server (with Java JRE)
         * Runs at localhost 8088
        */ 
        ipcMain.handle('startLanguageTool', (event) => { 
            try{
                languageToolServer.startServer();
            }
            catch(err){
                return false
            }
            return true
        }) 


        /**
         * activate spellcheck on demand for specific student
         */ 
        ipcMain.on('startLanguageTool', (event) => {  
            try{
                languageToolServer.startServer();
            }
            catch(err){
                return false
            }
            return true
        })

        /**
         * Check if LanguageTool server responds on configured port (optional host/port from renderer toggle)
         */ 
        ipcMain.handle('isLanguageToolRunning', async (_event, opts = {}) => {
            const port = parseInt(String(opts.port ?? languageToolServer.port ?? 8088), 10) || 8088;
            const hostRaw = opts.host ? String(opts.host).trim() : '';
            if (!hostRaw) {
                const hosts = ['127.0.0.1', '::1', 'localhost'];
                const results = await Promise.all(hosts.map(host => checkPortOpen(port, host, 2500)));
                const successResult = results.find(result => result.running);
                return successResult || results[results.length - 1];
            }
            let hostOnly = hostRaw.replace(/^https?:\/\//i, '').split('/')[0];
            const colonIdx = hostOnly.lastIndexOf(':');
            if (colonIdx > 0 && /^\d+$/.test(hostOnly.slice(colonIdx + 1))) {
                hostOnly = hostOnly.slice(0, colonIdx);
            }
            return checkPortOpen(port, hostOnly, 2500);
        })

        /**
         * Resolve a hostname to an IPv4 address for LanguageTool configuration
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
                log.warn('ipchandler @ resolveHostToIp: failed', host, err?.message);
                return { ok: false, ip: null, error: err?.message || 'lookup-failed' };
            }
        })




        /**
         *  Start LOCAL Lockdown
         */
        ipcMain.on('locallockdown', (event, args) => {
            log.info("ipchandler @ locallockdown: locking down client without teacher connection", args)
            
            let serverstatus = {
                exammode: true,
                delfolderonexit: false,
                screenshotinterval: 0,
                screenslocked: false,
                pin: '0000',
                password: args.password,
                useExamSections: false,
                activeSection: 1,
                lockedSection: 1,
                examSections: {
                    1: {
                        examtype: args.exammode,
                        sectionname: 'Local',
                        groups: false,
                        groupA: {
                            users: [],
                            examInstructionFiles: [],
                            allowedUrls: [],
                            examConfig: {
                                editor: {
                                    ...DEFAULT_EDITOR_EXAM_CONFIG,
                                    languagetool: args.languagetool || false,
                                    spellchecklang: args.spellchecklang || 'de-DE',
                                    suggestions: args.suggestions || false,
                                    audioRepeat: '3',
                                },
                                activeSheets: {},
                                eduvidual: {},
                                forms: {},
                                website: {},
                                math: {},
                                microsoft365: {},
                                rdp: {},
                                localvm: {},
                            },
                        },
                        groupB: {
                            users: [],
                            examInstructionFiles: [],
                            allowedUrls: [],
                            examConfig: {
                                editor: { ...DEFAULT_EDITOR_EXAM_CONFIG, audioRepeat: '3' },
                                activeSheets: {},
                                eduvidual: {},
                                forms: {},
                                website: {},
                                math: {},
                                microsoft365: {},
                                rdp: {},
                                localvm: {},
                            },
                        },
                    }
                }
            }
            
            // make serverstatus available for getinfoasync() so the renderer (editor) sees password and examSections
            this.multicastClient.serverstatus = serverstatus;

            this.multicastClient.clientinfo.name = normalizeStudentClientName(args.clientname);
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
         * Registers virtualized status from preload (WebGL + backend findings combined)
         */
        ipcMain.on('virtualized', (event, payload = {}) => {
            this.multicastClient.clientinfo.virtualized = true;
            this.multicastClient.clientinfo.vmFindings = payload.backend ?? getVMFindings();
            this.multicastClient.clientinfo.webglFindings = payload.webgl ?? null;
        })


        /**
         * Set FOCUS state to false (mouse left exam window)
         */ 
        ipcMain.handle('focuslost', (event, ctrlalt=false) => {
            let answer = false
            if (platformDispatcher.runningInCage) {
                return { sender: 'client', focus: true };
            }
            // macOS AAC assessment mode owns the lockdown; ignore mouseleave-driven focus loss
            if (isAssessmentSessionActive()) {
                return { sender: 'client', focus: true };
            }
            if (this.config.development || !this.multicastClient.clientinfo.exammode) { 
                log.info(`ipchandler @ focuslost: focuslost event was triggered but development mode is enabled or exammode is false`)
          
                answer = { sender: "client", focus: true}
                
            }
            // else if (this.WindowHandler.screenlockwindows.length > 0) { 
            //     log.info(`ipchandler @ focuslost: focuslost event was triggered but screenlockwindows is not empty`)
            //     answer = { sender: "client", focus: true }
                
            // }
            // else if (this.WindowHandler.focusTargetAllowed && ctrlalt == false){ 
            //     log.warn(`ipchandler @ focuslost: mouseleave event was triggered but target is allowed`)
            //     answer = { sender: "client", focus: true }
                
            // } 
            else {
                log.warn(`ipchandler @ focuslost: focuslost event was triggered - locking down`)
                const examWin = this.WindowHandler.mainWin();
                if (examWin) {
                    examWin.moveTop();
                    this.WindowHandler.applyElectronKioskMode(examWin);
                    examWin.show();
                    examWin.focus();
                }
    
                this.multicastClient.clientinfo.focus = false;
                answer = { sender: "client", focus: false }
            }
           
            return answer
        } )

        /**
         * Force FOCUS state to false (security incident)
         */
        ipcMain.handle('securityFocusLost', (event, payload = {}) => {
            const reason = payload?.reason || 'unknown';
            const message = payload?.message || '';
            log.warn(`ipchandler @ securityFocusLost: forcing lockdown (reason=${reason})`);

            const examWin = this.WindowHandler?.mainWin();
            if (examWin && !this.config.development) {
                examWin.moveTop();
                this.WindowHandler.applyElectronKioskMode(examWin);
                examWin.show();
                examWin.focus();
            }

            if (this.multicastClient?.clientinfo) {
                setClientFocusLock(this.multicastClient.clientinfo, reason, message);
            }

            if (examWin?.webContents && !examWin.webContents.isDestroyed()) {
                examWin.webContents.send('focusLock', { reason, message });
            }

            return { sender: "client", focus: false, reason };
        })

        /**
         * Restore focus state locally (LocalLockdown unlock)
         */
        ipcMain.handle('restorefocusstateLocal', async () => {
            if (!this.multicastClient?.clientinfo?.localLockdown) {
                return { ok: false, reason: 'not-local-lockdown' };
            }

            clearClientFocusLock(this.multicastClient.clientinfo);
            this.multicastClient.clientinfo.focus = true;

            const examWin = this.WindowHandler?.mainWin();
            if (examWin && !this.config.development) {
                examWin.moveTop();
                this.WindowHandler.applyElectronKioskMode(examWin);
                examWin.show();
                examWin.focus();
            }

            return { ok: true };
        })

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
            disableRestrictions(this.WindowHandler.mainWin()) 
        } )


        /**
        * copy to global clipboard
        */ 
        ipcMain.on('clipboard', (event, text) => {  
            clipboard.writeText(text)
        } )



        /**
         * re-check hostip and enable multicast client (mirrors teacher logic with availableInterfaces and preferredInterface)
         */ 
        ipcMain.handle('checkhostip', async (event) => { 
            const interfaces = networkInterfaces();
            this.availableInterfaces = null;

            // Collect all IPv4 addresses
            Object.keys(interfaces).forEach((interfaceName) => {
                // Filter out bridge (br*) and vpn (vpn*) interfaces by name
                if (interfaceName.startsWith('br') || interfaceName.startsWith('vpn')) { return }
                interfaces[interfaceName].forEach((iface) => {
                    if (iface.family === 'IPv4' &&
                        !iface.address.startsWith('127.') &&
                        !iface.address.startsWith('169.254.')) {
                        if (!this.availableInterfaces) {
                            this.availableInterfaces = [];
                        }
                        this.availableInterfaces.push({
                            name: interfaceName,
                            address: iface.address
                        });
                    }
                });
            });

            const oldHostIp = this.config.hostip;

            // If a preferred interface is set, use it
            if (this.preferredInterface) {
                const preferred = this.availableInterfaces?.find(iface => iface.name === this.preferredInterface);
                if (preferred) {
                    this.config.hostip = preferred.address;
                    this.config.interface = preferred.name;
                    try {
                        const { gateway, version, int } = gateway4sync(preferred.name);
                        this.config.gateway = int === this.preferredInterface;
                    } catch (e) {
                        this.config.gateway = false;
                    }
                }
            } else {
                try {
                    const { gateway, version, int } = gateway4sync();
                    this.config.hostip = ip.address(int);
                    this.config.interface = int;
                    this.config.gateway = true;
                } catch (e) {
                    this.config.hostip = false;
                    this.config.gateway = false;
                }

                if (!this.config.hostip) {
                    try {
                        this.config.hostip = ip.address();
                        const interfaceName = Object.keys(interfaces).find(key => interfaces[key].some(iface => iface.address === this.config.hostip));
                        this.config.interface = interfaceName;
                    } catch (e) {
                        log.error("ipcHandler @ checkhostip: Unable to determine ip address", e);
                        this.config.hostip = false;
                        this.config.gateway = false;
                        this.config.interface = false;
                    }
                }
            }

            if (this.config.hostip === "127.0.0.1") { this.config.hostip = false; }

            // Reinitialize multicast client on IP change (pass oldHostIp so dropMembership uses correct interface)
            if (oldHostIp !== this.config.hostip && this.config.hostip) {
                log.info(`ipcHandler @ checkhostip: IP changed from ${oldHostIp} to ${this.config.hostip}, reinitializing multicast client...`);
                let mcRunning = false;
                try { mcRunning = !!this.multicastClient?.client?.address?.(); } catch (e) {}
                try {
                    if (mcRunning) await this.multicastClient.stop(oldHostIp);
                    this.multicastClient.init(this.config.gateway);
                    log.info('ipcHandler @ checkhostip: Multicast client reinitialized');
                } 
                catch (e) {
                    log.error('ipcHandler @ checkhostip: Failed to reinitialize multicast client:', e);
                }
            } 
            else if (this.config.hostip) {
                // Initialize multicast client if not running (skip when we just reinitialized above)
                let address = false;
                try { address = this.multicastClient?.client?.address?.(); } catch (e) {}
                if (!address) {
                    try {
                        await this.multicastClient.init(this.config.gateway);
                    } 
                    catch (err) {
                        log.error("ipcHandler @ checkhostip: Error initializing multicast client", err);
                    }
                }
            }

            return { 
                hostip: this.config.hostip, 
                interface: this.config.interface,
                availableInterfaces: this.availableInterfaces || [],
                preferredInterface: this.preferredInterface 
            };
        });

        // Set preferred network interface for multicast binding
        ipcMain.handle('setPreferredInterface', (event, arg) => {
            this.preferredInterface = arg;
        });





        /**
         * Store content from editor as html file - as backup - only triggered by the teacher for now (allow manual backup !!)
         * @param args contains an object with  { filename, editorcontent, reason?: 'auto'|'manual'|'teacherrequest'|... }
         */
        ipcMain.on('storeHTML', (event, args) => {   
            const htmlContent = args.editorcontent
            const filename = args.filename
            const saveReason = typeof args.reason === 'string' ? args.reason : 'n/a'
            let htmlfilename = `${this.multicastClient.clientinfo.name}.htm`
            
            if (filename && String(filename).trim()){
                htmlfilename = `${String(filename).trim()}.htm`
            }

            const htmlfile = resolveWritablePathUnderExamDir(this.config.examdirectory, htmlfilename, ['.htm']);
            if (!htmlfile) {
                log.warn(`ipchandler @ storeHTML: rejected unsafe html filename (${htmlfilename})`);
                return;
            }

            if (htmlContent) { 
                // log.info("ipchandler: storeHTML: saving students work to disk...")
                try {
                    const pw = resolveExamDecryptPassword(this.multicastClient);
                    const buf = Buffer.from(String(htmlContent), 'utf8');
                    const out = encryptExamFileBytesUnlessAlready(buf, pw);
                    if (pw) logSaveInfoUnlessAuto(saveReason, `ipchandler @ storeHTML: encrypted write ${htmlfilename} saveReason=${saveReason}`);
                    else logSaveInfoUnlessAuto(saveReason, `ipchandler @ storeHTML: plaintext write ${htmlfilename} saveReason=${saveReason}`);
                    const ch = this.CommunicationHandler
                    fs.writeFile(htmlfile, out, (err) => { 
                        if (err) {
                            log.error(`ipchandler @ storeHTML: ${err.message}`); 
                        
                            let alternatepath = resolveWritablePathUnderExamDir(this.config.examdirectory, `${path.basename(htmlfile, '.htm')}-${this.multicastClient.clientinfo.token}.htm`, ['.htm']);
                            if (!alternatepath) {
                                log.error("ipchandler @ storeHTML: alternate path rejected");
                                event.reply("fileerror", { sender: "client", message: "invalid alternate path", status: "error" });
                                return;
                            }
                            log.warn("ipchandler @ storeHTML: trying to write file as:", alternatepath )
                            fs.writeFile(alternatepath, out, (err2) => { 
                                if (err2) {
                                    log.error(err2.message);
                                    log.error("ipchandler @ storeHTML: giving up"); 
                                    event.reply("fileerror", { sender: "client", message:err2 , status:"error" } )
                                }
                                else {
                                    if (ch) ch.lastExamWriteSaveReason = saveReason
                                    logSaveInfoUnlessAuto(saveReason, "ipchandler @ storeHTML: success!");
                                    event.reply("loadfilelist")
                                }
                            }); 
                        } else {
                            if (ch) ch.lastExamWriteSaveReason = saveReason
                            event.reply("loadfilelist")
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
         * get base64 encoded pdf from editor
         */ 
        ipcMain.handle('getPDFbase64', async (event, args) => {
            const saveReason = typeof args.reason === 'string' ? args.reason : ''
            logSaveInfoUnlessAuto(saveReason, "ipchandler @ getPDFbase64: getting base64 encoded pdf")
            this.multicastClient.clientinfo.submissionnumber = args.submissionnumber+1 // clientinfo keeps track of submissions for automated submissionnumbers at section change - but this obviously happens after manual submit
            // pageMode='fullpage' => activesheets: A4 ohne Margins/Header/Footer + Header als HTML-Overlay
            let result = await this.CommunicationHandler.getBase64PDF(args.submissionnumber, args.sectionname, args.printBackground, saveReason, args.pageMode)   // why the hell is this function located in communicationhandler.js and not in ipchandler.js ? FIXME !
            return result
        })

        ipcMain.handle('setBipSiteInfo', (_event, info = {}) => {
            return this.CommunicationHandler.setBipSiteInfo(info)
        })

        ipcMain.handle('clearBipSiteInfo', () => {
            return this.CommunicationHandler.clearBipSiteInfo()
        })

        ipcMain.handle('prewarmSubmissionSigningP12', () => {
            return this.CommunicationHandler.prewarmSubmissionSigningP12()
        })




        /**
         * Stores the ExamWindow content as PDF
         * ATTENTION there is a similar method in communicationhandler.js that also generates a pdf but retuns a base64 version of the pdf
         * @param args.reason optional save trigger label for logs and teacher ZIP metadata (e.g. auto, manual, teacherrequest)
         */ 
        ipcMain.on('printpdf', (event, args) => { 
            const saveReason = typeof args.reason === 'string' ? args.reason : 'n/a'
            // do not print if exam mode is not active anymore
            if (!this.multicastClient?.clientinfo?.exammode){
                log.warn("ipchandler @ printpdf: exammode is false - skipping print")
                return
            }

            if (this.isPrintingPdf){
                log.warn("ipchandler @ printpdf: print already in progress - skipping new request")
                return
            }

            const examWindow = this.WindowHandler.mainWin();
            if (examWindow){
                const options = { // define print options
                    margins: {top:0.5, right:0, bottom:0.5, left:0 },
                    pageSize: 'A4',
                    printBackground: false,
                    printSelectionOnly: false,
                    landscape: args.landscape,
                    displayHeaderFooter:true,
                    footerTemplate: "<div style='height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-bottom:10px;'><span class=pageNumber></span>|<span class=totalPages></span></div>",
                    headerTemplate: `<div style='display: inline-block; height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-left: 30px; margin-top:10px;'><span style="float:left;">${args.servername}</span><span style="float:left;">&nbsp;|&nbsp; </span><span class=date style="float:left;"></span><span style="float:right;">${args.clientname}</span></div>`,
                    preferCSSPageSize: false
                }

                let pdffilename = `${this.multicastClient.clientinfo.name}.pdf`  // default filename = clientname.pdf
                if (args.filename){  // in case of manual backup the user can set a custom filename
                    pdffilename = `${args.filename}.pdf`
                    
                }
                const pdffilepath = resolveWritablePathUnderExamDir(this.config.examdirectory, pdffilename, ['.pdf']);  // path points to the current exam directory
                if (!pdffilepath) {
                    log.warn(`ipchandler @ printpdf: rejected unsafe pdf filename (${pdffilename})`);
                    event.reply("fileerror", { sender: "client", message: "invalid pdf filename", status: "error" } );
                    return;
                }
                const alternatefilename = `${path.basename(pdffilename, '.pdf')}-aux.pdf`    //thomas.pdf-aux.pdf 
                const alternatebackupfilename = `${path.basename(pdffilename, '.pdf')}-old.pdf`;   //thomas.pdf-old.pdf
                const alternatepath = resolveWritablePathUnderExamDir(this.config.examdirectory, alternatefilename, ['.pdf']);  // if something goes wrong we try to write a different file
                if (!alternatepath) {
                    log.warn(`ipchandler @ printpdf: rejected alternate pdf path (${alternatefilename})`);
                    event.reply("fileerror", { sender: "client", message: "invalid alternate pdf path", status: "error" } );
                    return;
                }


                // aux files are files created if the main pdffilepath is not writeable (opened on windows) 
                try {  // always check for old aux files and rename them
                    const files = fs.readdirSync(this.config.examdirectory);
                    files.forEach(file => {
                        if (file === alternatefilename) {
                            const newPath = resolveWritablePathUnderExamDir(this.config.examdirectory, alternatebackupfilename, ['.pdf']);
                            if (newPath) {
                                fs.renameSync(alternatepath, newPath);
                            }
                        }
                    });
                } 
                catch(err) { log.error(`ipchandler @ printpdf: ${err.message}`);  }

                const webContents = examWindow.webContents
                const ch = this.CommunicationHandler

                if (!webContents){
                    log.error("ipchandler @ printpdf: no webContents found for examwindow")
                    event.reply("fileerror", { sender: "client", message:"no webContents found for examwindow" , status:"error" } )
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
                    try { if (fs.existsSync(pdffilepath)) { fs.unlinkSync(pdffilepath); }}
                    catch(err) { log.error(`ipchandler @ printpdf: ${err.message}`);  }
                    // write the pdf to the exam directory
                    const pw = resolveExamDecryptPassword(this.multicastClient);
                    const out = encryptExamFileBytesUnlessAlready(Buffer.from(data), pw);
                    if (pw) logSaveInfoUnlessAuto(saveReason, `ipchandler @ printpdf: encrypted write ${pdffilename} saveReason=${saveReason}`);
                    else logSaveInfoUnlessAuto(saveReason, `ipchandler @ printpdf: plaintext write ${pdffilename} saveReason=${saveReason}`);
                    fs.writeFile(pdffilepath, out, (err) => { 
                        if (err) {
                            log.warn(`ipchandler @ printpdf: ${err.message} - writing file as: ${alternatepath} `); 
                            // delete the old aux file if it exists
                            try { if (fs.existsSync(alternatepath)) { fs.unlinkSync(alternatepath); } }
                            catch (err) { log.error(`ipchandler @ printpdf (alternativer Pfad): ${err.message}`); }
                            // write the pdf to the alternate path
                            if (pw) logSaveInfoUnlessAuto(saveReason, `ipchandler @ printpdf: encrypted write ${alternatefilename} saveReason=${saveReason}`);
                            else logSaveInfoUnlessAuto(saveReason, `ipchandler @ printpdf: plaintext write ${alternatefilename} saveReason=${saveReason}`);
                            fs.writeFile(alternatepath, out, (err) => { 
                                if (err) {
                                    log.error(err.message);
                                    log.error("ipchandler @ printpdf: giving up"); 
                                    event.reply("fileerror", { sender: "client", message:err.message , status:"error" } )
                                }
                                else { // log.info("ipchandler @ printpdf: success!");
                                    if (ch) ch.lastExamWriteSaveReason = saveReason
                                    if (args.reason === "teacherrequest") { this.CommunicationHandler.sendToTeacher() }
                                    event.reply("loadfilelist")
                                }
                            }); 
                        }
                        else { // log.info("ipchandler @ printpdf: success!");
                            if (ch) ch.lastExamWriteSaveReason = saveReason
                            if (args.reason === "teacherrequest") { this.CommunicationHandler.sendToTeacher() }
                            event.reply("loadfilelist")   //make sure students see the new file immediately
                        }
                    } ); 
                }).catch(error => { 
                    log.error(`ipchandler @ printpdf: ${error.message}`)
                    event.reply("fileerror", { sender: "client", message:error.message , status:"error" } )
                }).finally(() => {
                    this.isPrintingPdf = false
                });
            }
        })

        /**
         * Saves Active Sheets form data to .htm file
         */
        ipcMain.on('saveActivesheetsBak', (event, args) => {
            try {
                const saveReason = typeof args.reason === 'string' ? args.reason : 'n/a'
                const htmFilename = args.filename ? `${args.filename}.htm` : `${this.multicastClient.clientinfo.name}.htm`;
                const htmFilePath = resolveWritablePathUnderExamDir(this.config.examdirectory, htmFilename, ['.htm']);
                if (!htmFilePath) {
                    log.warn(`ipchandler @ saveActivesheetsBak: rejected unsafe filename (${htmFilename})`);
                    event.reply("fileerror", { sender: "client", message: "invalid backup filename", status: "error" });
                    return;
                }
                
                // Convert formData to JSON string
                const jsonData = JSON.stringify(args.formData, null, 2);
                
                // Write to .htm file
                const pw = resolveExamDecryptPassword(this.multicastClient);
                const out = encryptExamFileBytesUnlessAlready(Buffer.from(jsonData, 'utf8'), pw);
                if (pw) logSaveInfoUnlessAuto(saveReason, `ipchandler @ saveActivesheetsBak: encrypted write ${htmFilename}`);
                else logSaveInfoUnlessAuto(saveReason, `ipchandler @ saveActivesheetsBak: plaintext write ${htmFilename}`);
                fs.writeFileSync(htmFilePath, out);
                logSaveInfoUnlessAuto(saveReason, `ipchandler @ saveActivesheetsBak: saved form data to ${htmFilename}`);
            } catch (error) {
                log.error(`ipchandler @ saveActivesheetsBak: ${error.message}`);
                event.reply("fileerror", { sender: "client", message: error.message, status: "error" });
            }
        })




        /**
         * Returns all found Servers and the information about this client
         */ 
        ipcMain.handle('getinfoasync', async (event) => {   
            syncClientDisplayInfo(this.multicastClient.clientinfo);
            syncAllowedKioskAppsClientinfo(this.multicastClient.clientinfo);
            let serverstatus = false   
            // serverstatus object is only passed to the exam window at the start of the exam for base settings
            // all further updates via the serverstatus object are read in the communication handler and applied to the clientinfo object as needed
            // this communication flow needs to be streamlined in 2.0 #FIXME
            
            if (this.multicastClient?.serverstatus) { serverstatus = this.multicastClient.serverstatus }

            //count number of files in exam directory
            if (!this.multicastClient.clientinfo.exammode){
                const workdir = path.join(config.examdirectory, "/")
                try {
                    await fs.promises.mkdir(workdir, { recursive: true })  // creates if missing
                    const filelist = (await fs.promises.readdir(workdir, { withFileTypes: true }))
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
        })

        // Screenshot config for frontend scheduler (serverip, port, clientinfo, interval)
        ipcMain.handle('getScreenshotConfig', async () => {
            const ci = this.multicastClient.clientinfo;
            return {
                serverip: ci.serverip,
                serverApiPort: this.config.serverApiPort,
                clientinfo: { ...ci },
                screenshotinterval: ci.screenshotinterval
            };
        })

        // Student-initiated section switch when allowSectionSwitch is true; always uses current serverstatus and section number
        ipcMain.handle('switch-exam-section', async (event, sectionNumber) => {
            const serverstatus = this.multicastClient.serverstatus;
            if (!serverstatus?.useExamSections || !serverstatus?.allowSectionSwitch) return;
            if (!this.multicastClient.clientinfo.exammode) return;
            if (this.multicastClient.clientinfo.lockedSection === sectionNumber) return;
            log.info(`ipchandler @ switch-exam-section: switching to section ${sectionNumber}`)
            await switchExamSection(this.CommunicationHandler, serverstatus, sectionNumber);
        })

        /**
         * because of microsoft 365 we need to work with "BrowserView" 
         * in order to be able to dislay fullscreen information from the Exam header we temporarily collapse the BrowserView for Office
         * and restore it afterwards - not perfect but looks ok
         */ 
        ipcMain.on('collapse-browserview', () => {
            this.WindowHandler.collapseMs365BrowserView()
        });
        ipcMain.on('restore-browserview', () => {
            this.WindowHandler.restoreMs365BrowserView()
        });

        /**
         * Update menu height dynamically when header content changes
         */
        ipcMain.on('update-menu-height', (event, height) => {
            const mainWindow = this.WindowHandler.mainWin();
            if (mainWindow && height > 0) {
                mainWindow.menuHeight = height;
                const newBounds = mainWindow.getBounds();
                const contentView = this.WindowHandler.getMs365BrowserView(mainWindow);
                if (contentView) {
                    contentView.setBounds({
                        x: 0,
                        y: height,
                        width: newBounds.width,
                        height: Math.max(0, newBounds.height - height),
                    });
                }
            }
        });



        /**
         * Sends a register request to the given server ip
         * @param args contains an object with  clientname:this.username, servername:servername, serverip, serverip, pin:this.pincode 
         */
        ipcMain.on('register', (event, args) => {   
            const clientname = normalizeStudentClientName(args.clientname)
            const pin = args.pin
            const serverip = args.serverip
            const servername = args.servername
            const clientip = this.config.hostip || ip.address()
            const hostname = os.hostname()
            const version = this.config.version
            const bipuserID = args.bipuserID

            if (this.multicastClient.clientinfo.token){ //#FIXME this should actually come from the server
                event.returnValue = { sender: "client", message: t("control.alreadyregistered"), status:"error" }
            }

            syncClientDisplayInfo(this.multicastClient.clientinfo);
            if (this.multicastClient.clientinfo.multiMonitor && !this.config.development) {
                event.returnValue = { status: "error", message: t("student.multimonitor") };
                return;
            }

            // Encrypt the registration payload and derive sessionRef from the pin.
            let payload = { pin, clientname, clientip, hostname, version, bipuserID, exammode: this.multicastClient.clientinfo.exammode === true }
            const url = `https://${serverip}:${this.config.serverApiPort}/server/control/registerclient/${servername}`;
            const signal = AbortSignal.timeout(8000); // 8000 milliseconds = 8 second AbortSignal timeout


            this.prepareSecurePayload(payload, pin)
            .then(packet => {
                payload = null;
                return examApiFetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packet }) });
            })
            .then(response => response.json()) 
            .then(data => {
                if (data && data.status == "success") {  // registration successfull otherwise data would be "false"
                    // Successful registration
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

                    // Notify renderer (main window) so screenshot scheduler can start immediately on successful connect
                    try {
                        this.WindowHandler.mainwindow?.webContents?.send('screenshot-config', {
                            screenshotinterval: this.multicastClient.clientinfo.screenshotinterval,
                            serverip: this.multicastClient.clientinfo.serverip
                        });
                    } catch (e) {
                        log.debug('ipchandler @ register: screenshot-config send', e?.message);
                    }

                    //create exam folder in workfolder
                    let uniqueexamName = `${servername}-${pin}`
                    config.examdirectory = path.join(config.workdirectory, uniqueexamName)
                    if (!fs.existsSync(config.examdirectory)){ fs.mkdirSync(config.examdirectory, { recursive: true }); }
                } 
                else {
                    if (data.version){
                        // compare versions and display message (teacher needs upgrade.. client needs upgrade)
                        const comparisonResult = this.compareSoftware(config.version, config.info , data.version, data.versioninfo ) //serverVersion, serverStatus, localVersion, localStatus
                        if (comparisonResult > 0) {       event.returnValue = { status: "error", message: t("student.versionNewer") };   }
                        else if (comparisonResult < 0) {  event.returnValue = { status: "error", message: t("student.versionOld") };   }
                        else {                            event.returnValue = { status: "error", message: t("student.versionUnknown") };    }
                    }
                    event.returnValue = { status: "error", message: data.message };
                }
            })
            .catch(async error => {
                // Error handling
                let errorMessage = error.message;
                if (error.name === 'AbortError') { errorMessage = "The request timed out";   }
                log.error(`ipchandler @ register: ${errorMessage}`);
             
                // on macos the permission settings in rare cases mess up the ability to fetch the teacher api 
                // check for network permissions on macOS and reset them if needed
                if (process.platform === "darwin"){    
                    let response = await ensureNetworkOrReset(serverip, this.config.serverApiPort); 
                    if (response && response === "reset") {   // quit the app if the user wants to reset the permissions
                        app.quit();
                        return
                    }
                }
                
                // show warning message if the user does not want to reset the permissions
                event.returnValue = { sender: "client", message: t("student.networkError"), status: "error" };
                return;  
                    
                
            });
        })






        /**
         * Store content from Geogebra as ggb file - as backup 
         * @param args contains an object with  { filename, content: base64, reason?: 'auto'|'manual'|'teacherrequest'|... }
         */
        ipcMain.handle('saveGGB', (event, args) => {   
            const content = args.content
            const filename = args.filename
            const saveReason = typeof args.reason === 'string' ? args.reason : 'n/a'
            const ggbFilePath = resolveWritablePathUnderExamDir(this.config.examdirectory, filename, ['.ggb']);
            if (!ggbFilePath) {
                log.warn(`ipchandler @ saveGGB: rejected unsafe ggb filename (${filename})`);
                return { sender: "client", message: "invalid filename", status: "error" };
            }
            if (content) { 
                //log.info("ipchandler @ saveGGB: saving students work to disk...")
                const fileData = Buffer.from(content, 'base64');

                try {
                    const pw = resolveExamDecryptPassword(this.multicastClient);
                    const out = encryptExamFileBytesUnlessAlready(fileData, pw);
                    if (pw) logSaveInfoUnlessAuto(saveReason, `ipchandler @ saveGGB: encrypted write ${filename} saveReason=${saveReason}`);
                    else logSaveInfoUnlessAuto(saveReason, `ipchandler @ saveGGB: plaintext write ${filename} saveReason=${saveReason}`);
                    fs.writeFileSync(ggbFilePath, out);
                    if (this.CommunicationHandler) this.CommunicationHandler.lastExamWriteSaveReason = saveReason
                    if (args.reason === "teacherrequest") { this.CommunicationHandler.sendToTeacher() }
                    return  { sender: "client", message:t("data.filestored") , status:"success" }
                }
                catch(err){
                    if (this.multicastClient.clientinfo.exammode) {
                        this.WindowHandler.mainWin()?.webContents?.send('fileerror', err)
                    }  
                 
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
            const ggbFilePath = resolveWritablePathUnderExamDir(this.config.examdirectory, filename, ['.ggb']);
            if (!ggbFilePath) {
                log.warn(`ipchandler @ loadGGB: rejected unsafe ggb filename (${filename})`);
                return { sender: "client", content: false , status:"error" };
            }
            try {
                // Read the file and convert it to base64
                const pw = resolveExamDecryptPassword(this.multicastClient);
                const raw = fs.readFileSync(ggbFilePath);
                const isEnc = isExamFileEncryptedBytes(raw);
                if (isEnc && pw) log.info(`ipchandler @ loadGGB: decrypted read ${filename}`);
                const fileData = (isEnc && pw) ? decryptExamFileAllLayers(raw, pw) : raw;
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
                const allowed = image ? ['.jpg', '.jpeg', '.png', '.gif'] : ['.pdf'];
                let filepath = resolveWritablePathUnderExamDir(config.examdirectory, filename, allowed);
                if (!filepath) {
                    log.warn(`ipchandler @ getpdfasync: rejected unsafe filename (${filename})`);
                    return { sender: "client", content: false , status:"error" };
                }
                try {
                    const pw = resolveExamDecryptPassword(this.multicastClient);
                    const raw = fs.readFileSync(filepath)
                    const isEnc = isExamFileEncryptedBytes(raw);
                    if (isEnc && pw) log.info(`ipchandler @ getpdfasync: decrypted read ${filename}`);
                    const data = (isEnc && pw) ? decryptExamFileAllLayers(raw, pw) : raw
                   
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
                let filepath = resolveWritablePathUnderExamDir(config.examdirectory, filename, ['.mp3', '.ogg', '.wav']);
                if (!filepath) {
                    log.warn(`ipchandler @ getAudioFile: rejected unsafe exam audio filename (${filename})`);
                    return false;
                }
                const audioData = fs.readFileSync(filepath);
                return audioData.toString('base64');
            }
        
            if (filename && publicdir) {
                const publicBase = platformDispatcher.publicBase;
                let filepath = resolveWritablePathUnderExamDir(publicBase, filename, ['.mp3', '.ogg', '.wav']);
                if (!filepath) {
                    log.warn(`ipchandler @ getAudioFile: rejected unsafe public audio filename (${filename})`);
                    return false;
                }
                const audioData = fs.readFileSync(filepath);
                return audioData.toString('base64');
            }
        
            return false;
        });
 

        /**
         * ASYNC GET FILE-LIST from examdirectory
         * @param filename if set the content of the file is returned
         */ 
        ipcMain.handle('getfilesasync', async (event, filename, audio=false, docx=false, odtRaw=false) => {   
            const workdir = path.join(config.examdirectory,"/")

            if (filename) { //return content of specific file as string (html) to replace in editor)
                // console.log("Received arguments:", filename, audio, docx);
                const allowedList = audio === true
                    ? ['.mp3', '.ogg', '.wav']
                    : (docx ? ['.docx'] : odtRaw ? ['.odt'] : ['.htm']);
                let filepath = resolveWritablePathUnderExamDir(config.examdirectory, filename, allowedList);
                if (!filepath) {
                    log.warn(`ipchandler @ getfilesasync: rejected unsafe filename (${filename})`);
                    return false;
                }
                const pw = resolveExamDecryptPassword(this.multicastClient);
                // Helper to transparently decrypt encrypted exam files. 
                const readMaybeDecrypt = () => {
                    const raw = fs.readFileSync(filepath);
                    const isEnc = isExamFileEncryptedBytes(raw);
                    if (isEnc && pw) log.info(`ipchandler @ getfilesasync: decrypted read ${filename}`);
                    return (isEnc && pw) ? decryptExamFileAllLayers(raw, pw) : raw;
                };

                if (audio == true){ // audio file
                    const audioData = readMaybeDecrypt();
                    return audioData.toString('base64');
                }
                else if (docx){  //office open xml file
                    const raw = fs.readFileSync(filepath);
                    const pwDoc = resolveExamDecryptPassword(this.multicastClient);
                    const isEnc = isExamFileEncryptedBytes(raw);
                    if (isEnc && pwDoc) log.info(`ipchandler @ getfilesasync: decrypted read ${filename}`);
                    const docxBuffer = (isEnc && pwDoc) ? decryptExamFileAllLayers(raw, pwDoc) : null;
                    let result = await mammoth.convertToHtml(docxBuffer ? { buffer: docxBuffer } : { path: filepath })
                    .then((data) => {
                        return data
                    })
                    .catch(function(error) {
                        console.error(error);
                    });
                    return result
                }
                else if (odtRaw) {
                    try {
                        const raw = readMaybeDecrypt();
                        return raw.toString('base64');
                    }
                    catch (err) {
                        log.error(`ipchandler @ getfilesasync odt: ${err}`); 
                        return false;
                    }
                }
                else {   //htm backup file
                    try {
                        const data = readMaybeDecrypt().toString('utf8');
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
                        else if  (path.extname(file).toLowerCase() === ".htm"){ files.push( {name: file, type: "htm", mod: mod})   }   // editor| backup file to replace editor content
                        else if  (path.extname(file).toLowerCase() === ".docx"){ files.push( {name: file, type: "docx", mod: mod})   }   // editor| content file (from teacher) to replace content and continue writing
                        else if  (path.extname(file).toLowerCase() === ".odt"){ files.push( {name: file, type: "odt", mod: mod})   }   // ODT → TipTap HTML in renderer
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
         * ASYNC GET BACKUP FILE from examdirectory
         * @param filename filename without
         */ 
        ipcMain.handle('getbackupfile', async (event, filename) => {   
            log.info(`ipchandler @ getbackupfile: Request received for filename: ${filename}`)
            if (!filename) {
                log.warn(`ipchandler @ getbackupfile: no filename provided`); 
                return false;
            }
            const filepath = resolveWritablePathUnderExamDir(config.examdirectory, filename, ['.htm']);
            if (!filepath) {
                log.warn(`ipchandler @ getbackupfile: rejected unsafe filename (${filename})`);
                return false;
            }
            log.info(`ipchandler @ getbackupfile: Full file path: ${filepath}`)
            try {
                log.info(`ipchandler @ getbackupfile: reading backup file`)
                let raw = await fs.promises.readFile(filepath);
                if (isExamFileEncryptedBytes(raw)) {
                    const pw = resolveExamDecryptPassword(this.multicastClient);
                    if (!pw) {
                        log.warn(`ipchandler @ getbackupfile: encrypted ${filename} but no key in serverstatus`);
                        return false;
                    }
                    try {
                        log.info(`ipchandler @ getbackupfile: decrypted read ${filename}`);
                        raw = await decryptExamFileAllLayersAsync(raw, pw);
                    } catch (e) {
                        log.error(`ipchandler @ getbackupfile: decrypt failed ${e?.message || e}`);
                        return false;
                    }
                }
                const data = raw.toString('utf8');
                log.info(`ipchandler @ getbackupfile: Successfully read backup file, content length: ${data.length}`)
                return data
            }
            catch (err) {
                if (err?.code === 'ENOENT') {
                    log.warn(`ipchandler @ getbackupfile: backup file not found: ${filepath}`); 
                    return false;
                }
                log.error(`ipchandler @ getbackupfile: Error reading backup file: ${err}`); 
                log.error(`ipchandler @ getbackupfile: Error stack: ${err.stack}`)
                return false
            }
        })

        /**
         * Read/write PDF annotation JSON files in the student examdirectory.
         * Stored visibly in: <examdirectory>/annotations/<key>.annotations.json
         */
        ipcMain.handle('readPdfAnnotations', async (_event, key) => {
            try {
                if (!key || typeof key !== 'string') return null;
                const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
                const dir = path.join(config.examdirectory, 'annotations');
                const filepath = path.join(dir, `${safeKey}.annotations.json`);
                if (!fs.existsSync(filepath)) return null;
                return fs.readFileSync(filepath, 'utf8');
            } catch (e) {
                log.error(`ipchandler @ readPdfAnnotations: ${e?.message || e}`);
                return null;
            }
        });

        ipcMain.handle('writePdfAnnotations', async (_event, key, jsonString) => {
            try {
                if (!key || typeof key !== 'string') return { status: 'error', message: 'invalid_key' };
                const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
                const dir = path.join(config.examdirectory, 'annotations');
                await fs.promises.mkdir(dir, { recursive: true });
                const filepath = path.join(dir, `${safeKey}.annotations.json`);
                // validate JSON before writing
                JSON.parse(jsonString);
                await fs.promises.writeFile(filepath, jsonString, 'utf8');
                return { status: 'success', filepath };
            } catch (e) {
                log.error(`ipchandler @ writePdfAnnotations: ${e?.message || e}`);
                return { status: 'error', message: e?.message || 'error' };
            }
        });

        ipcMain.on('reload-url', (event) => {
            this.WindowHandler.createEasterWin()
        });

         /**
         * Append PrintRequest to clientinfo  
         */ 
        ipcMain.on('sendPrintRequest', (event) => {   
            this.multicastClient.clientinfo.printrequest = true  //set this to false after the request left the client to prevent double triggering
            event.returnValue = true
        })
     
        ipcMain.on('get-cpu-info', (event) => {
            event.returnValue = getVMFindings()
        });



        ipcMain.handle('get-wlan-info', async (event) => {
            const wlanInfo = await getWlanInfo();
            return wlanInfo;
        });


        
        // New handler to get PDF from public directory for frontend parsing
        ipcMain.handle('getPdfFromPublic', async (event, pdfFilename ) => {
            try {
           
                let pdfPath;
                pdfPath = path.join(platformDispatcher.publicBase, pdfFilename);
                
                if (!fs.existsSync(pdfPath)) {
                    log.warn(`ipchandler @ getPdfFromPublic: PDF not found at: ${pdfPath}`);
                    return null;
                }
                
                const buffer = fs.readFileSync(pdfPath);
                return buffer.toString('base64');
            } catch (error) {
                log.error(`ipchandler @ getPdfFromPublic: Error: ${error.message}`, error);
                return null;
            }
        });


    }

    async prepareSecurePayload(data, sessionRef) {
        const PAD = '0'; 
        const enc = new TextEncoder(); // Initialize text encoder
        
        const raw = enc.encode((sessionRef + PAD).padEnd(32, '0').slice(0, 32));
        const k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']); // Import key for AES-GCM
        
        const iv = crypto.getRandomValues(new Uint8Array(12)); // Generate 12-byte random IV
        const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(data))); 
        
        return {
          v: btoa(String.fromCharCode(...iv)), 
          d: btoa(String.fromCharCode(...new Uint8Array(buf))) 
        };
      }


    compareVersions(versionA, versionB) {
        const partsA = versionA.split('.').map(Number);
        const partsB = versionB.split('.').map(Number);
    
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] || 0; // fallback to 0 if no value present
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
