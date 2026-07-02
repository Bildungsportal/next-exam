import log from 'electron-log/renderer';
import { Buffer } from 'buffer';
import { swalQueued } from './swalQueue.js'
import { maybePromptVerifySignedSubmissionPdf } from './submissionPdfPreview.js'
import { parsePdfToPages, ensurePdfOverlayFontsReady } from 'next-exam-shared/pdfparser/index.js'
import { parseActivesheetsFormDataJson, diffActivesheetsFormData } from 'next-exam-shared/activesheetsFormData.js'

/**
 * Dashboard explorer: read file bytes from the active exam workdir (decrypted in main when applicable).
 * Used by showPDFPreview, loadTextFile, loadImage, loadHtmlFile in this module.
 */
async function readWorkdirFileForDashboard(ctx, filepath, { optional = false } = {}) {
    const res = await window.ipcRenderer.invoke('readTeacherWorkdirFile', {
        servername: ctx.servername,
        servertoken: ctx.servertoken,
        filepath,
    })
    if (res?.status === 'success' && res.data != null) return res.data
    if (optional && res?.code === 'ENOENT') return null
    throw new Error(res?.message || 'read failed')
}

// Copy IPC/file bytes into a standalone Uint8Array (handles Buffer JSON and subarrays).
function normalizeWorkdirBytes(raw) {
    if (raw && typeof raw === 'object' && raw.type === 'Buffer' && Array.isArray(raw.data)) {
        return Uint8Array.from(raw.data);
    }
    if (raw instanceof Uint8Array) {
        return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    }
    if (raw instanceof ArrayBuffer) {
        return new Uint8Array(raw);
    }
    if (ArrayBuffer.isView(raw)) {
        return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    }
    return new Uint8Array(raw);
}

function workdirBytesToUtf8(raw) {
    const buf = normalizeWorkdirBytes(raw);
    return new TextDecoder('utf-8').decode(buf);
}

function activesheetsCorrectionTemplatePath(workdir, pdfFilename) {
    const base = String(pdfFilename || 'unknown.pdf').split(/[/\\]/).pop();
    const stem = base.replace(/\.[^.]+$/i, '') || 'unknown';
    const safeStem = stem.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_') || 'unknown';
    return `${workdir}/activesheets/${safeStem}_korrekturvorlage.htm`;
}

function resolveStudentFromAbgabePath(vm, filepath) {
    if (vm.activestudent) return vm.activestudent;
    const parts = String(filepath || '').replace(/\\/g, '/').split('/');
    const abgabeIdx = parts.indexOf('ABGABE');
    if (abgabeIdx > 0) {
        const clientname = parts[abgabeIdx - 1];
        return (vm.studentlist || []).find((s) => s.clientname === clientname) || null;
    }
    return null;
}

function resolveSubmissionStudentGroup(vm, filepath) {
    const student = resolveStudentFromAbgabePath(vm, filepath);
    const section = vm.serverstatus?.examSections?.[vm.serverstatus.activeSection];
    if (!student || !section) return 'A';
    if (section.groups) {
        if (student.status?.group === 'b') return 'B';
        if (section.groupB?.users?.includes(student.clientname)) return 'B';
        return 'A';
    }
    return 'A';
}

function base64ToUint8Array(data) {
    const commaIndex = data.indexOf(',');
    const pureBase64 = commaIndex >= 0 ? data.slice(commaIndex + 1) : data;
    const binaryString = atob(pureBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
}

// Load template + submission .htm and parse base PDF field geometry for correction UI.
async function loadActivesheetsCorrectionContext(vm, pdfFilepath) {
    vm.activesheetsCorrection = null;
    if (!String(pdfFilepath || '').replace(/\\/g, '/').includes('/ABGABE/')) return;
    if (/-korrigiert\.pdf$/i.test(pdfFilepath)) return; // bereits korrigierte Ausgabe nicht erneut als korrigierbar markieren
    const section = vm.serverstatus?.examSections?.[vm.serverstatus.activeSection];
    if (!section || section.examtype !== 'activesheets') return;

    const groupKey = resolveSubmissionStudentGroup(vm, pdfFilepath) === 'B' ? 'groupB' : 'groupA';
    const activeSheets = section[groupKey]?.examConfig?.activeSheets;
    if (!activeSheets?.filecontent) return;

    let submissionFormData = null;
    let templateFormData = null;
    let disabledReason = null;

    const htmPath = pdfFilepath.replace(/\.pdf$/i, '.htm');
    const htmRaw = await readWorkdirFileForDashboard(vm, htmPath, { optional: true });
    if (htmRaw == null) {
        log.warn('filemanager @ loadActivesheetsCorrectionContext: no submission htm found');
        disabledReason = vm.$t('pdf.correctionNoSubmissionHtm');
    } else {
        submissionFormData = parseActivesheetsFormDataJson(workdirBytesToUtf8(htmRaw));
    }

    const templatePath = activesheetsCorrectionTemplatePath(vm.workdirectory, activeSheets.filename);
    const tplRaw = await readWorkdirFileForDashboard(vm, templatePath, { optional: true });
    if (tplRaw == null) {
        log.warn('filemanager @ loadActivesheetsCorrectionContext: no autocorrect template found');
        disabledReason = disabledReason || vm.$t('pdf.correctionNoTemplate');
    } else {
        templateFormData = parseActivesheetsFormDataJson(workdirBytesToUtf8(tplRaw));
    }

    let baseParsedPages = [];
    const customFields = activeSheets.customFields ? JSON.parse(JSON.stringify(activeSheets.customFields)) : [];
    const blacklist = activeSheets.blacklist ? [...activeSheets.blacklist] : [];

    if (templateFormData) {
        try {
            await ensurePdfOverlayFontsReady();
            baseParsedPages = await parsePdfToPages(base64ToUint8Array(activeSheets.filecontent));
        } catch (err) {
            log.error('filemanager @ loadActivesheetsCorrectionContext: parse base pdf', err);
        }
    }

    const mismatchFieldIds = (templateFormData && submissionFormData)
        ? diffActivesheetsFormData(templateFormData, submissionFormData)
        : [];

    vm.activesheetsCorrection = {
        canAutocorrect: !!(templateFormData && submissionFormData),
        disabledReason: templateFormData && submissionFormData ? null : (disabledReason || vm.$t('pdf.correctionNoTemplate')),
        baseParsedPages,
        customFields,
        blacklist,
        mismatchFieldIds,
        templateFormData,
        submissionFormData,
    };
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
const EXPLORER_NON_STUDENT_ROOT_DIRS = new Set(['ABGABE', 'logfiles', 'screenshots', 'activesheets'])

/** Map explorer file path to student token via first segment under exam workdir (clientname folder). */
function resolveStudentTokenFromExplorerFile(file, workdirectory, studentlist) {
    if (!file?.path || !workdirectory || !Array.isArray(studentlist)) return ''
    const norm = (s) => String(s).replace(/\\/g, '/').replace(/\/+$/, '')
    const fp = norm(file.path)
    const root = norm(workdirectory)
    if (fp !== root && !fp.startsWith(`${root}/`)) return ''
    const rel = fp === root ? '' : fp.slice(root.length + 1)
    const folderName = rel.split('/')[0]
    if (!folderName || EXPLORER_NON_STUDENT_ROOT_DIRS.has(folderName)) return ''
    const student = studentlist.find((s) => String(s.clientname || '').toLowerCase() === folderName.toLowerCase())
    return student?.token || ''
}

function dashboardExplorerSendFile(file){
    const preselectedToken = resolveStudentTokenFromExplorerFile(file, this.workdirectory, this.studentlist)
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
        inputValue: preselectedToken,
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



// Unified PDF preview: bytes either from workdir (filepath) or from base64.
// filepath enables PDF-header validation, correction context, and external-open in pane.
async function showPDFPreview({ filepath = '', filename = '', base64 = '' } = {}) {
    try {
        let bytes
        if (filepath) {
            const raw = await readWorkdirFileForDashboard(this, filepath)
            bytes = normalizeWorkdirBytes(raw)
            if (!isValidPdf(bytes)) {
                log.info('filemanager @ showPDFPreview: pdf is not valid')
                await swalQueued({
                    icon: 'error',
                    title: this.$t('dashboard.invalidpdf'),
                    text: bytes.length >= 4 && bytes[0] === 0x4e && bytes[1] === 0x58
                        ? this.$t('pdf.encryptedCannotPreview')
                        : '',
                })
                return
            }
        } else if (base64) {
            if (filename && !/\.pdf$/i.test(String(filename))) {
                log.warn('filemanager @ showPDFPreview: not a pdf, skipped', filename)
                return
            }
            bytes = base64ToUint8Array(base64)
        } else {
            log.warn('filemanager @ showPDFPreview: no filepath or base64')
            return
        }

        try { await maybePromptVerifySignedSubmissionPdf(this, bytes) }
        catch (e) { log.warn('filemanager @ showPDFPreview: signature probe skipped', e) }

        URL.revokeObjectURL(this.currentpreview)

        // correction context only applies to /ABGABE/ submissions (loader filters internally)
        if (filepath) await loadActivesheetsCorrectionContext(this, filepath)
        else this.activesheetsCorrection = null

        this.currentpreviewBase64 = Buffer.from(bytes).toString('base64')
        this.currentpreview = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        this.currentpreviewname = filename
        this.currentpreviewPath = filepath
        this.currentpreviewType = 'pdf'

        this.activesheetsPreviewPdf = null
        this.webviewVisible = false
        document.querySelector('#pdfpreview').style.display = 'block'
    } catch (err) {
        log.error('filemanager @ showPDFPreview:', err)
    }
}

function isValidPdf(data) {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (u8.length < 5) return false;
    const header = u8.subarray(0, 5);
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

// Ensure local .htm previews stay readable when the export omits body background.
function ensureHtmlPaperBackground(html) {
    const tag = '<style>html,body{background:#fff;color:#000}</style>'
    const raw = String(html)
    if (/<\/head>/i.test(raw)) return raw.replace(/<\/head>/i, `${tag}</head>`)
    if (/<head[\s>]/i.test(raw)) return raw.replace(/<head(\s[^>]*)?>/i, `$&${tag}`)
    if (/<html[\s>]/i.test(raw)) return raw.replace(/<html(\s[^>]*)?>/i, `$&<head>${tag}</head>`)
    return `${tag}${raw}`
}

// Render local .htm/.html in the dashboard webview pane via blob URL.
async function loadHtmlFile(filepath, filename) {
    try {
        const raw = await readWorkdirFileForDashboard(this, filepath)
        const bytes = normalizeWorkdirBytes(raw)
        const html = ensureHtmlPaperBackground(workdirBytesToUtf8(bytes))

        if (this.urlForWebview?.startsWith('blob:')) {
            URL.revokeObjectURL(this.urlForWebview)
        }
        if (this.currentpreview) {
            URL.revokeObjectURL(this.currentpreview)
        }

        this.currentpreview = null
        this.currentpreviewBase64 = null
        this.currentpreviewPath = filepath
        this.currentpreviewname = filename || filepath.split('/').pop()
        this.currentpreviewType = 'html'
        this.activesheetsPreviewPdf = null
        this.activesheetsCorrection = null

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        this.urlForWebview = URL.createObjectURL(blob)
        this.webviewVisible = true
        document.querySelector('#pdfpreview').style.display = 'block'
    } catch (err) {
        log.error('filemanager @ loadHtmlFile:', err)
    }
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
        this.showPDFPreview({ filepath: responseObj.pdfPath, filename: 'combined.pdf' })
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






// show base64 encoded PDF in PdfRenderer component
async function showBase64PdfInRenderer(base64, filename, group){
    if (group) {
        this.activesheetsPreviewGroup = group;
        const section = this.serverstatus.examSections[this.serverstatus.activeSection];
        const fileObj = group === 'B' ? section.groupB?.examConfig?.activeSheets : section.groupA?.examConfig?.activeSheets;
        this.activesheetsPreviewCustomFields = fileObj?.customFields ? JSON.parse(JSON.stringify(fileObj.customFields)) : [];
        this.activesheetsPreviewBlacklist = fileObj?.blacklist ? [...fileObj.blacklist] : [];
    }

    this.activesheetsPreviewFilename = filename;
    this.activesheetsPreviewInitialFormData = null;
    const templatePath = activesheetsCorrectionTemplatePath(this.workdirectory, filename);
    try {
        const raw = await readWorkdirFileForDashboard(this, templatePath);
        this.activesheetsPreviewInitialFormData = parseActivesheetsFormDataJson(workdirBytesToUtf8(raw));
    } catch {
        this.activesheetsPreviewInitialFormData = null;
    }

    this.activesheetsPreviewPdf = base64;
    this.activesheetsCorrection = null;
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

// Persist activesheets correction template JSON (.htm) under workdir/<server>/activesheets/.
async function saveActivesheetsCorrectionTemplate(formData) {
    const pdfName = this.activesheetsPreviewFilename || formData?.filename || 'unknown.pdf';
    try {
        const res = await window.ipcRenderer.invoke('saveActivesheetsCorrectionTemplate', {
            servername: this.servername,
            servertoken: this.servertoken,
            sourcePdfFilename: pdfName,
            formData,
        });
        if (res?.status === 'success') {
            await this.$swal.fire({
                icon: 'success',
                title: this.$t('pdf.correctionTemplateSavedTitle'),
                text: `activesheets/${res.filename}`,
                timer: 3500,
                timerProgressBar: true,
            });
            return;
        }
        await this.$swal.fire({
            icon: 'error',
            title: this.$t('pdf.correctionTemplateSavedTitle'),
            text: res?.message || 'Save failed',
        });
    } catch (err) {
        log.error('filemanager @ saveActivesheetsCorrectionTemplate:', err);
        await this.$swal.fire({ icon: 'error', text: String(err?.message || err) });
    }
}
 
async function saveActivesheetsCorrectedPdf() {
    if (!this.currentpreviewPath) return;
    try {
        const cap = await window.ipcRenderer.invoke('captureTeacherPreviewPdf');
        if (cap?.status !== 'success' || !cap.base64pdf) {
            await this.$swal.fire({ icon: 'error', text: cap?.message || 'PDF capture failed' });
            return;
        }
        // Korrektur in separate Datei -korrigiert.pdf neben dem Original speichern; Anzeige bleibt unveraendert
        const correctedPath = this.currentpreviewPath.replace(/(\.pdf)$/i, '-korrigiert$1');
        const res = await window.ipcRenderer.invoke('overwriteTeacherAbgabePdf', {
            servername: this.servername,
            servertoken: this.servertoken,
            filepath: correctedPath,
            base64pdf: cap.base64pdf,
        });
        if (res?.status === 'success') {
            await this.$swal.fire({
                icon: 'success',
                title: this.$t('pdf.correctionSaved'),
                timer: 3000,
                timerProgressBar: true,
            });
            return;
        }
        await this.$swal.fire({ icon: 'error', text: res?.message || 'Save failed' });
    } catch (err) {
        log.error('filemanager @ saveActivesheetsCorrectedPdf:', err);
        await this.$swal.fire({ icon: 'error', text: String(err?.message || err) });
    }
}

export {loadFilelist, getLatest, processPrintrequest, loadImage, showPDFPreview, loadTextFile, loadHtmlFile, dashboardExplorerSendFile, downloadFile, showWorkfolder, fdelete, openLatestFolder, printBase64, showBase64ImagePreview, showBase64PdfInRenderer, saveActivesheetsCorrectionTemplate, saveActivesheetsCorrectedPdf, base64ToUint8Array}