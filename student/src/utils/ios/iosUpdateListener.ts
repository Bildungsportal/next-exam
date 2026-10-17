import {isIOS} from "../../types/platform.js";
import loggingBridge from "../loggingBridge.js";
import {useInfoStore} from "../../stores/infoStore.js";
import { Buffer } from "buffer";
import sectionService from "./IosSectionService.js";
import fileService from "./IosExamFileService.js";
import pdfService from "./IosPdfService.js";
import submissionService from "./IosSubmissionService.js";
import signingService from "./IosSubmissionSigningService.js";

/**
 * Bridges the renderer's IPC signals (startExam / endExam / sendexam) to the iOS
 * services and exposes their methods to the renderer. Contains no iOS logic itself.
 */
class IosUpdateListener {
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
            if (sectionService.currentExamType === 'activesheets') {
                window.dispatchEvent(new CustomEvent('ipc-message', {
                    detail: {channel: 'save', args: 'teacherrequest'}
                }));
                return;
            }
            submissionService.sendExamToTeacher();
        });

        window.ipcRenderer.on('fetchfiles', () => {
            fileService.requestFilesFromServer();
        });
    }

    handleUpdateReceived(sectionNumber: number = null, restoreBackup = false): void {
        sectionService.handleUpdateReceived(sectionNumber, restoreBackup);
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
