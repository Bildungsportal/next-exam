import {isIOS} from "../../types/platform.js";
import loggingBridge from "../loggingBridge.js";
import {useInfoStore} from "../../stores/infoStore.js";
import { Buffer } from "buffer";
import sectionService from "./IosSectionService.js";
import fileService from "./IosExamFileService.js";
import pdfService from "./IosPdfService.js";
import submissionService from "./IosSubmissionService.js";
import signingService from "./IosSubmissionSigningService.js";
import {SECTION_SWITCH_SAVE_TIMEOUT_MS, isSectionSwitchRunning} from "../switchExamSection.ts";

// Longer than ExamHeader's 12 s overlay fallback so a still-running switch is detected.
const SECTION_SWITCH_WAIT_TIMEOUT_MS = 15000;

/**
 * Bridges the renderer's IPC signals (startExam / endExam / sendexam) to the iOS
 * services and exposes their methods to the renderer. Contains no iOS logic itself.
 */
class IosUpdateListener {
    // True while a sendexam request is being processed; further requests are ignored.
    private _sendExamRunning = false;

    async init(): Promise<void> {
        if (!isIOS()) {
            return;
        }
        globalThis.Buffer = Buffer;
        await useInfoStore().updateInfo();

        window.ipcRenderer.on('startExam', (serverstatus) => {
            loggingBridge.debug("iosUpdateListener @ startExam: message received");
            sectionService.startExam(serverstatus);
        });

        window.ipcRenderer.on('endExam', () => {
            loggingBridge.debug("iosUpdateListener @ endExam: received signal");
            sectionService.endExam();
        });

        window.ipcRenderer.on('sendexam', () => {
            this.handleSendExam();
        });

        window.ipcRenderer.on('fetchfiles', () => {
            fileService.requestFilesFromServer();
        });

        window.ipcRenderer.on('switching-exam-section', (payload) => {
            sectionService.performSectionSwitch(Number(Array.isArray(payload) ? payload[0] : payload));
        });
    }

    /**
     * Teacher requested the exam folder: wait for any running section switch, ask
     * the open exam page to save first (mirrors Electron sendExamToTeacher), then
     * upload the folder exactly once. A second request while one is running is ignored.
     */
    private async handleSendExam(): Promise<void> {
        if (this._sendExamRunning) {
            loggingBridge.info('iosUpdateListener @ sendexam: request ignored, previous send still running');
            return;
        }
        this._sendExamRunning = true;
        try {
            const switchFinished = await this.waitForSectionSwitchEnd();
            if (!switchFinished) {
                loggingBridge.warn('iosUpdateListener @ sendexam: section switch did not finish in time, uploading anyway');
            }
            // Re-evaluate after the wait: a section switch may have changed the exam type.
            const examTypes = ['editor', 'math', 'activesheets'];
            if (!useInfoStore().exammode || !examTypes.includes(sectionService.currentExamType)) {
                await submissionService.sendExamToTeacher();
                return;
            }
            // Reset so a stale reason can't satisfy the wait below.
            useInfoStore().lastExamWriteSaveReason = 'n/a';
            window.dispatchEvent(new CustomEvent('ipc-message', {
                detail: {channel: 'save', args: 'teacherrequest'}
            }));
            const saved = await this.waitForTeacherSave();
            if (saved) {
                loggingBridge.info('iosUpdateListener @ sendexam: exam page saved, uploading exam folder');
            } else {
                loggingBridge.warn('iosUpdateListener @ sendexam: save timed out, sending last auto-save');
            }
            const switchFinishedAfterSave = await this.waitForSectionSwitchEnd();
            if (!switchFinishedAfterSave) {
                loggingBridge.warn('iosUpdateListener @ sendexam: section switch did not finish in time, uploading anyway');
            }
            await submissionService.sendExamToTeacher();
        } finally {
            this._sendExamRunning = false;
        }
    }

    /**
     * Waits until no section switch is running anymore (polling every 150 ms), or
     * resolves false after SECTION_SWITCH_WAIT_TIMEOUT_MS.
     */
    private waitForSectionSwitchEnd(): Promise<boolean> {
        return new Promise((resolve) => {
            const sectionSwitchRunning = () =>
                useInfoStore().switchingToSection != null || isSectionSwitchRunning();
            if (!sectionSwitchRunning()) {
                resolve(true);
                return;
            }
            const started = Date.now();
            const poll = () => {
                if (!sectionSwitchRunning()) {
                    resolve(true);
                } else if (Date.now() - started >= SECTION_SWITCH_WAIT_TIMEOUT_MS) {
                    resolve(false);
                } else {
                    setTimeout(poll, 150);
                }
            };
            poll();
        });
    }

    /** Polls lastExamWriteSaveReason until the page finished the teacher-request save (or timeout). */
    private waitForTeacherSave(): Promise<boolean> {
        return new Promise((resolve) => {
            const started = Date.now();
            const poll = () => {
                if (useInfoStore().lastExamWriteSaveReason === 'teacherrequest') {
                    resolve(true);
                } else if (Date.now() - started >= SECTION_SWITCH_SAVE_TIMEOUT_MS) {
                    resolve(false);
                } else {
                    setTimeout(poll, 150);
                }
            };
            poll();
        });
    }

    handleUpdateReceived(sectionNumber: number = null, restoreBackup = false, fromSection: number = null): void {
        sectionService.handleUpdateReceived(sectionNumber, restoreBackup, fromSection);
    }

    saveGGB(filename: string, content: string, saveReason: string) {
        return fileService.saveGGB(filename, content, saveReason);
    }

    storePDF(filename: string, content: string, saveReason: string) {
        return fileService.storePDF(filename, content, saveReason);
    }

    getPdfAsync(filename: string): Promise<Uint8Array | false> {
        return fileService.getPdfAsync(filename);
    }

    loadGGB(filename: string) {
        return fileService.loadGGB(filename);
    }

    storeHTML(filename: string, htmlContent: string, saveReason: string): Promise<{returnSignal: string, args: {}}> {
        return fileService.storeHTML(filename, htmlContent, saveReason);
    }

    getBackupFile(filename: string): Promise<string | false> {
        return fileService.getBackupFile(filename);
    }

    getFilesAsync(filename: string, audio = false, docx = false, odtRaw = false) {
        return fileService.getFilesAsync(filename, audio, docx, odtRaw);
    }

    getBase64PDF(args: any, reason: string) {
        return pdfService.getBase64PDF(args, reason);
    }

    sendExamToTeacher(): Promise<void> {
        return submissionService.sendExamToTeacher();
    }

    setBipSiteInfo(info: any): void {
        signingService.setBipSiteInfo(info);
    }

    clearBipSiteInfo(): void {
        signingService.clearBipSiteInfo();
    }
}

export default new IosUpdateListener();
