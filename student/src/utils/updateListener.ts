import {SignalBridge} from './signalBridge.js'
import {useInfoStore} from "../stores/infoStore.js";
import log from "electron-log";
import {decryptExamFileAllLayers, encryptExamFileBytes, isExamFileEncryptedBytes} from "../../../shared/examFileCryptoCore.js";
import {Directory, Filesystem, WriteFileResult} from "@capacitor/filesystem";

const signalBridge = new SignalBridge(window)

class UpdateListener {
    infoStore: any = null;

    async init(): Promise<void> {
        console.log("updateListener @ init");

        this.infoStore = useInfoStore();
        await this.infoStore.updateInfo();

        signalBridge.on('loadGGB', async (filename: string) => {
            console.log('updateListener @ loadGGB: start', filename);
            const ggbFilePath = this.resolveWritablePathUnderExamDir(this.infoStore.examdirectory, filename, ['.ggb']);
            if (!ggbFilePath) {
                log.warn(`updateListener @ loadGGB: rejected unsafe ggb filename (${filename})`);
                return { sender: "client", content: false , status:"error" };
            }
            try {
                // Read the file and convert it to base64
                const pw = this.resolveExamDecryptPassword();
                const response = await Filesystem.readFile({path: ggbFilePath, directory: Directory.Documents});

                // Narrow the type — on mobile it's base64 string, on web it can be Blob
                let uint8Array: Uint8Array;

                if (typeof response.data === 'string') {
                    uint8Array = Uint8Array.from(atob(response.data), c => c.charCodeAt(0));
                } else {
                    // Handle Blob (web platform)
                    uint8Array = new Uint8Array(await response.data.arrayBuffer())
                }

                const isEnc = isExamFileEncryptedBytes(uint8Array);
                if (isEnc && pw) log.info(`updateListener @ loadGGB: decrypted read ${filename}`);
                const fileData = (isEnc && pw) ? decryptExamFileAllLayers(uint8Array, pw) : uint8Array;
                console.log("updateListener @ loadGGB: got data", fileData)
                const base64GgbFile = Buffer.from(fileData).toString('base64');
                console.log("updateListener @ loadGGB: got data", base64GgbFile)
                return {sender: "client", content: base64GgbFile, status: "success"}


            } catch (error) {
                return {sender: "client", content: false, status: "error"}
            }
        })

        signalBridge.on('storeHTML', (event, args) => {
            console.log("updateListener @ storeHTML", event, args);
            const htmlContent = args.editorcontent
            const filename = args.filename
            const saveReason = typeof args.reason === 'string' ? args.reason : 'n/a'
            let htmlfilename = `${this.infoStore.clientname}.htm`

            if (filename && String(filename).trim()) {
                htmlfilename = `${String(filename).trim()}.htm`
            }

            const htmlfile = this.resolveWritablePathUnderExamDir(this.infoStore.examdirectory, htmlfilename, ['.htm']);
            if (!htmlfile) {
                console.log(`updateListener @ storeHTML: rejected unsafe html filename (${htmlfilename})`);
                return;
            }

            if (htmlContent) {
                // log.info("ipchandler: storeHTML: saving students work to disk...")
                try {
                    const pw = this.resolveExamDecryptPassword();
                    const buf = new TextEncoder().encode(String(htmlContent));
                    const out = this.encryptExamFileBytesUnlessAlready(buf, pw);
                    const base64 = btoa(Array.from(out, c => String.fromCharCode(c)).join(''));
                    if (pw) this.logSaveInfoUnlessAuto(saveReason, `updateListener @ storeHTML: encrypted write ${htmlfilename} saveReason=${saveReason}`);
                    else this.logSaveInfoUnlessAuto(saveReason, `updateListener @ storeHTML: plaintext write ${htmlfilename} saveReason=${saveReason}`);
                    Filesystem.writeFile({path: htmlfile, directory: Directory.Documents, data: base64})
                            .then((_: WriteFileResult) => {
                                this.infoStore.lastExamWriteSaveReason = saveReason
                                event.reply("loadfilelist")
                            })
                            .catch((err) => {
                                console.error(`updateListener @ storeHTML: ${err.message}`);

                                const htmlBase = String(htmlfile).split(/[/\\]/).pop() || '';
                                const htmlStem = htmlBase.replace(/\.htm$/i, '');
                                let alternatepath = this.resolveWritablePathUnderExamDir(this.infoStore.examdirectory, `${htmlStem}-${this.infoStore.token}.htm`, ['.htm']);
                                if (!alternatepath) {
                                    console.error("updateListener @ storeHTML: alternate path rejected");
                                    event.reply("fileerror", { sender: "client", message: "invalid alternate path", status: "error" });
                                    return;
                                }
                                console.warn("updateListener @ storeHTML: trying to write file as:", alternatepath)

                                Filesystem.writeFile({path: alternatepath, directory: Directory.Documents, data: base64})
                                    .catch((err2) => {
                                        console.error(err2.message);
                                        console.error("updateListener @ storeHTML: giving up");
                                        event.reply("fileerror", {sender: "client", message: err2, status: "error"})
                                    })
                                    .then((_) => {
                                        this.infoStore.lastExamWriteSaveReason = saveReason
                                        this.logSaveInfoUnlessAuto(saveReason, "updateListener @ storeHTML: success!");
                                        event.reply("loadfilelist")
                                    })
                            });
                } catch (err) {
                    console.error(err)
                    event.returnValue = {sender: "client", message: err, status: "error"}
                }
            }
        })
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
        console.info(message)
    }

}

export default new UpdateListener();