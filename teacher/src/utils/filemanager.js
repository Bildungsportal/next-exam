import log from 'electron-log/renderer';
import { Buffer } from 'buffer';
import { swalQueued } from './swalQueue.js'
import { maybePromptVerifySignedSubmissionPdf } from './submissionPdfPreview.js'

/**
 * Dashboard explorer: read file bytes from the active exam workdir (decrypted in main when applicable).
 * Used by loadPDF (PDF preview), loadTextFile (log popup), loadImage (image preview) in this module.
 */
async function readWorkdirFileForDashboard(ctx, filepath) {
    const res = await window.ipcRenderer.invoke('readTeacherWorkdirFile', {
        servername: ctx.servername,
        servertoken: ctx.servertoken,
        filepath,
    })
    if (!res || res.status !== 'success' || res.data == null) {
        throw new Error(res?.message || 'read failed')
    }
    return res.data
}


// DASHBOARD EXPLORER

//delete file or folder
function fdelete(file){
    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.sure"),
        html:  `<div class="my-content">${this.$t("dashboard.filedelete")}</div>`,
        icon: "warning",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
    })
    .then((result) => {
        if (result.isConfirmed) {
            ipcRenderer.invoke('deleteWorkdirItem', { servername: this.servername, filepath: file.path })
            .then( result => {
                log.info(result)
                this.loadFilelist(this.currentdirectory)
            }).catch(err => { log.error(err)});
        }
    })
    .catch(err => { log.error(err)});;
}



// show workfloder  TODO:  the whole workfolder thing is getting to complex.. this should be a standalone vue.js component thats embedded here
function showWorkfolder(){
    this.showExplorer = true;
}



// fetch a file or folder (zip) and open download/save dialog
function downloadFile(file){
    if (file === "current"){   //we want to download the file thats currently displayed in preview
        let a = document.createElement("a");
        // If currentpreview is a blob URL, we need to handle it differently
        if (this.currentpreview.startsWith('blob:')) {
            a.href = this.currentpreview;
        } else {
            // For base64 data URLs, use the original base64 content
            a.href = `data:application/pdf;base64,${this.currentpreviewBase64}`;
        }
        a.setAttribute("download", this.currentpreviewname);
        a.click();
        return
    }
    log.info("requesting file for downlod ")
    ipcRenderer.invoke('workdownloadExplorerItem', {
        servername: this.servername,
        servertoken: this.servertoken,
        filename: file.name,
        path: file.path,
        type: file.type,
    })
    .then((result) => {
        if (!result || result.status !== 'success' || result.data == null) {
            log.error('filemanager @ downloadFile:', result)
            return
        }
        const blob = new Blob([result.data], { type: 'application/octet-stream' })
        let a = document.createElement("a")
        a.href = window.URL.createObjectURL(blob)
        a.setAttribute("download", file.name)
        a.click()
    })
    .catch(err => { log.error(err)})
}







// send a file from dashboard explorer to specific student
function dashboardExplorerSendFile(file){
    const inputOptions = new Promise((resolve) => {  // prepare input options for radio buttons
        let connectedStudents = {}
        this.studentlist.forEach( (student) => { connectedStudents[student.token]=student.clientname });
        resolve(connectedStudents)
    })
    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.choosestudent"),
        input: 'select',
        icon: 'success',
        showCancelButton: true,
        inputOptions: inputOptions,
        inputValidator: (value) => { if (!value) { return this.$t("dashboard.chooserequire") } },
    })
    .then((input) => {
        if (input.isConfirmed) {
            let student = this.studentlist.find(element => element.token === input.value)  // fetch cerrect student that belongs to the token
            ipcRenderer.invoke('setStudentStatus', {
                servername: this.servername,
                studenttoken: student.token,
                fetchfiles: true,
                files: [{ name: file.name, path: file.path }],
            })
                .then((result) => { log.info(result) })
                .catch((err) => { log.error(err) })
        }
    }).catch(err => { log.error(err)});
}



// fetch file from disc - show preview
function loadPDF(filepath, filename){
    readWorkdirFileForDashboard(this, filepath)
    .then( async (raw) => {
        const data = raw instanceof ArrayBuffer ? raw : new Uint8Array(raw).buffer
        await maybePromptVerifySignedSubmissionPdf(this, new Uint8Array(data))
        URL.revokeObjectURL(this.currentpreview);  //speicher freigeben
     
        let isvalid = isValidPdf(data)
        log.info("filemanager @ loadPDF: pdf is valid: ", isvalid)

        this.currentpreviewBase64 = Buffer.from(data).toString('base64');
        this.currentpreview = URL.createObjectURL(new Blob([data], {type: "application/pdf"}))
        this.currentpreviewname = filename   //needed for preview buttons
        this.currentpreviewPath = filepath
        this.currentpreviewType = "pdf"

        this.activesheetsPreviewPdf = null;
        this.webviewVisible = false;
        document.querySelector("#pdfpreview").style.display = 'block';

    }).catch(err => { log.error(err) });     
}

function isValidPdf(data) {
    const header = new Uint8Array(data, 0, 5); // read the first 5 bytes for "%PDF-"
    // Convert bytes to hex values for comparison
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D]; // "%PDF-" in Hex
    for (let i = 0; i < pdfHeader.length; i++) {
        if (header[i] !== pdfHeader[i]) {
            return false; // early exit if a byte does not match
        }
    }
    return true; // all bytes match the PDF header
}

function escapeHtml(s){
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

/** Keep the tail of long log text; omit oldest bytes from the start. */
function truncateLogTextForViewer(text, maxChars = 200000) {
    const full = String(text)
    if (full.length <= maxChars) return full
    const omitted = full.length - maxChars
    return `... ${omitted} chars omitted from start ...\n\n${full.slice(-maxChars)}`
}

/** Scroll log popup pre block so the latest lines are visible. */
function scrollLogPopupPreToBottom() {
    const pre = document.querySelector('.log-view-popup .log-pre')
    if (pre && typeof pre.scrollTop === 'number') {
        pre.scrollTop = pre.scrollHeight
    }
}

function scheduleScrollLogPopupPreToBottom() {
    scrollLogPopupPreToBottom()
    requestAnimationFrame(() => scrollLogPopupPreToBottom())
}

// fetch file from disc - show as text (e.g. .log)
function loadTextFile(filepath, filename){
    const titleText = buildLogViewerTitle(this.workdirectory, filepath, filename)
    readWorkdirFileForDashboard(this, filepath)
        .then((raw) => {
            const data = raw instanceof ArrayBuffer ? raw : new Uint8Array(raw).buffer
            const decoder = new TextDecoder('utf-8')
            const text = truncateLogTextForViewer(decoder.decode(data))

            const htmlLines = String(text).split('\n').map((line) => {
                const level = detectLogLevel(line)
                const cls = level ? `log-line log-${level}` : 'log-line'
                return `<span class="${cls}">${escapeHtml(line)}</span>`
            }).join('\n')

            this.$swal.fire({
                title: titleText,
                html: `<style>
                    .log-view-popup{ background:#3a3f44 !important; color: rgba(255,255,255,0.92); }
                    .log-title{ text-align:left; width:100%; font-size:1.3rem !important; line-height:1.15 !important; font-weight:600; word-break:break-all; }
                    .log-pre{ text-align:left; white-space:pre-wrap; max-height:70vh; overflow:auto; background:#1b1e21; border:1px solid rgba(255,255,255,0.08); padding:12px; border-radius:8px; margin:0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.9rem; line-height: 0.9; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) rgba(0,0,0,0); }
                    .log-pre::-webkit-scrollbar{ width: 8px; height: 8px; }
                    .log-pre::-webkit-scrollbar-track{ background: rgba(0,0,0,0); }
                    .log-pre::-webkit-scrollbar-thumb{ background: rgba(255,255,255,0.18); border-radius: 8px; border: 2px solid #1b1e21; }
                    .log-pre::-webkit-scrollbar-thumb:hover{ background: rgba(255,255,255,0.28); }
                    .log-line{ display:block; color: rgba(255,255,255,0.82); }
                    .log-info{ color: #22c55e; }
                    .log-warn{ color: #eab308; }
                    .log-error{ color: #ef4444; }
                    .log-debug{ color: #3b82f6; }
                    .log-verbose{ color: #d946ef; }
                </style><pre class="log-pre">${htmlLines}</pre>`,
                width: '80vw',
                customClass: { popup: 'log-view-popup', title: 'log-title' },
                showCloseButton: true,
                showConfirmButton: false,
                showCancelButton: false,
                didOpen: () => scheduleScrollLogPopupPreToBottom(),
            })
        })
        .catch((err) => { log.error(err) })
}

function normalizeFsPath(p){
    return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '')
}

function buildLogViewerTitle(workdirectory, filepath, filename){
    const wd = normalizeFsPath(workdirectory)
    const fp = normalizeFsPath(filepath)
    const base = filename || (fp ? fp.split('/').pop() : 'log')
    if (wd && fp.startsWith(`${wd}/`)) {
        return fp.slice(wd.length + 1)
    }
    return base
}

function detectLogLevel(line){
    const s = String(line || '')
    const m = s.match(/\b(info|warn|error|debug|verbose)\b/i)
    if (!m) return null
    return m[1].toLowerCase()
}





// fetch file from disc - show preview
function loadImage(file){
    readWorkdirFileForDashboard(this, file)
        .then( (raw) => {
            const data = raw instanceof ArrayBuffer ? raw : new Uint8Array(raw).buffer
            this.currentpreviewPath = file
            this.currentpreviewname = file.split('/').pop(); //needed for preview buttons
  
            

            this.currentpreviewBase64 = Buffer.from(data).toString('base64');
            this.currentpreviewType = "image"
            this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "image/jpeg"}))
            this.activesheetsPreviewPdf = null;
            this.webviewVisible = false;
            document.querySelector("#pdfpreview").style.display = 'block';
        }).catch(err => { log.error(err)});     
}



// fetches latest files of all connected students in one combined pdf
async function getLatest(){

    let submissions = await ipcRenderer.invoke('getSubmissions', this.servername, JSON.stringify(this.serverstatus))


    this.visualfeedback(this.$t("dashboard.summarizepdf"))
    try {
        const responseObj = await window.ipcRenderer.invoke('buildTeacherCombinedLatestPdf', {
            servername: this.servername,
            servertoken: this.servertoken,
            submissions,
        })
        if (!responseObj || responseObj.status !== 'success') {
            log.error('filemanager @ getLatest:', responseObj)
            return
        }
        if (!responseObj.pdfBuffer ){
            log.info("filemanager @ getLatest: latest work not found")
            this.visualfeedback(this.$t("dashboard.nopdf"))
            return
        }
        const warning = responseObj.warning;
        if (warning){
            this.$swal.close();
            this.visualfeedback(this.$t("dashboard.oldpdfwarning",2000))
            await sleep(2000)
        }
        // show pdf
        this.loadPDF(responseObj.pdfPath, "combined.pdf")
    } catch (err) {
        log.error(err)
    }
}















/** 
 *  PRINT REQUEST
 *  show info (who sent the request) and wait for confirmation // handle multiple print requests (send "printrequest denied" if there is already an ongoing request)
 *  introduce printlock variable that blocks additional popups
 */
async function processPrintrequest(student){

    if (this.serverstatus?.directPrintAllowed){
        log.info(`filemanager @ managePrintrequest: direct print from ${student.clientname} accepted`)
        this.status(`Druckauftrag von ${student.clientname} verarbeitet`)
       
        this.printBase64(student.printrequest, 'pdf', `${student.clientname}.pdf`)
        return                   //if direct print is allowed this task ends here
    }

    // If there already is an ongoing printrequest - deny and delete printrequest
    if (this.printrequest){  // inform student that request was denied
        log.info("filemanager @ managePrintrequest: decline ")
        this.setStudentStatus({printdenied:true}, student.token)
        return                    //print denied because the teacher is already reviewing another one
    }




    //print allowed block others for now
    this.printrequest = student.clientname // we allow it and block others for the time beeing (we store student name to compare in dashboard)
    log.info(`filemanager @ managePrintrequest: print request from ${student.clientname} accepted`)
    

    swalQueued({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions',
            htmlContainer: 'my-html-container'
        },
        title: this.$t("dashboard.printrequest"),
        html:  `<div class="my-content">Von:<b> ${student.clientname}</b> <br><br>${this.$t("dashboard.printrequestshow")}</div>`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        confirmButtonColor: '#0aa2c0',
    })
    .then((result) => {
        this.printrequest = false // allow new requests
        if (result.isConfirmed) {
         
            // show pdf preview
        
            this.currentpreviewBase64 = student.printrequest
            this.currentpreview = `data:application/pdf;base64,${this.currentpreviewBase64}`;
            this.currentpreviewname = `${student.clientname}.pdf`;  // needed for the preview buttons
            this.currentpreviewType = "pdf";
            
            this.activesheetsPreviewPdf = null;
            this.webviewVisible = false;
            document.querySelector("#pdfpreview").style.display = 'block';
        }
        else {
            this.setStudentStatus({printdenied:true}, student.token)  //inform student that request was denied
        }
    }).catch(err => { log.error(err)});
}





// show base64 encoded pdf in preview panel
async function showBase64FilePreview(base64, filename){

    this.urlForWebview = null;
    this.webviewVisible = false;

    let cleanBase64 = base64;
    if (base64.includes(',')) {
        cleanBase64 = base64.split(',')[1];
    }
    try {
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        await maybePromptVerifySignedSubmissionPdf(this, bytes)
    } catch (e) {
        log.warn('filemanager @ showBase64FilePreview: signature probe skipped', e)
    }

    this.currentpreviewBase64 = base64
    this.currentpreviewType = "pdf";
    this.currentpreviewname = filename

    // Convert base64 to blob URL
    try {
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        this.currentpreview = blobUrl;
    } catch (error) {
        console.error('Error converting base64 to blob:', error);
        // Fallback: use the original base64 string
        this.currentpreview = base64;
    }

    this.activesheetsPreviewPdf = null;
    document.querySelector("#pdfpreview").style.display = 'block';
}



// show base64 encoded PDF in PdfRenderer component
function showBase64PdfInRenderer(base64, filename, group){
    if (group) {
        this.activesheetsPreviewGroup = group;
        const section = this.serverstatus.examSections[this.serverstatus.activeSection];
        const fileObj = group === 'B' ? section.groupB?.examConfig?.activeSheets : section.groupA?.examConfig?.activeSheets;
        this.activesheetsPreviewCustomFields = fileObj?.customFields ? JSON.parse(JSON.stringify(fileObj.customFields)) : [];
        this.activesheetsPreviewBlacklist = fileObj?.blacklist ? [...fileObj.blacklist] : [];
    }

    this.activesheetsPreviewFilename = filename;
    this.activesheetsPreviewPdf = base64;
    this.currentpreview = null;
    this.webviewVisible = false;
    document.querySelector("#pdfpreview").style.display = 'block';
}

// show base64 encoded image in preview panel
function showBase64ImagePreview(base64, filename){

    this.urlForWebview = null;
    this.webviewVisible = false;

    this.currentpreviewBase64 = base64
    this.currentpreview = `${this.currentpreviewBase64}`;
    this.currentpreviewType = "image";
    this.currentpreviewname = filename
    
    this.activesheetsPreviewPdf = null;
    document.querySelector("#pdfpreview").style.display = 'block';
}







async function openLatestFolder(student){
    const response = await ipcRenderer.invoke("getLatestBakFile", this.servername, student.clientname)
    if (response.latestBackupDirectoryPath){
        this.loadFilelist(response.latestBackupDirectoryPath)
        this.showWorkfolder()
    }       
    else {
        this.loadFilelist(this.workdirectory)
        this.showWorkfolder()
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}




//print pdf in focus - uses window.print()
async function printBase64(documentBase64 = this.currentpreviewBase64, type = this.currentpreviewType, jobTitle) {
    if (!this.defaultPrinter){
        this.showSetup()
        return
    }
    const title = (jobTitle != null && String(jobTitle).trim() !== '')
        ? String(jobTitle).trim()
        : (this.currentpreviewname && String(this.currentpreviewname).trim()) || 'Next-Exam'
    this.visualfeedback(this.$t('dashboard.printJobSent'))
    try {
        await ipcRenderer.invoke('printBase64', documentBase64, this.defaultPrinter, type, title)
    } catch (e) {
        log.error(`filemanager @ printBase64: ${e.message}`)
    }
}


async function loadFilelist(directory){
    try {
        const res = await window.ipcRenderer.invoke('listTeacherWorkdir', {
            servername: this.servername,
            servertoken: this.servertoken,
            dir: directory,
        })
        if (!res || res.status !== 'success' || !Array.isArray(res.filelist)) {
            log.error('filemanager @ loadFilelist:', res)
            return
        }
        const filelist = res.filelist
        // Resolve parent from listTeacherWorkdir meta row before sort (pinned dirs/files move it away from index 0).
        const dirMeta = filelist.find((e) => typeof e?.parentdirectory === 'string' && typeof e?.currentdirectory === 'string')
        const listedParentDir = dirMeta ? dirMeta.parentdirectory : ''
        //log.error(filelist)
        const pinnedDirs = ['ABGABE', 'logfiles', 'screenshots'];
        filelist.sort((a, b) => {
            const aPin = a.type === 'dir' && pinnedDirs.includes(a.name) ? 0 : (a.type === 'dir' ? 1 : 2);
            const bPin = b.type === 'dir' && pinnedDirs.includes(b.name) ? 0 : (b.type === 'dir' ? 1 : 2);
            if (aPin !== bPin) return aPin - bPin;
            return String(a.name || '').localeCompare(String(b.name || ''))
        })
        this.localfiles = filelist;
        this.currentdirectory = directory
        this.currentdirectoryparent = listedParentDir
        if (directory === this.workdirectory) {this.showWorkfolder(); }
    } catch (err) {
        log.error(err)
    }
}
 
export {loadFilelist, getLatest, processPrintrequest, loadImage, loadPDF, loadTextFile, dashboardExplorerSendFile, downloadFile, showWorkfolder, fdelete, openLatestFolder, printBase64, showBase64FilePreview, showBase64ImagePreview, showBase64PdfInRenderer}