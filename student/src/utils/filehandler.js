import { Buffer } from 'buffer';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';
import {SignalBridge} from './signalBridge.js';
import {odtToTiptapHtml} from './odtToTiptapHtml.js';
import { resolveEditorExamConfig, resolveGroupKey } from 'next-exam-shared/editorExamConfig.js';

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);

/** Read audioRepeat from group.examConfig.editor for the active locked section. */
function editorAudioRepeatLimit(vm) {
    const sectionIndex = vm.lockedSection ?? vm.serverstatus?.activeSection ?? 1;
    const section = vm.serverstatus?.examSections?.[sectionIndex];
    if (!section) return 0;
    const groupKey = resolveGroupKey(section, vm.clientinfo?.group);
    return Number(resolveEditorExamConfig(section, groupKey).audioRepeat) || 0;
}

/** Resets PdfviewPane toolbar visibility when closing preview (Vue-driven, not DOM hacks). */
export function resetPdfPreviewToolbar(vm) {
    Object.assign(vm.pdfPreviewUi, {
        showInsert: false,
        showPrint: false,
        showSend: false,
        showZoom: false,
    });
}

/** showUrl() hides .embed-container; clear that inline style when showing PDF/image again. */
function restorePdfPreviewRoot() {
    const preview = document.querySelector('#preview');
    if (!preview) return;
    const root = preview.querySelector('.embed-container');
    if (root) root.style.removeProperty('display');
}

// fetch file from disc - show preview
export async function loadPDF(file, base64 = false, zoom=180, submission=false, type="send"){

    
    if (this.examtype == 'microsoft365'){
        signalBridge.send('collapse-browserview')
    }

    

    
    this.currentPDFZoom = zoom
    URL.revokeObjectURL(this.currentpreview);
    this.webviewVisible = false
    const filename = typeof file === 'string' ? file : (file?.filename || file?.name || file?.originalname || '');
    let fallbackUrl = '';
    
    if (base64){
        const response = await fetch(file.filecontent); // load the data URL  //filecontent contains a url data:application/pdf;base64,b23d342dsn2....
        const blob = await response.blob(); // convert to blob
        this.currentpreview = URL.createObjectURL(blob); // create object URL
        this.currentpreviewBase64 = file.filecontent.split(',')[1];  // we only need the base64 data not the complete url
        fallbackUrl = file.filecontent || '';
    }
    else {   //fetch file from filesystem
        let data = await signalBridge.invoke('getpdfasync', file )
        let isvalid = isValidPdf(data)
        if (!isvalid){
            this.$swal.fire({
                title: this.$t("general.error"),
                text: this.$t("general.nopdf"),
                icon: "error",
                timer: 3000,
                showCancelButton: false,
                didOpen: () => { this.$swal.showLoading(); },
            })
            resetPdfPreviewToolbar(this);
            return
        }
        this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "application/pdf"})) 
        this.currentpreviewBase64 = Buffer.from(data).toString('base64');
    }

    this.pdfPreviewState = {
        kind: 'pdf',
        url: this.currentpreview,
        filename,
        fallbackUrl,
    };



    //hide/show some buttons
    const preview = document.querySelector("#preview");
    if (preview) preview.style.display = 'block';
    restorePdfPreviewRoot();

    Object.assign(this.pdfPreviewUi, {
        showInsert: false,
        showPrint: !!(submission && type === 'print'),
        showSend: !!(submission && type === 'send'),
        showZoom: true,
    });

   
}

//checks if arraybuffer contains a valid pdf file
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


function parseHTMLString(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    doc.querySelectorAll('td').forEach(td => {
        if (!td.innerHTML.trim()) {
        td.innerHTML = '<p></p>'; // Ensure empty cells have a paragraph with a line break
        }
    });
    return doc.body;
}

function processNode(node) {           
    let nodestring = node.innerHTML
    let outernodestring = node.outerHTML
   
    if (nodestring.includes("data:image")){
        for (let childnode of node.childNodes){
            let childnodestring = childnode.outerHTML
            if (childnodestring.includes("data:image")){
                let childnodesource = childnode.src 
               
                this.editor.commands.insertContent(nodestring)
                this.editor.chain().focus().setImage({ src:  childnodesource }).run();
            }
        }
    }
    else if (nodestring.includes("tr")){
        console.log("found table")
        this.editor.commands.insertContent(outernodestring)
    }

    else {
       
        this.editor.commands.insertContent(outernodestring)
    }
}


// get file from local examdirectory and replace editor content with it
export async function loadHTML(file){
    let data = await signalBridge.invoke('getfilesasync', file )
    this.LTdisable()
    this.$swal.fire({
        title: this.$t("editor.replace"),
        html:  `${this.$t("editor.replacecontent1")} <b>${file}</b> ${this.$t("editor.replacecontent2")}`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("editor.cancel"),
        reverseButtons: true
    })
    .then(async (result) => {
        if (result.isConfirmed) {
            
            this.editor.commands.clearContent(true)
            this.editor.commands.insertContent(data)  
            //set currentFile to the loaded filename remove extension .htm from filename
            let filename = file.replace(/\.htm$/, '')  //remove extension .htm from filename
            if (/[/\\]/.test(filename) || filename.includes('..')) {
                filename = this.clientname
            }
            this.currentFile = filename
        } 
    }); 
}



// get file from local examdirectory and replace editor content with it (silent=true skips confirm dialog, e.g. teacher-set editor template on startup)
export async function loadDOCX(file, base64 = false, silent = false) {
    let filename = file;
    if (base64) {
        filename = file.filename;
    }

    const doLoad = async () => {
        this.LTdisable();
        if (base64) {
            const response = await fetch(file.filecontent);
            const arrayBuffer = await response.arrayBuffer();
            const mammothResult = await mammoth.convertToHtml({ arrayBuffer });
            const html = mammothResult.value;
            this.editor.commands.clearContent(true);
            this.editor.commands.insertContent(html);
        } else {
            const data = await signalBridge.invoke('getfilesasync', file, false, true);
            this.editor.commands.clearContent(true);
            const cleanHtml = DOMPurify.sanitize(data.value);
            parseHTMLString(cleanHtml);
            this.editor.commands.insertContent(cleanHtml);
        }
        if (base64 && filename) {
            let stem = String(filename).replace(/\.docx$/i, '');
            if (/[/\\]/.test(stem) || stem.includes('..')) {
                stem = this.clientname;
            }
            this.currentFile = stem;
        }
    };

    if (silent) {
        try {
            await doLoad();
        } catch (err) {
            console.error('filehandler @ loadDOCX:', err);
            this.$swal.fire({
                title: this.$t('general.error'),
                text: String(err?.message || err),
                icon: 'error',
                timer: 4000,
            });
        }
        return;
    }

    this.$swal.fire({
        title: this.$t("editor.replace"),
        html: `${this.$t("editor.replacecontent1")} <b>${filename}</b> ${this.$t("editor.replacecontent2")}`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("editor.cancel"),
        reverseButtons: true,
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await doLoad();
            } catch (err) {
                console.error('filehandler @ loadDOCX:', err);
                this.$swal.fire({
                    title: this.$t('general.error'),
                    text: String(err?.message || err),
                    icon: 'error',
                    timer: 4000,
                });
            }
        }
    });
}

/** Loads an ODT from disk or base64 material into the TipTap editor (renderer converts via odtToTiptapHtml). silent=true skips confirm dialog. */
export async function loadODT(file, base64 = false, silent = false) {
    let filename = file;
    if (base64) {
        filename = file.filename;
    }

    const doLoad = async () => {
        this.LTdisable();
        let arrayBuffer;
        if (base64) {
            const response = await fetch(file.filecontent);
            arrayBuffer = await response.arrayBuffer();
        } else {
            const b64 = await signalBridge.invoke('getfilesasync', file, false, false, true);
            if (!b64 || typeof b64 !== 'string') {
                this.$swal.fire({
                    title: this.$t('general.error'),
                    text: this.$t('general.error'),
                    icon: 'error',
                    timer: 2500,
                });
                return;
            }
            const bin = atob(b64);
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            arrayBuffer = u8.buffer;
        }
        const { html } = await odtToTiptapHtml(arrayBuffer);
        const cleanHtml = DOMPurify.sanitize(html);
        const body = parseHTMLString(cleanHtml);
        this.editor.commands.clearContent(true);
        this.editor.commands.insertContent(body.innerHTML);
        let stem = String(filename).replace(/\.odt$/i, '');
        if (/[/\\]/.test(stem) || stem.includes('..')) {
            stem = this.clientname;
        }
        this.currentFile = stem;
    };

    if (silent) {
        try {
            await doLoad();
        } catch (err) {
            console.error('filehandler @ loadODT:', err);
            this.$swal.fire({
                title: this.$t('general.error'),
                text: String(err?.message || err),
                icon: 'error',
                timer: 4000,
            });
        }
        return;
    }

    this.$swal.fire({
        title: this.$t('editor.replace'),
        html: `${this.$t('editor.replacecontent1')} <b>${filename}</b> ${this.$t('editor.replacecontent2')}`,
        icon: 'question',
        showCancelButton: true,
        cancelButtonText: this.$t('editor.cancel'),
        reverseButtons: true,
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await doLoad();
            } catch (err) {
                console.error('filehandler @ loadODT:', err);
                this.$swal.fire({
                    title: this.$t('general.error'),
                    text: String(err?.message || err),
                    icon: 'error',
                    timer: 4000,
                });
            }
        }
    });
}


// fetch file from disc - show preview
export async function loadImage(file, base64=false){
    if (this.examtype == 'microsoft365'){
        signalBridge.send('collapse-browserview')
    }


    URL.revokeObjectURL(this.currentpreview);

    this.webviewVisible = false
    const filename = typeof file === 'string' ? file : (file?.filename || file?.name || file?.originalname || '');

    if (base64){
        const response = await fetch(file.filecontent); // load the data URL  //filecontent contains a url data:application/pdf;base64,b23d342dsn2....
        const blob = await response.blob(); // convert to blob
        this.currentpreview = URL.createObjectURL(blob); // create object URL
        this.currentpreviewBase64 = file.filecontent.split(',')[1];  // we only need the base64 data not the complete url
    }
    else {
        let data = await signalBridge.invoke('getpdfasync', file )
        this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "image/jpeg"})) 
        this.currentpreviewBase64 = Buffer.from(data).toString('base64');
    }

    this.pdfPreviewState = {
        kind: 'image',
        url: this.currentpreview,
        filename,
        fallbackUrl: base64 ? (file?.filecontent || '') : '',
    };



    Object.assign(this.pdfPreviewUi, {
        showInsert: true,
        showPrint: false,
        showSend: false,
        showZoom: false,
    });

    const preview = document.querySelector("#preview");
    if (preview) preview.style.display = 'block';
    restorePdfPreviewRoot();
}



/**
 * plays an audiofile
 * either shows dialog with limited amount of replays or player controls if unlimited
 * @param {*} file the name of the audiofile to be played
 */
export async function playAudio(file, base64=false) {
    // get filename string for both base64 and non-base64 cases
    const filename = base64 ? file.filename : file;
    let audioFile = this.audiofiles.find(obj => obj.name === filename);  // search for file in this.audiofiles - get object
    this.LTdisable()  // close langugagetool

    if (!audioFile){
        // create audioFile object if it doesn't exist (for both base64 and non-base64 files)
        audioFile = {name: filename, playbacks: editorAudioRepeatLimit(this)}
        this.audiofiles.push(audioFile)
    }

    const audioRepeatLimit = editorAudioRepeatLimit(this);
    if (audioRepeatLimit > 0){
        this.$swal.fire({
            title: audioFile.name,
            text:  this.$t("editor.reallyplay"),
            icon: "question",
            showCancelButton: true,
            cancelButtonText: this.$t("editor.cancel"),
            reverseButtons: true,

            html: audioFile.playbacks > 0 ? `
                
                <span class="col-3" style="">${this.$t("editor.audioremaining")} ${audioFile.playbacks} </span> <br>
                <div id="soundtest" class="btn btn-info btn-sm m-2">Soundtest</div><br>
                <h6>${this.$t("editor.reallyplay")}</h6>
            ` : `
                    <div id="soundtest" class="btn btn-info btn-sm m-2">Soundtest</div><br>
                <span class="col-3" style="">${this.$t("editor.audionotallowed")}</span> 
            `,
            didRender: () => {
                const ap = document.getElementById('audioPlayer');
                const btn = document.getElementById('soundtest');
                btn.disabled = ap && !ap.paused && !ap.ended;
                btn.onclick = () => { if (ap && !ap.paused && !ap.ended) return; soundtest(this); };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                if (audioFile.playbacks > 0){
                    try {
                        
                        const base64Data = !base64 ? await signalBridge.invoke('getfilesasync', file, true) : file.filecontent.split(',')[1];
                        
                        if (base64Data) {
                            this.audioSource = `data:audio/mp3;base64,${base64Data}`;
                            audioPlayer.load(); // loads the new source
                            audioPlayer.play().then(() => { 
                                console.log('filehandler @ playAudio: Playback started');
                                audioFile.playbacks -= 1
                            }).catch(e => { console.error('Playback failed:', e); });
                        } else { console.error('filehandler @ playAudio: Keine Daten empfangen'); }
                    } catch (error) { console.error('filehandler @ playAudio: Fehler beim Empfangen der MP3-Datei:', error); }   
                }
            } 
        }); 
    }
    if (editorAudioRepeatLimit(this) === 0){
        document.querySelector("#aplayer").style.display = 'block';
        try {
            
            const base64Data = !base64 ? await signalBridge.invoke('getfilesasync', file, true) : file.filecontent.split(',')[1];
            

            if (base64Data) {
                this.audioSource = `data:audio/mpeg;base64,${base64Data}`;
                audioPlayer.load(); // loads the new source
            } else { console.error('filehandler @ playAudio: Keine Daten empfangen'); }
        } catch (error) { console.error('filehandler @ playAudio: Fehler beim Empfangen der MP3-Datei:', error); } 
    }
}

async function soundtest(context){
    const ap = document.getElementById('audioPlayer');
    if (ap && !ap.paused && !ap.ended) return;
    try {
        const base64Data = await signalBridge.invoke('getAudioFile', 'attention.wav', true);
        if (base64Data) {
            let soundtest = document.getElementById('soundtest')

            if (soundtest){
                soundtest.classList.add('btn-success')
                soundtest.classList.remove('btn-info')
            }
            
            context.audioSource = `data:audio/mp3;base64,${base64Data}`;
            audioPlayer.load(); // loads the new source
            audioPlayer.play().then(async () => { 
                await context.sleep(2000)
                if (soundtest){
                    soundtest.classList.remove('btn-success')
                    soundtest.classList.add('btn-info')
                }
            }).catch(e => { console.error('filehandler @ soundtest: Playback failed:', e); });
        } else { console.error('filehandler @ soundtest: Keine Daten empfangen'); }
    } catch (error) { console.error('filehandler @ soundtest: Fehler beim Empfangen der MP3-Datei:', error); }   
}




// get file from local examdirectory and replace editor content with it
export async function loadGGB(file, base64=false){
    let filename = file
    if (base64){filename = file.filename}
    // currentFile must never contain a path (used as PDF filename on save) - fall back to clientname like the other loaders
    if (/[/\\]/.test(filename) || filename.includes('..')) {
        filename = this.clientname
    }

    this.$swal.fire({
        title: this.$t("editor.replace"),
        html:  `${this.$t("editor.replacecontent1")} <b>${filename}</b> ${this.$t("editor.replacecontent2")}`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("editor.cancel"),
        reverseButtons: true
    })
    .then(async (result) => {
        if (result.isConfirmed) {

            const applyBase64ToGgb = (base64GgbFile) => {
                if (typeof window !== 'undefined' && window.ggbApplet && typeof window.ggbApplet.setBase64 === 'function') {
                    window.ggbApplet.setBase64(base64GgbFile)
                    return true
                }
                const geogebraWebview = document.getElementById('geogebraframe');
                if (geogebraWebview && typeof geogebraWebview.executeJavaScript === 'function') {
                    const safeBase64 = JSON.stringify(base64GgbFile);
                    geogebraWebview.executeJavaScript(`window.loadBase64FromHost(${safeBase64})`);
                    return true
                }
                return false
            }

            if (!base64){
                const loadResult = await signalBridge.invoke('loadGGB', file);
                if (loadResult.status === "success") {
                    const base64GgbFile = loadResult.content;
                    if (!applyBase64ToGgb(base64GgbFile)) {
                        console.error('filehandler @ loadGGB: no GeoGebra surface (applet or webview) found'); // one line comment
                        return
                    }
                    this.currentFile = filename
                } else {
                    console.error('filehandler @ loadGGB: Error loading file');
                }
            }
            else {
                const base64GgbFile = file.filecontent.split(',')[1];
                if (!applyBase64ToGgb(base64GgbFile)) {
                    console.error('filehandler @ loadGGB: no GeoGebra surface (applet or webview) found'); // one line comment
                    return
                }
                this.currentFile = filename
            }
        } 
    }); 
}



/**
 * fetch exam materials in base64 from teacher
 */
export async function getExamMaterials(){
    let examMaterials = await signalBridge.invoke('getExamMaterials')
    
    if (examMaterials){
        this.examMaterials = examMaterials.materials
        let allowedUrls = examMaterials.allowedUrls || [];                                         // ensure array
        let currentUrls = this.allowedUrls || [];
        
        // check if allowedUrls are identical to avoid re-setting blocking
        if (JSON.stringify([...allowedUrls].sort()) === JSON.stringify([...currentUrls].sort())) {
            console.log("filehandler @ getExamMaterials: allowedUrls are identical - skipping webview blocking setup");
            return;
        }

        
        console.log("filehandler @ getExamMaterials: received new examMaterials")
        this.allowedUrls = allowedUrls


        // set up webview blocking for the webviewpane
        const webviewPane = document.getElementById('safebrowser');
        if (webviewPane) {
            console.log('filehandler @ getExamMaterials: setting WebviewPane dom-ready event to block websites');
 
            // remove existing listener if present to prevent accumulation
            if (webviewPane._blockingDomReadyHandler) {
                webviewPane.removeEventListener('dom-ready', webviewPane._blockingDomReadyHandler);
            }
            // create named handler function and store reference
            webviewPane._blockingDomReadyHandler = async () => {  // content id can only be accessed after dom-ready event                
                // try to get webContentsId with retry logic
                const tryStartBlocking = async (retries = 10, delay = 100) => {
                    for (let i = 0; i < retries; i++) {
                        if (webviewPane.getWebContentsId) {
                            const guestId = webviewPane.getWebContentsId();
                            if (guestId) {
                                // send webview id + allowlist to main process to block navigation before it happens
                                await signalBridge.invoke('start-blocking-for-webview', { guestId, allowedUrls });
                                console.log(`filehandler @ getExamMaterials: started blocking for WebviewPane ${guestId}`);
                                return;
                            }
                        }
                        // wait before retry
                        if (i < retries - 1) {
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                    console.warn('filehandler @ getExamMaterials: failed to get webContentsId after retries');
                };
                await tryStartBlocking();
            };
            webviewPane.addEventListener('dom-ready', webviewPane._blockingDomReadyHandler);
            
        } else {
            console.log('filehandler @ getExamMaterials: WebviewPane not in DOM');
        }

    } 
    else{
        this.examMaterials = []
        this.allowedUrls = []
    }
}


