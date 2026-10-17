import loggingBridge from "../loggingBridge.js";
import {useInfoStore} from "../../stores/infoStore.js";
import {useConfigStore} from "../../stores/configStore.js";
import {Directory, Filesystem} from "@capacitor/filesystem";
import {isSectionSwitchRunning} from "../switchExamSection.ts";
import { checkPathExists, readUint8Array } from "../commonMethods.js";
import { decryptExamFileAllLayers, encryptExamFileBytes, isExamFileEncryptedBytes } from "../../../../shared/examFileCryptoCore.js";
import { examApiFetch } from "../../../../shared/examApiFetch.js";
import {decryptExamFileAllLayersAsync} from "../../../src-electron/main/scripts/examFileCrypto.js";
import mammoth from "mammoth";
import { unzipSync } from "fflate";
import i18n from "../../locales/locales.js";
import submissionService from "./IosSubmissionService.js";
const {t} = i18n.global

/**
 * Handles all exam-directory file I/O for iOS (read/write/encrypt/decrypt).
 * The renderer reaches it through IosUpdateListener; plain Capacitor Filesystem
 * paths are validated before every access.
 */
class IosExamFileService {
    get infoStore() {
        return useInfoStore();
    }

    get configStore() {
        return useConfigStore();
    }

    async saveGGB(filename: string, content: string, saveReason: string) {
        if (this.isExamDirWriteBlocked(saveReason)) {
            loggingBridge.debug('ipchandler @ saveGGB: blocked during section switch');
            return { sender: 'client', message: 'section switch in progress', status: 'error' };
        }
        const ggbFilePath = this.resolveWritablePathUnderExamDir(this.configStore.examdirectory, filename, ['.ggb']);
        if (!ggbFilePath) {
            loggingBridge.warn(`ipchandler @ saveGGB: rejected unsafe ggb filename (${filename})`);
            return { sender: "client", message: "invalid filename", status: "error" };
        }
        if (content) {
            const fileData = Uint8Array.from(atob(content), c => c.charCodeAt(0));

            try {
                const pw = this.resolveExamDecryptPassword();
                const out = this.encryptExamFileBytesUnlessAlready(fileData, pw);
                if (pw) this.logSaveInfoUnlessAuto(saveReason, `ipchandler @ saveGGB: encrypted write ${filename} saveReason=${saveReason}`);
                else this.logSaveInfoUnlessAuto(saveReason, `ipchandler @ saveGGB: plaintext write ${filename} saveReason=${saveReason}`);
                await Filesystem.writeFile({
                    path: ggbFilePath,
                    directory: Directory.Documents,
                    data: btoa(Array.from(out, c => String.fromCharCode(c)).join(''))
                });
                this.infoStore.lastExamWriteSaveReason = saveReason
                if (saveReason === "teacherrequest") await submissionService.sendToTeacher()
                return  { sender: "client", message:t("data.filestored") , status:"success" }
            }
            catch(err){
                if (this.infoStore.exammode) {
                    //this.WindowHandler.mainWin()?.webContents?.send('fileerror', err)
                    return {sender: "client", message: err, status: "fileerror"}
                }

                loggingBridge.error(`ipchandler @ saveGGB: ${err}`)
                return {sender: "client", message: err, status: "error"}
            }
        }
    }

    /** Stores a generated PDF in the current iOS exam directory. */
    async storePDF(filename: string, content: string, saveReason: string) {
        if (this.isExamDirWriteBlocked(saveReason)) {
            return { sender: 'client', message: 'section switch in progress', status: 'error' };
        }
        const pdfFilename = `${filename || this.infoStore.clientname}.pdf`;
        const pdfFilePath = this.resolveWritablePathUnderExamDir(this.configStore.examdirectory, pdfFilename, ['.pdf']);
        if (!pdfFilePath || !content) {
            return { sender: 'client', message: 'invalid PDF', status: 'error' };
        }
        try {
            const pdfBytes = Uint8Array.from(atob(content), byte => byte.charCodeAt(0));
            const encrypted = this.encryptExamFileBytesUnlessAlready(pdfBytes, this.resolveExamDecryptPassword());
            await Filesystem.writeFile({
                path: pdfFilePath,
                directory: Directory.Documents,
                data: btoa(Array.from(encrypted, byte => String.fromCharCode(byte)).join('')),
            });
            this.infoStore.lastExamWriteSaveReason = saveReason;
            if (saveReason === 'teacherrequest') await submissionService.sendToTeacher();
            return { sender: 'client', message: t('data.filestored'), status: 'success' };
        } catch (error) {
            loggingBridge.error(`iosUpdateListener @ storePDF: ${error}`);
            return { sender: 'client', message: error, status: 'error' };
        }
    }

    /** Reads a PDF from the exam directory and decrypts it for display (iOS counterpart of getpdfasync). */
    async getPdfAsync(filename: string): Promise<Uint8Array | false> {
        const pdfFilePath = this.resolveWritablePathUnderExamDir(this.configStore.examdirectory, filename, ['.pdf']);
        if (!pdfFilePath) {
            loggingBridge.warn(`iosUpdateListener @ getPdfAsync: rejected unsafe pdf filename (${filename})`);
            return false;
        }
        try {
            const pw = this.resolveExamDecryptPassword();
            const uint8Array = await this.getUint8ArrayFromPath(pdfFilePath);
            const isEnc = isExamFileEncryptedBytes(uint8Array);
            if (isEnc && pw) loggingBridge.info(`iosUpdateListener @ getPdfAsync: decrypted read ${filename}`);
            return (isEnc && pw) ? decryptExamFileAllLayers(uint8Array, pw) : uint8Array;
        } catch (error) {
            loggingBridge.error(`iosUpdateListener @ getPdfAsync: ${error}`);
            return false;
        }
    }

    async loadGGB(filename: string) {
        const ggbFilePath = this.resolveWritablePathUnderExamDir(this.configStore.examdirectory, filename, ['.ggb']);
        if (!ggbFilePath) {
            loggingBridge.warn(`updateListener @ loadGGB: rejected unsafe ggb filename (${filename})`);
            return { sender: "client", content: false , status:"error" };
        }
        try {
            // Read the file and convert it to base64
            const pw = this.resolveExamDecryptPassword();
            let uint8Array = await this.getUint8ArrayFromPath(ggbFilePath);

            const isEnc = isExamFileEncryptedBytes(uint8Array);
            if (isEnc && pw) loggingBridge.info(`updateListener @ loadGGB: decrypted read ${filename}`);
            const fileData = (isEnc && pw) ? decryptExamFileAllLayers(uint8Array, pw) : uint8Array;
            const base64GgbFile = btoa(Array.from(fileData, c => String.fromCharCode(c)).join(''));
            return {sender: "client", content: base64GgbFile, status: "success"}


        } catch (error) {
            return {sender: "client", content: false, status: "error"}
        }
    }

    async storeHTML(filename: string, htmlContent: string, saveReason: string): Promise<{returnSignal: string, args: {}}> {
        let htmlfilename = `${this.infoStore.clientname}.htm`

        if (filename && String(filename).trim()) {
            htmlfilename = `${String(filename).trim()}.htm`
        }

        const htmlfile = this.resolveWritablePathUnderExamDir(this.configStore.examdirectory, htmlfilename, ['.htm']);
        if (!htmlfile) {
            loggingBridge.info(`updateListener @ storeHTML: rejected unsafe html filename (${htmlfilename})`);
            return;
        }

        if (htmlContent) {
            try {
                const pw = this.resolveExamDecryptPassword();
                const buf = new TextEncoder().encode(String(htmlContent));
                const out = this.encryptExamFileBytesUnlessAlready(buf, pw);
                const base64 = btoa(Array.from(out, c => String.fromCharCode(c)).join(''));
                if (pw) this.logSaveInfoUnlessAuto(saveReason, `updateListener @ storeHTML: encrypted write ${htmlfilename} saveReason=${saveReason}`);
                else this.logSaveInfoUnlessAuto(saveReason, `updateListener @ storeHTML: plaintext write ${htmlfilename} saveReason=${saveReason}`);
                try {
                    await Filesystem.writeFile({path: htmlfile, directory: Directory.Documents, data: base64});
                    this.infoStore.lastExamWriteSaveReason = saveReason
                    return {returnSignal: "loadfilelist", args: {}}
                } catch (err) {
                    loggingBridge.error(`updateListener @ storeHTML: ${(err as any).message}`);

                    const htmlBase = String(htmlfile).split(/[/\\]/).pop() || '';
                    const htmlStem = htmlBase.replace(/\.htm$/i, '');
                    let alternatepath = this.resolveWritablePathUnderExamDir(this.configStore.examdirectory, `${htmlStem}-${this.infoStore.token}.htm`, ['.htm']);
                    if (!alternatepath) {
                        loggingBridge.error("updateListener @ storeHTML: alternate path rejected");
                        return {returnSignal: "fileerror", args: {sender: "client", message: "invalid alternate path", status: "error"}}
                    }
                    loggingBridge.warn("updateListener @ storeHTML: trying to write file as:", alternatepath)

                    try {
                        await Filesystem.writeFile({path: alternatepath, directory: Directory.Documents, data: base64});
                        this.infoStore.lastExamWriteSaveReason = saveReason
                        this.logSaveInfoUnlessAuto(saveReason, "updateListener @ storeHTML: success!");
                        return {returnSignal: "loadfilelist", args: {}}
                    } catch (err2) {
                        loggingBridge.error((err2 as any).message);
                        loggingBridge.error("updateListener @ storeHTML: giving up");
                        return {returnSignal: "fileerror", args: {sender: "client", message: err2, status: "error"}}
                    }
                }
            } catch (err) {
                return {returnSignal: "error", args: {error: err}}
            }
        }
        return {returnSignal: "error", args: {}};
    }

    async getBackupFile(filename: string): Promise<string | false> {
        if (!filename) {
            loggingBridge.warn(`iosUpdateListener @ getbackupfile: no filename provided`);
            return false;
        }
        const filepath = this.resolveWritablePathUnderExamDir(this.configStore.examdirectory, filename, ['.htm']);
        if (!filepath) {
            loggingBridge.warn(`iosUpdateListener @ getbackupfile: rejected unsafe filename (${filename})`);
            return false;
        }
        try {
            let uint8Array = await this.getUint8ArrayFromPath(filepath);
            if (isExamFileEncryptedBytes(uint8Array)) {
                const pw = this.resolveExamDecryptPassword();
                if (!pw) {
                    loggingBridge.warn(`iosUpdateListener @ getbackupfile: encrypted ${filename} but no key in serverstatus`);
                    return false;
                }
                try {
                    uint8Array = await decryptExamFileAllLayersAsync(uint8Array, pw);
                } catch (e) {
                    loggingBridge.error(`iosUpdateListener @ getbackupfile: decrypt failed ${e?.message || e}`);
                    return false;
                }
            }
            return new TextDecoder().decode(uint8Array);
        }
        catch (err) {
            const errorMsg = String(err?.message || err);
            if (err?.code === 'ENOENT' || errorMsg.includes('ENOENT') || errorMsg.includes('not found') || errorMsg.includes('File not found')) {
                loggingBridge.warn(`iosUpdateListener @ getbackupfile: backup file not found: ${filepath}`);
                return false;
            }
            loggingBridge.error(`iosUpdateListener @ getbackupfile: Error reading backup file: ${err}`);
            loggingBridge.error(`iosUpdateListener @ getbackupfile: Error stack: ${err?.stack}`)
            return false
        }
    }

    /**
     * ASYNC GET FILE-LIST from examdirectory
     * @param filename if set the content of the file is returned
     */
    async getFilesAsync(filename: string, audio = false, docx = false, odtRaw=false) {

            const workdir = this.configStore.examdirectory + "/";

            if (filename) { //return content of specific file as string (html) to replace in editor)
                const allowedList = audio === true
                    ? ['.mp3', '.ogg', '.wav']
                    : (docx ? ['.docx'] : odtRaw ? ['.odt'] : ['.htm']);
                let filepath = this.resolveWritablePathUnderExamDir(this.configStore.examdirectory, filename, allowedList);
                if (!filepath) {
                    loggingBridge.warn(`iosUpdateListener @ getfilesasync: rejected unsafe filename(${filename})`);
                    return false;
                }
                const pw = this.resolveExamDecryptPassword();
                // Helper to transparently decrypt encrypted exam files.
                const readMaybeDecrypt = async () => {

                    let raw = await this.getUint8ArrayFromPath(filepath);
                    const isEnc = isExamFileEncryptedBytes(raw);
                    if (isEnc && pw) loggingBridge.info(`iosUpdateListener @ getfilesasync: decrypted read ${filename}`);
                    raw = (isEnc && pw) ? decryptExamFileAllLayers(raw, pw) : raw;
                    return new TextDecoder().decode(raw);
                };

                if (audio == true) { // audio file
                    return await readMaybeDecrypt();
                } else if (docx) {  //office open xml file
                    const raw = await this.getUint8ArrayFromPath(filepath);
                    const pwDoc = this.resolveExamDecryptPassword();
                    const isEnc = isExamFileEncryptedBytes(raw);
                    if (isEnc && pwDoc) loggingBridge.info(`iosUpdateListener @ getfilesasync: decrypted read ${filename}`);
                    const docxBuffer = (isEnc && pwDoc) ? decryptExamFileAllLayers(raw, pwDoc) : null;
                    return await mammoth.convertToHtml(docxBuffer ? { buffer: docxBuffer } : { path: filepath })
                        .then((data) => {
                            return data
                        })
                        .catch(function (error) {
                            loggingBridge.error(error);
                        });
                } else if (odtRaw) {
                    try {
                        return await readMaybeDecrypt();
                    }
                    catch (err) {
                        loggingBridge.error(`iosUpdateListener @ getfilesasync odt: ${err}`);
                        return false;
                    }
                }
                else {   //htm backup file
                    try {
                        return await readMaybeDecrypt();
                    } catch (err) {
                        loggingBridge.error(`iosUpdateListener @ getfilesasync: ${err}`);
                        return false
                    }
                }
            } else {  // return file list of exam directory
                try {
                    if (!await checkPathExists({path: workdir, directory: Directory.Documents})) {
                        await Filesystem.mkdir({path: workdir, recursive: true, directory: Directory.Documents})
                    } //do not crash if the directory is deleted after the app is started ^^
                    let fileList = (await Filesystem.readdir({path: workdir, directory: Directory.Documents})).files
                        .filter(entry => entry.type === "file")
                        .map(entry => entry.name);

                    let files = []
                    for (let filePosition in fileList) {
                        let file = fileList[filePosition]
                        const filestats = await Filesystem.stat({path: workdir + file, directory: Directory.Documents});
                        let modifiedTimestamp = filestats.mtime
                        if (file.toLowerCase().endsWith(".pdf")) {
                            files.push({name: file, type: "pdf", mod: modifiedTimestamp})
                        }         //pdf
                        else if (file.toLowerCase().endsWith(".htm")) {
                            files.push({name: file, type: "htm", mod: modifiedTimestamp})
                        }   // editor| backup file to replace editor content
                        else if (file.toLowerCase().endsWith(".docx")) {
                            files.push({name: file, type: "docx", mod: modifiedTimestamp})
                        }   // editor| content file (from teacher) to replace content and continue writing
                        else if  (file.toLowerCase().endsWith(".odt")){ files.push( {name: file, type: "odt", mod: modifiedTimestamp})   }   // ODT → TipTap HTML in renderer
                        else if  (file.toLowerCase().endsWith(".ggb")){ files.push( {name: file, type: "ggb", mod: modifiedTimestamp})   }  // geogebra
                        else if  (file.toLowerCase().endsWith(".sb2") || file.toLowerCase().endsWith(".sb3")){ files.push( {name: file, type: "scratch", mod: modifiedTimestamp})   }  // scratch
                        else if  (file.toLowerCase().endsWith(".mp3") || file.toLowerCase().endsWith(".ogg") || file.toLowerCase().endsWith(".wav") ){ files.push( {name: file, type: "audio", mod: modifiedTimestamp})}  // audio
                        else if  (file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".png") || file.toLowerCase().endsWith(".gif") ){ files.push( {name: file, type: "image", mod: modifiedTimestamp})}
                    }
                    this.infoStore.numberOfFiles = fileList.length
                    return files
                } catch (err) {
                    loggingBridge.error(`iosUpdateListener @ getfilesasync: ${err}`);
                    return false;
                }
            }
    }

    /**
     * Downloads the teacher-sent file bundle (server /server/data/download/:servername),
     * unzips it into the exam directory, encrypts it and refreshes the renderer.
     * iOS counterpart of Electron communicationhandler.js requestFileFromServer.
     */
    async requestFilesFromServer(): Promise<void> {
        try {
            const url = `https://${this.infoStore.serverip}:${this.configStore.serverApiPort}/server/data/download/${this.infoStore.servername}`;
            const response = await examApiFetch(url, {
                method: "POST",
                headers: {'Content-Type': 'application/json', Authorization: `Bearer ${this.infoStore.token}`},
                body: JSON.stringify({type: 'studentfilerequest'}),
            });
            const buffer = new Uint8Array(await response.arrayBuffer());
            if (buffer.length === 0) return;
            const unzipped = unzipSync(buffer);
            const pw = this.resolveExamDecryptPassword();
            let backupfile = false;
            for (const [name, data] of Object.entries(unzipped)) {
                const filepath = this.resolveWritablePathUnderExamDir(this.configStore.examdirectory, name, null);
                if (!filepath) {
                    loggingBridge.warn(`iosUpdateListener @ requestFilesFromServer: rejected unsafe filename (${name})`);
                    continue;
                }
                const out = this.encryptExamFileBytesUnlessAlready(data, pw);
                await Filesystem.writeFile({
                    path: filepath,
                    directory: Directory.Documents,
                    data: btoa(Array.from(out, c => String.fromCharCode(c)).join(''))
                });
                if (name.toLowerCase().endsWith('.htm')) backupfile = name;
            }
            if (backupfile && this.infoStore.exammode) {
                window.dispatchEvent(new CustomEvent('ipc-message', {detail: {channel: 'backup', args: backupfile}}));
            }
            if (this.infoStore.exammode) {
                window.dispatchEvent(new CustomEvent('ipc-message', {detail: {channel: 'loadfilelist'}}));
            }
            loggingBridge.info('iosUpdateListener @ requestFilesFromServer: files received and stored');
        } catch (error) {
            loggingBridge.error(`iosUpdateListener @ requestFilesFromServer: ${error}`);
        }
    }

    private async getUint8ArrayFromPath(filepath: string): Promise<Uint8Array> {
        return await readUint8Array({path: filepath, directory: Directory.Documents});
    }

    // Resolves a single-segment filename under rootDir or returns null (blocks path traversal from IPC/renderer).
    resolveWritablePathUnderExamDir(rootDir, name, allowedLowerExtensions = null): string {
        if (rootDir == null || typeof rootDir !== 'string' || name == null || typeof name !== 'string') return null;
        const n = name.trim();
        if (!n || n.includes('\0')) return null;
        // single path segment only — no separators / traversal
        if (n.includes('/') || n.includes('\\') || n === '.' || n === '..') return null;
        const dot = n.lastIndexOf('.');
        const ext = (dot > 0 ? n.slice(dot) : '').toLowerCase();
        if (allowedLowerExtensions?.length && !allowedLowerExtensions.includes(ext)) return null;
        const stem = dot > 0 ? n.slice(0, dot) : n;
        if (/^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i.test(stem)) return null;
        const rootResolved = rootDir.replace(/[/\\]+$/, '');
        const sep = rootDir.includes('\\') && !rootDir.includes('/') ? '\\' : '/';
        return `${rootResolved}${sep}${n}`;
    };

    /** Exam file key: serverstatus.encryptionPassword; local lockdown uses serverstatus.password only. */
    resolveExamDecryptPassword(){
        const examPw = String(this.infoStore.encryptionPassword ?? '').trim();
        if (examPw) return examPw;
        if (this.infoStore.localLockdown) {
            return String(this.infoStore.password ?? '').trim();
        }
        return '';
    };

    // Encrypt once for disk; if buffer is already NXE1, write as-is (avoids nested ciphertext).
    encryptExamFileBytesUnlessAlready(plainBuf: Uint8Array | ArrayBuffer, pw: string): Uint8Array {
        const buf = plainBuf instanceof Uint8Array ? plainBuf : new Uint8Array(plainBuf);
        if (isExamFileEncryptedBytes(buf)) return buf;
        return pw ? encryptExamFileBytes(buf, pw) : buf;
    }

    // Skip info-level file-save log noise when the renderer marks the write as periodic auto-save.
    logSaveInfoUnlessAuto(saveReason, message){
        if (saveReason === 'auto') return
        loggingBridge.info(message)
    }

    // Block stray examDir writes during section switch (sectionswitch saves are exempt).
    isExamDirWriteBlocked(saveReason: string): boolean {
        return isSectionSwitchRunning() && saveReason !== 'sectionswitch';
    }
}

export default new IosExamFileService();
