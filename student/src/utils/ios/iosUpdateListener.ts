import {isIOS} from "../../types/platform.js";
import loggingBridge from "../loggingBridge.js";
import {router} from "../../router/index.js";
import {useInfoStore} from "../../stores/infoStore.js";
import {useConfigStore} from "../../stores/configStore.js";
import {Directory, Filesystem} from "@capacitor/filesystem";
import {zipSync} from "fflate";
import {examApiFetch} from "../../../../shared/examApiFetch.js";
import {isSectionSwitchRunning} from "../switchExamSection.ts";
import html2pdf from "html2pdf-jspdf2";
import { Buffer } from "buffer";
import { createPdfExportResult, submissionSignReasons } from "../../../../shared/pdfExportShared.js";
import { buildLocalSubmissionSigningSecret, deriveSigningIdentity, signSubmissionPdf, SUBMISSION_SIGN_MODE_BIP, SUBMISSION_SIGN_MODE_LOCAL } from "../../../../shared/submissionPdfSign.js";
const {t} = i18n.global
import {
    decryptExamFileAllLayers,
    encryptExamFileBytes,
    isExamFileEncryptedBytes
} from "../../../../shared/examFileCryptoCore.js";
import {decryptExamFileAllLayersAsync} from "../../../src-electron/main/scripts/examFileCrypto.js";
import mammoth from "mammoth";
import {checkPathExists} from "../commonMethods.js";
import i18n from "../../locales/locales.js";

class IosUpdateListener {
    currentExamType: string = "";
    lastServerStatus: any = null;
    infoStore: any = null;
    configStore: any = null;
    bipSiteInfo: any = null;
    cachedSubmissionSigningIdentity: any = null;

    async init(): Promise<void> {
        if (!isIOS()) {
            return;
        }
        this.infoStore = useInfoStore();
        this.configStore = useConfigStore();
        globalThis.Buffer = Buffer;
        await this.infoStore.updateInfo();

        window.ipcRenderer.on('startExam', (serverstatus) => {
            loggingBridge.debug("iosUpdateListener @ startExam: message received: ", serverstatus);
            this.lastServerStatus = serverstatus;
            this.infoStore.exammode = serverstatus.exammode;
            this.infoStore.lockedSection = serverstatus.lockedSection;
            this.handleUpdateReceived();
        });

        window.ipcRenderer.on('endExam', () => {
            loggingBridge.debug("iosUpdateListener @ endExam: received signal");
            router.push("/student");
            this.infoStore.examtype = "";
            this.infoStore.exammode = false;
            this.currentExamType = "";
            this.lastServerStatus = null;
        });

        window.ipcRenderer.on('sendexam', () => {
            if (this.currentExamType === 'activesheets') {
                window.dispatchEvent(new CustomEvent('ipc-message', {
                    detail: {channel: 'save', args: 'teacherrequest'}
                }));
                return;
            }
            this.sendExamToTeacher();
        });
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
                if (saveReason === "teacherrequest") await this.sendToTeacher()
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
            if (saveReason === 'teacherrequest') await this.sendToTeacher();
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
    private async getUint8ArrayFromPath(filepath: string): Promise<Uint8Array> {
        let readFileResponse = await Filesystem.readFile({path: filepath, directory: Directory.Documents})

        if (typeof readFileResponse.data === 'string') {
            return Uint8Array.from(atob(readFileResponse.data), c => c.charCodeAt(0));
        } else {
            // Handle Blob (web platform)
            return new Uint8Array(await readFileResponse.data.arrayBuffer())
        }
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

    /** Sends the current exam ZIP to the teacher. */
    async sendExamToTeacher(): Promise<void> {
        await this.sendToTeacher();
    }

    /** Creates the exam ZIP from Capacitor Documents and sends it to the teacher. */
    async sendToTeacher(): Promise<void> {
        try {
            const files = await this.getExamFiles(this.configStore.examdirectory);
            const zip = zipSync(files);
            const zipPayload = {
                file: btoa(Array.from(zip, c => String.fromCharCode(c)).join('')),
                filename: `${this.infoStore.clientname}.zip`,
                lastExamWriteSaveReason: this.infoStore.lastExamWriteSaveReason || 'n/a'
            };
            const url = `https://${this.infoStore.serverip}:${this.configStore.serverApiPort}/server/data/receive/${this.infoStore.servername}`;
            const response = await examApiFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.infoStore.token}` },
                body: JSON.stringify(zipPayload),
            });
            const data = await response.json();
            loggingBridge.info(`iosUpdateListener @ sendToTeacher: teacher response: ${data.message}`);
            if (data && (data.status === 'success' || data.message === 'success')) {
                this.infoStore.lastExamWriteSaveReason = 'n/a';
            }
        } catch (error) {
            loggingBridge.error(`iosUpdateListener @ sendToTeacher: ${error}`);
        }
    }

    /** Stores BiP signing material for signed PDF submissions. */
    setBipSiteInfo(info: any): void {
        this.bipSiteInfo = info;
        this.cachedSubmissionSigningIdentity = null;
        this.infoStore.bipUserId = info.userid;
    }

    /** Clears BiP signing material after logout. */
    clearBipSiteInfo(): void {
        this.bipSiteInfo = null;
        this.cachedSubmissionSigningIdentity = null;
        this.infoStore.bipUserId = "";
    }

    /** Reuses one signing identity for all PDF submissions in the exam. */
    private async ensureSubmissionSigningIdentity() {
        if (this.cachedSubmissionSigningIdentity) return this.cachedSubmissionSigningIdentity;

        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
        const bip = this.bipSiteInfo?.userprivateaccesskey;
        if (bip) {
            this.cachedSubmissionSigningIdentity = await deriveSigningIdentity(bip, salt, this.bipSiteInfo.fullname || this.infoStore.clientname, {
                mode: SUBMISSION_SIGN_MODE_BIP,
                bipUserId: this.bipSiteInfo.userid,
            });
        } else {
            const secret = buildLocalSubmissionSigningSecret(this.infoStore.pincode, this.infoStore.token, Date.now());
            this.cachedSubmissionSigningIdentity = await deriveSigningIdentity(secret, salt, this.infoStore.clientname, {
                mode: SUBMISSION_SIGN_MODE_LOCAL,
            });
        }
        return this.cachedSubmissionSigningIdentity;
    }

    /** Recursively collects exam-directory files for ZIP creation. */
    private async getExamFiles(path: string, prefix = ''): Promise<Record<string, Uint8Array>> {
        const files: Record<string, Uint8Array> = {};
        const entries = (await Filesystem.readdir({path, directory: Directory.Documents})).files;
        for (const entry of entries) {
            const relativePath = `${prefix}${entry.name}`;
            const filePath = `${path}/${entry.name}`;
            if (entry.type === 'directory') {
                Object.assign(files, await this.getExamFiles(filePath, `${relativePath}/`));
            } else {
                files[relativePath] = await this.getUint8ArrayFromPath(filePath);
            }
        }
        return files;
    }

    handleUpdateReceived(sectionNumber: number = null): void {
        const newSectionNumber = sectionNumber ? sectionNumber : this.infoStore.lockedSection;
        loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: current serverstatus is:", this.lastServerStatus, "sectionNumber: ", newSectionNumber);

        if (this.infoStore.exammode) {
            let newExamType = this.lastServerStatus.examSections[newSectionNumber].examtype;

            loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: currentExamType, ", this.currentExamType, "newExamType: ", newExamType);
            if (this.currentExamType !== newExamType || this.infoStore.lockedSection !== newSectionNumber) {
                this.infoStore.examtype = newExamType;
                this.currentExamType = newExamType;
                const examPath = `/${newExamType}/${this.infoStore.token}/${newSectionNumber}`;
                loggingBridge.debug("iosUpdateListener @ handleUpdateReceived: router push to: ", examPath);
                router.push({
                    path: examPath
                });
            }
        }
        this.infoStore.lockedSection = newSectionNumber;
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
    async getBackupFile(filename: string): Promise<string> {
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
            if (err?.code === 'ENOENT') {
                loggingBridge.warn(`iosUpdateListener @ getbackupfile: backup file not found: ${filepath}`);
                return false;
            }
            loggingBridge.error(`iosUpdateListener @ getbackupfile: Error reading backup file: ${err}`);
            loggingBridge.error(`iosUpdateListener @ getbackupfile: Error stack: ${err.stack}`)
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

    /** Generates and optionally signs a PDF from the current Capacitor document. */
    async getBase64PDF(args: any, reason: string) {
        if (!this.infoStore.exammode) {
            return { sender: 'client', message: 'not in exam mode', status: 'error' };
        }
        try {
            const source = document.getElementById(args.sourceElementId || 'editorcontent');
            if (!source) return { sender: 'client', message: 'no PDF content', status: 'error' };

            const dataUrl = await html2pdf()
                .set({
                    margin: args.pageMode === 'fullpage' ? 0 : [0.5, 0, 0.5, 0],
                    html2canvas: { backgroundColor: '#ffffff', scale: 2 },
                    jsPDF: { format: 'a4', orientation: 'portrait', unit: 'in' },
                })
                .from(source)
                .outputPdf('datauristring');
            const pdfBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), byte => byte.charCodeAt(0));
            const signing = submissionSignReasons.has(reason);
            const identity = signing ? await this.ensureSubmissionSigningIdentity() : null;
            const signedPdf = identity
                ? await signSubmissionPdf(pdfBytes, identity, {
                    name: this.infoStore.clientname,
                    signMode: identity.mode,
                    reason: 'Next-Exam submission',
                    contactInfo: 'https://next-exam.at',
                    location: 'Next-Exam',
                })
                : pdfBytes;
            this.infoStore.submissionnumber = args.submissionnumber + 1;
            return createPdfExportResult(signedPdf, {
                signed: signing,
                signMode: identity?.mode ?? null,
            });
        } catch (error) {
            loggingBridge.error(`iosUpdateListener @ getBase64PDF: ${error}`);
            return { sender: 'client', message: 'Error generating PDF', status: 'error' };
        }
    }
}

export default new IosUpdateListener();