<template>
    <div class="activesheets-root">
    <!-- HEADER START -->
    <exam-header
    :serverstatus="serverstatus"
      :clientinfo="clientinfo"
      :online="online"
      :clientname="clientname"
      :exammode="exammode"
      :servername="servername"
      :pincode="pincode"
      :battery="battery"
      :currenttime="currenttime"
      :timesinceentry="timesinceentry"
      :componentName="componentName"
      :localLockdown="localLockdown"
      :wlanInfo="wlanInfo"
      :hostip="hostip"
      @reconnect="reconnect"
      @gracefullyExit="gracefullyExit"
    ></exam-header>
     <!-- HEADER END -->

    <!-- filelist start - show local files from workfolder (pdf and gbb only)-->
    <div id="toolbar" class="d-inline p-1 pt-0"> 
              
        <div :title="$t('editor.splitview')" @click="toggleSplitview()"
             class="invisible-button btn btn-outline-info p-0 ms-1 me-1 mb-0 btn-sm">
            <img src="/src/assets/img/svg/view-split-left-right.svg" class="" width="22" height="22">
        </div>
        <button v-if="!localLockdown" :title="$t('editor.backup')" @click="saveContent(true, 'manual');" class="invisible-button btn btn-outline-success p-0 ms-1 me-1 mb-0 btn-sm"><img src="/src/assets/img/svg/document-save.svg" class="" width="22" height="22" ></button>
        <button v-if="!localLockdown" id="printfinalexam" class="invisible-button btn btn-outline-success p-0 ms-1 me-1 mb-0 btn-sm pe-2 ps-1" @click="sendExamToTeacher(false, 'print')" :title="$t('editor.print')"><img src="/src/assets/img/svg/print.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ $t('editor.print') }}</button>
        <button v-if="!localLockdown" id="sendfinalexam"  class="invisible-button btn btn-outline-success p-0 ms-1 me-1 mb-0 btn-sm pe-2 ps-1 " @click="sendExamToTeacher(false, 'send')" :title="$t('editor.sendfinalexam')"><img src="/src/assets/img/svg/document-send.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ $t('editor.finalsubmit') }}</button>


        <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
        <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm" @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ $t('editor.materials') }}</div>

        <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
            <div v-if="(file.filetype == 'htm')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}}</div>
            <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
            <div v-if="(file.filetype == 'audio')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="loadBase64file(file)"><img src="/src/assets/img/svg/im-google-talk.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
            <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
        </div>
        <div v-if="allowedUrls.length !== 0"  v-for="allowedUrl in allowedUrls  " class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button" :title="getUrlDisplay(allowedUrl)" @click="showUrl(getUrlDisplay(allowedUrl))">
            <img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{getUrlDisplay(allowedUrl)}}
        </div>
        <!-- exam materials end -->


        <div v-for="file in localfiles" :key="file.name" class="d-inline" style="text-align:left">
                <div v-if="(file.type == 'htm')" class="btn btn-mediumlight p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.name; loadBAK(file.name)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.name}}</div>

                
                <div v-if="(file.type == 'pdf')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
                <div v-if="(file.type == 'audio')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="playAudio(file.name)"><img src="/src/assets/img/svg/im-google-talk.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
                <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.name; loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
         </div>  



    </div>
    <!-- filelist end -->
    
  

    <div class="activesheets-body" :class="splitview ? 'split-view-container' : ''">
        <div
            id="preview"
            :class="splitview ? ['p-0', 'split-pane', 'split-pane--left', 'splitback', { 'splitback--empty': !pdfPreviewState }] : 'p-4'"
            :style="splitview ? { flexBasis: splitLeftPct + '%', '--nx-preview-scroll-padding': '6px' } : { '--nx-preview-top-offset': '60px', '--nx-preview-content-width': '90%' }"
        >
        <WebviewPane
            id="webview"
            :src="urlForWebview || ''"
            :visible="webviewVisible"
            :splitview="splitview"
            :showClose="!splitview"
            :allowed-url="urlForWebview"
            :block-external="true"
            @close="hidepreview"
        />
        <PdfviewPaneRendered
            :localLockdown="localLockdown"
            :examtype="examtype"
            :toolbar="pdfPreviewUi"
            :preview="pdfPreviewState"
            :showClose="!splitview"
            :style="!pdfPreviewState ? 'display:none;' : ''"
            @close="hidepreview"
            @printBase64="(pr) => printBase64(pr, 'manual')"
        />
        </div>
        <div
            v-if="splitview"
            class="split-divider"
            role="separator"
            aria-orientation="vertical"
            :aria-valuenow="Math.round(splitLeftPct)"
            aria-valuemin="20"
            aria-valuemax="80"
            @pointerdown.prevent="startSplitResize"
            title="Drag to resize"
        ></div>
        <div
            id="content"
            :class="splitview ? 'split-pane split-pane--right' : ''"
            :style="splitview ? { flexBasis: (100 - splitLeftPct) + '%' } : null"
        >
        <div v-if="!focus" class="focus-container">
            <div id="focuswarning" class="infodiv p-4 d-block focuswarning" >
                <div class="mb-3 row">
                    <div class="mb-3 "> {{$t('editor.leftkiosk')}} <br> {{$t('editor.tellsomeone')}} </div>
                    <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32" >
                    <div class="mt-3"> {{ formatTime(entrytime) }}</div>
                </div>
            </div>
        </div>

        <PdfOverlay
            :loading="isLoading"
            :pdf-base64="pdfBase64"
            :custom-fields="customFields"
            :blacklist="blacklist"
        />
    
        </div>
    </div>

    <div id="statusbar" style="padding-left:15px;">
        <img @click="zoomin();" src="/src/assets/img/svg/zoom-in.svg" class="zoombutton">
        <img @click="zoomout();" src="/src/assets/img/svg/zoom-out.svg" class="zoombutton">
    </div>
    </div>
</template>

<script>
import moment from 'moment-timezone';
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js'
import { gracefullyExit, reconnect, showUrl } from '../utils/commonMethods.js'
import { getExamMaterials, loadPDF, loadImage, resetPdfPreviewToolbar} from '../utils/filehandler.js'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'
import WebviewPane from '../components/WebviewPane.vue';
import PdfOverlay from '../components/PdfRenderer.vue';
import {SignalBridge} from '../utils/signalBridge.js'
import { attachExamMouseleaveGuard, shouldSkipEdgeFocusLost } from '../utils/linuxCageKiosk.js'
import { examApiFetch } from 'next-exam-shared/examApiFetch.js'

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);

// Default zoom for #content (screen); @media print hides zoom UI.
const ACTIVESHEETS_ZOOM_INITIAL = 1.0
const ACTIVESHEETS_ZOOM_MIN = 0.85
const ACTIVESHEETS_ZOOM_MAX = 2.2

export default {
    data() {
        return {
            // ... (Deine existierenden Data Properties hier behalten) ...
            componentName: 'Active Sheets',
            online: true,
            focus: true,
            exammode: false,
            examtype: this.$route.params.examtype,
            currentFile:null,
            fetchinfointerval: null,
            loadfilelistinterval: null,
            clockinterval: null,
            servername: this.$route.params.servername,
            servertoken: this.$route.params.servertoken,
            serverip: this.$route.params.serverip,
            token: this.$route.params.token,
            clientname: this.$route.params.clientname,
            serverApiPort: this.$route.params.serverApiPort,
            clientApiPort: this.$route.params.clientApiPort,
            electron: this.$route.params.electron,
            pincode : this.$route.params.pincode,
            serverstatus: this.$route.params.serverstatus,
            config: this.$route.params.config,
            localLockdown: this.$route.params.localLockdown,

            // section and url will be resolved on first fetchInfo based on allowSectionSwitch
            lockedSection: null,
            url: null,
            domain: null,

            clientinfo: null,
            entrytime: 0,
            timesinceentry: 0,
            currenttime: 0,
            now : new Date().getTime(),
            localfiles: null,
            battery: null,
          
            currentpreview: null,
            isLoading: true,
            wlanInfo: null,
            hostip: null,

            examMaterials: [],
            urlForWebview: null,
            allowedUrls: [],
            webviewVisible: false,
            allowedDomain: null, // Extracted domain for navigation validation
            
            // Event listener references for cleanup
            _onDidStartLoading: null,
            _onDidStopLoading: null,
            _onDomReady: null,
            _onPreviewClick: null,
            internetCheckCounter:0,
            
            pdfBase64: null,  // Will be set in loadPdfParserHtml based on group membership
            activeSheetPdfFilename: null,  // Filename of the Active Sheet PDF being displayed
            currentpreviewBase64: null,  // Base64 PDF for preview/submission
            submissionnumber: 0,  // Submission counter
            customFields: [],
            blacklist: [],
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
            splitview: false,
            splitLeftPct: 50,
            _splitResizing: false,
            zoom: ACTIVESHEETS_ZOOM_INITIAL,
        }
    }, 
    components: { ExamHeader, PdfviewPaneRendered, WebviewPane, PdfOverlay },  
    methods: { 
        // ... (Deine existierenden Methoden: getExamMaterials, loadPDF, etc. behalten) ...
        // from filehandler.js
        getExamMaterials:getExamMaterials,
        loadPDF:loadPDF,
        loadImage:loadImage,
        gracefullyExit:gracefullyExit,
        showUrl:showUrl,
        reconnect:reconnect,
        zoomin() {
            if (this.zoom < ACTIVESHEETS_ZOOM_MAX) this.zoom = Math.min(ACTIVESHEETS_ZOOM_MAX, this.zoom + 0.1)
            const el = document.getElementById(`content`)
            if (el) el.style.zoom = this.zoom
        },
        zoomout() {
            if (this.zoom > ACTIVESHEETS_ZOOM_MIN) this.zoom = Math.max(ACTIVESHEETS_ZOOM_MIN, this.zoom - 0.1)
            const el = document.getElementById(`content`)
            if (el) el.style.zoom = this.zoom
        },
        getUrlDisplay(allowedUrl) {
            return typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
        },
        hidepreview(){
            resetPdfPreviewToolbar(this);
            this.pdfPreviewState = null;
            let preview = document.querySelector("#preview")
            if (!this.splitview) preview.style.display = 'none';
            preview.setAttribute("src", "about:blank");
            URL.revokeObjectURL(this.currentpreview);
        },

        toggleSplitview() {
            const next = !this.splitview;
            this.splitview = next;
            this.$nextTick(() => {
                const preview = document.querySelector("#preview");
                if (!preview) return;

                // entering splitview: remove inline display:none so CSS layout can size the pane
                if (this.splitview) {
                    preview.style.display = '';
                    if (this._onPreviewClick) preview.removeEventListener("click", this._onPreviewClick);
                    return;
                }

                // leaving splitview: also close preview (no overlay left behind)
                resetPdfPreviewToolbar(this);
                this.pdfPreviewState = null;
                preview.style.display = 'none';
                URL.revokeObjectURL(this.currentpreview);
                if (this._onPreviewClick) preview.addEventListener("click", this._onPreviewClick);
            });
        },

        startSplitResize(e) {
            if (!this.splitview) return;
            this._splitResizing = true;
            window.addEventListener('pointermove', this.onSplitResizeMove, { passive: false });
            window.addEventListener('pointerup', this.stopSplitResize, { passive: true });
            window.addEventListener('pointercancel', this.stopSplitResize, { passive: true });
            this.onSplitResizeMove(e);
        },

        onSplitResizeMove(e) {
            if (!this._splitResizing) return;
            e.preventDefault();
            const container = document.querySelector('.split-view-container');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
            const pct = (x / rect.width) * 100;
            const minLeftPx = 320;
            const minRightPx = 420;
            const minPct = (minLeftPx / rect.width) * 100;
            const maxPct = 100 - (minRightPx / rect.width) * 100;
            const clamped = Math.min(Math.max(pct, minPct), maxPct);
            this.splitLeftPct = Math.min(80, Math.max(20, Math.round(clamped * 10) / 10));
        },

        stopSplitResize() {
            this._splitResizing = false;
            window.removeEventListener('pointermove', this.onSplitResizeMove);
            window.removeEventListener('pointerup', this.stopSplitResize);
            window.removeEventListener('pointercancel', this.stopSplitResize);
        },
        loadBase64file(file){
            this.webviewVisible = false
            if (file.filetype == 'pdf'){
                this.loadPDF(file, true)
                return
            }
            else if (file.filetype == 'image'){
                this.loadImage(file, true)
                return
            }
        },
       
        async sendFocuslost(){
            if (await shouldSkipEdgeFocusLost(signalBridge, this.config.development)) return;
            let response = await signalBridge.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
            if (!this.config.development && !response.focus){  //immediately block frontend
                this.focus = false 
            }  
        },





        async loadFilelist(){
            let filelist = await signalBridge.invoke('getfilesasync', null)
            this.localfiles = filelist;
        },
        
        async loadBackupFile(filename=false){
            // check if there is an htm backup in the exam directory and load it
            // This must run early to read the file before it gets overwritten
            let backupfileName = filename ? filename : this.clientname + ".htm"
            console.log(`activesheets @ loadBackupFile: Checking for backup file: ${backupfileName}`)
            try {
                let backupfileContent = await signalBridge.invoke('getbackupfile', backupfileName )
               
                if (backupfileContent){
                    // Validate that the content is JSON-parseable before offering to load it
                    try {
                        JSON.parse(backupfileContent);
                    } catch (parseError) {
                        console.warn(`activesheets @ loadBackupFile: Backup file content is not valid JSON, skipping: ${parseError.message}`);
                        return; // Don't show dialog if content is not valid JSON
                    }
                    
                    console.log(`activesheets @ loadBackupFile: Backup file found with valid JSON, waiting for PDF renderer to be ready before showing dialog`)
                    // Wait for PDF renderer to be fully initialized before showing dialog
                    const waitForPdfRenderer = async () => {
                        let attempts = 0
                        const maxAttempts = 50 // 5 seconds max wait
                        
                        while (attempts < maxAttempts) {
                            // Check if PDF renderer is ready by looking for interactive inputs
                            const hasInputs = document.querySelectorAll('.interactive-input').length > 0
                            if (hasInputs || !this.isLoading) {
                                console.log(`activesheets @ loadBackupFile: PDF renderer ready, showing dialog`)
                                // Wait one more frame to ensure DOM is ready
                                await this.sleep(100)
                                this.$swal.fire({
                                    title: this.$t("editor.backupfound"),
                                    html:  `${this.$t("editor.replacecontent1")} <b>${backupfileName}</b> ${this.$t("editor.replacecontent2")}`,
                                    icon: "question",
                                    showCancelButton: true,
                                    cancelButtonText: this.$t("editor.cancel"),
                                    confirmButtonText: this.$t("editor.replace"),
                                    reverseButtons: true,
                                    allowOutsideClick: false,
                                    allowEscapeKey: true
                                })
                                .then(async (result) => {
                                    if (result.isConfirmed) {
                                        console.log(`activesheets @ loadBackupFile: User confirmed, loading backup file`)
                                        await this.loadBAK(backupfileName, true) // Pass true to skip dialog
                                    } else {
                                        console.log(`activesheets @ loadBackupFile: User cancelled loading backup file`)
                                    }
                                })
                                .catch((error) => {
                                    console.error(`activesheets @ loadBackupFile: Error showing dialog: ${error}`)
                                })
                                return
                            }
                            attempts++
                            await this.sleep(100)
                        }
                        console.error(`activesheets @ loadBackupFile: PDF renderer not ready after ${maxAttempts} attempts`)
                    }
                    waitForPdfRenderer()
                } else {
                    console.log(`activesheets @ loadBackupFile: No backup file found or content is empty`)
                }
            } catch (error) {
                console.error(`activesheets @ loadBackupFile: Error loading backup file: ${error}`)
            }
        },
        async loadBAK(filename, skipDialog=false) {
            try {
                // Show confirmation dialog before loading (unless skipDialog is true)
                if (!skipDialog) {
                    const result = await this.$swal.fire({
                        title: this.$t('editor.backupfound') || 'Backup gefunden',
                        html: `${this.$t('editor.replacecontent1') || 'Do you really want to replace the current input with the saved values from'} <b>${filename}</b> ${this.$t('editor.replacecontent2') || '?'}`,
                        icon: "question",
                        showCancelButton: true,
                        cancelButtonText: this.$t("editor.cancel") || "Abbrechen",
                        confirmButtonText: this.$t("editor.replace") || "Ersetzen",
                        reverseButtons: true
                    });
                    
                    if (!result.isConfirmed) {
                        return; // User cancelled
                    }
                }
                
                // Read the .htm file via IPC
                const bakContent = await signalBridge.invoke('getbackupfile', filename);
                
                if (!bakContent) {
                    console.warn('activesheets @ loadBAK: No content found in .htm file');
                    this.$swal.fire({
                        title: this.$t('editor.error') || 'Fehler',
                        text: this.$t('editor.backupnotfound') || 'Backup-Datei konnte nicht gelesen werden',
                        icon: 'error'
                    });
                    return;
                }
                
                // Parse JSON
                const formData = JSON.parse(bakContent);
                
                // Apply values to input fields based on their IDs
                // Text inputs
                const textInputs = document.querySelectorAll('.interactive-input.text, .interactive-input.cloze, .interactive-input.table-cell');
                textInputs.forEach(input => {
                    if (input.id && formData[input.id] !== undefined) {
                        input.value = formData[input.id];
                    }
                });
                
                // Textareas
                const textareas = document.querySelectorAll('.interactive-input.textarea');
                textareas.forEach(textarea => {
                    if (textarea.id && formData[textarea.id] !== undefined) {
                        textarea.value = formData[textarea.id];
                    }
                });
                
                // Checkboxes
                const checkboxes = document.querySelectorAll('.interactive-input.checkbox');
                checkboxes.forEach(checkbox => {
                    if (checkbox.id && formData[checkbox.id] !== undefined) {
                        checkbox.checked = formData[checkbox.id];
                    }
                });
                
                console.log('activesheets @ loadBAK: Successfully loaded form data from', filename);
                
                this.$swal.fire({
                    title: this.$t('editor.success') || 'Erfolg',
                    text: this.$t('editor.backuploaded') || 'Backup erfolgreich geladen',
                    icon: 'success',
                    timer: 2000,
                    timerProgressBar: true
                });
            } catch (error) {
                console.error('activesheets @ loadBAK: Error loading .htm file:', error);
                this.$swal.fire({
                    title: this.$t('editor.error') || 'Fehler',
                    text: this.$t('editor.backuperror') || 'Fehler beim Laden der Backup-Datei',
                    icon: 'error'
                });
            }
        },
        formatTime(unixTime) {
            const date = new Date(unixTime * 1000); // Convert Unix time to milliseconds
            return date.toLocaleTimeString('en-US', { hour12: false }); // Adjust locale and options as needed
        },
        clock(){
            this.now = new Date().getTime()
            this.timesinceentry =  new Date(this.now - this.entrytime).toISOString().substr(11, 8)
            this.currenttime = moment().tz('Europe/Vienna').format('HH:mm:ss');
        },  
        async fetchInfo() {
            let getinfo = await signalBridge.invoke('getinfoasync')   // we need to fetch the updated version of the systemconfig from express api (server.js)
            
            this.clientinfo = getinfo.clientinfo;
            this.token = this.clientinfo.token
            this.focus = this.clientinfo.focus
            this.clientname = this.clientinfo.name
            this.exammode = this.clientinfo.exammode
            this.pincode = this.clientinfo.pin
            
            this.serverstatus = getinfo.serverstatus

            // decide which locked section index is authoritative (client vs server)
            const sectionIndex = (this.serverstatus.allowSectionSwitch && this.clientinfo.lockedSection != null)
                ? this.clientinfo.lockedSection
                : this.serverstatus.lockedSection

            this.lockedSection = sectionIndex

            if (!this.focus){  this.entrytime = new Date().getTime()}
            if (this.clientinfo && this.clientinfo.token){  this.online = true  }
            else { this.online = false  }

            this.battery = await navigator.getBattery().then(battery => { return battery })
            .catch(error => { console.error("Error accessing the Battery API:", error);  });
            
            this.internetCheckCounter++
            if (this.internetCheckCounter % 5 === 0){
                this.wlanInfo = await signalBridge.invoke('get-wlan-info')
                this.hostip = await signalBridge.invoke('checkhostip')
                this.internetCheckCounter = 0
            }

        }, 
        // --- NEW: Refactored PDF Loader ---
        async loadPdfParserHtml() {
            try {
                this.isLoading = true;
                this.pdfBase64 = null;

                // Get the locked section
                const section = this.serverstatus.examSections[this.lockedSection];
                
                // Determine which group to use
                let targetGroup = 'groupA'; // Default to groupA if groups not enabled
                if (section.groups) {
                    // Groups are enabled, use student's group if available, otherwise default to groupA
                    if (this.clientinfo && this.clientinfo.group) {
                        targetGroup = this.clientinfo.group === 'b' ? 'groupB' : 'groupA';
                    }
                    // If clientinfo not yet available, will default to groupA and reload when clientinfo is available
                }
                
                // Find Active Sheet PDF in the target group
                const activeSheetFile = section[targetGroup]?.examConfig?.activeSheets?.filename ? section[targetGroup].examConfig.activeSheets : null;
                if (activeSheetFile && activeSheetFile.filecontent) {
                    this.pdfBase64 = activeSheetFile.filecontent;
                    this.activeSheetPdfFilename = activeSheetFile.filename;
                    this.customFields = activeSheetFile.customFields ? JSON.parse(JSON.stringify(activeSheetFile.customFields)) : [];
                    this.blacklist = activeSheetFile.blacklist ? [...activeSheetFile.blacklist] : [];
                } else {
                    console.warn('No Active Sheet PDF found for group:', targetGroup);
                    this.pdfBase64 = null;
                    this.activeSheetPdfFilename = null;
                    this.customFields = [];
                    this.blacklist = [];
                }
                
                this.isLoading = false;

            } catch (error) {
                console.error('Error loading PDF:', error);
                this.isLoading = false;
            }
        },
        
        /** Converts the Active Sheet PDF View into a multipage PDF */
        async saveContent(backup, why) {     
            let filename = false  // this is set manually... otherwise use clientname
            if (why === "manual"){
                await this.$swal({
                    title: this.$t("math.filename") ,
                    icon: "question",
                    input: 'text',
                    inputPlaceholder: 'Type here...',
                    showCancelButton: true,
                    inputAttributes: {
                        maxlength: 20,
                    },
                    confirmButtonText: 'Ok',
                    cancelButtonText: this.$t("editor.cancel"),
                    inputValidator: (value) => {
                        const regex = /^[A-Za-z0-9]+$/;
                        if (!value.match(regex)) {
                            return  this.$t("math.nospecial") ;
                        }                   
                    },
                }).then((result) => {
                    if (result.isConfirmed) { filename = `${result.value}`}
                    else {return; }
                });
            }
            if (why === "exitexam") { 
                // stop clipboard clear interval
                signalBridge.send('restrictions')

                this.$swal.fire({
                    title: this.$t("editor.leaving"),
                    text: this.$t("editor.savedclip"),
                    icon: "info",
                    timer: 3000,
                    showCancelButton: false,
                    didOpen: () => { this.$swal.showLoading(); },
                })
            }

            // Collect all input field values from PdfRenderer
            // Use the Active Sheet PDF filename, not the backup filename
            const formData = { filename: this.activeSheetPdfFilename || 'unknown.pdf' };
            
            // Get all input fields (text, textarea, checkbox) from PdfRenderer
            const textInputs = document.querySelectorAll('.interactive-input.text, .interactive-input.cloze, .interactive-input.table-cell');
            const textareas = document.querySelectorAll('.interactive-input.textarea');
            const checkboxes = document.querySelectorAll('.interactive-input.checkbox');
            
            // Collect text input values
            textInputs.forEach(input => {
                if (input.id) {
                    formData[input.id] = input.value || '';
                }
            });
            
            // Collect textarea values
            textareas.forEach(textarea => {
                if (textarea.id) {
                    formData[textarea.id] = textarea.value || '';
                }
            });
            
            // Collect checkbox values
            checkboxes.forEach(checkbox => {
                if (checkbox.id) {
                    formData[checkbox.id] = checkbox.checked || false;
                }
            });
            
            // Save form data to .htm file via IPC
            signalBridge.send('saveActivesheetsBak', {
                filename: filename || this.clientname,
                formData: formData,
                reason: why
            });

            // SAVE AS PDF - inform mainprocess to save webcontent as pdf
            // For activesheets, we need to generate PDF from the filled form
            // We'll use getPDFbase64 to render the current view
            if (this.currentpreviewBase64) {
                // If we have a preview PDF, use it
                signalBridge.send('printpdf', {filename: filename, landscape: false, servername: this.servername, clientname: this.clientname, reason: why, base64pdf: this.currentpreviewBase64 })  
            } else {
                // Otherwise generate from current view
                let response = await signalBridge.invoke('getPDFbase64', {landscape: false, servername: this.servername, clientname: this.clientname, submissionnumber: this.submissionnumber, sectionname: this.serverstatus.examSections[this.lockedSection].sectionname, printBackground: true, reason: why})
                if (response?.status == "success") {
                    signalBridge.send('printpdf', {filename: filename, landscape: false, servername: this.servername, clientname: this.clientname, reason: why, base64pdf: response.base64pdf })  
                }
            }
            this.loadFilelist()
        },

        // send direct print request to teacher and append current document as base64
        printBase64(printrequest=false, saveReason = 'n/a'){
            if (!this.currentpreviewBase64) {
                console.warn('activesheets @ printBase64: No PDF available to send');
                return;
            }
            
            const endpoint = printrequest ? 'printjob' : 'submission'
            const url = `https://${this.serverip}:${this.serverApiPort}/server/control/${endpoint}/${this.servername}`;
            const sr = typeof saveReason === 'string' ? saveReason : 'n/a'
            const payload = {
                document: this.currentpreviewBase64,
                printrequest: printrequest,
                submissionnumber: this.submissionnumber,
                lockedsection: this.lockedSection,
                saveReason: sr
            }

            examApiFetch(url, {
                method: "POST",
                cache: "no-store",
                headers: {'Content-Type': 'application/json', Authorization: `Bearer ${this.token}`},
                body: JSON.stringify(payload),
            })
            .then(response => { return response.json();  })
            .then(data => {
                if (data.message == "success"){
                    if (!printrequest) { this.submissionnumber++ }   // successful submission -> increment number
                    let message = this.$t("editor.saved")
                    if (printrequest){ message = this.$t("editor.requestsent") }
                
                    this.$swal.fire({
                        title: message,
                        icon: "info",
                    })
                }
                else {
                    this.$swal.fire({
                        title: data.message,
                        icon: "error",
                    })
                }
            })
            .catch(error => {  
                console.log("activesheets @ printbase64:",error.message)    
            });
        },

        async sendExamToTeacher(directsend=false, type="send"){
            // Generate PDF from current view (with filled form fields)
            if (!this.serverstatus || !this.serverstatus.examSections || !this.serverstatus.examSections[this.lockedSection]) {
                console.error('activesheets @ sendExamToTeacher: Invalid section data');
                return;
            }
            let response = await signalBridge.invoke('getPDFbase64', {landscape: false, servername: this.servername, clientname: this.clientname, submissionnumber: this.submissionnumber, sectionname: this.serverstatus.examSections[this.lockedSection].sectionname, printBackground: true})

            if (response?.status == "success"){
                let base64pdf = response.base64pdf
                let dataUrl = response.dataUrl
                
                // Store the base64 PDF for later use
                this.currentpreviewBase64 = base64pdf
                
                if (directsend){   //direct send to teacher without displaying the print preview
                    this.printBase64(false, 'directsend')
                    return
                }

                let file = {
                    filename: `${this.clientname}.pdf`,
                    filetype: "pdf",
                    filecontent: dataUrl
                }
                this.loadPDF(file, true, 100, true, type)  //this opens the pdf file in the print preview and populates base64 preview
                this.currentpreviewBase64 = base64pdf  // Store base64 for submission
            }
        },

        // display print denied message and reason
        printdenied(why){
            console.log("activesheets @ printdenied: Print request denied")
            let message = this.$t("editor.requestdenied")
            if (why == "duplicate"){ message = this.$t("editor.requestdeniedduplicate") }
           
            this.$swal.fire({
                title: message,
                icon: "info",
                timer: 2000,
                timerProgressBar: true,
                didOpen: () => { this.$swal.showLoading() }
            })
        },
        // implementing a sleep (wait) function
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
    },
    computed: {
    },
    watch: {
        clientinfo: {
            handler(newClientinfo) {
                // Reload PDF when clientinfo is updated and group is available
                if (newClientinfo && this.serverstatus && this.serverstatus.examSections && this.serverstatus.examSections[this.lockedSection]) {
                    const section = this.serverstatus.examSections[this.lockedSection];
                    if (newClientinfo.group || !section.groups) {
                        this.loadPdfParserHtml();
                    }
                }
            },
            immediate: false
        },
        examMaterials: {
            handler(newMaterials) {
                // Reload PDF when examMaterials are loaded (they might contain the Active Sheet PDF)
                if (newMaterials && newMaterials.length > 0) {
                    this.loadPdfParserHtml();
                }
            },
            immediate: false
        }
    },
    mounted() {
        console.log("activesheets @ mounted")
        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()  
    
        this.$nextTick(async () => { 
            await this.fetchInfo()  // Initial fetch for clientinfo, serverstatus and lockedSection

            const content = document.getElementById(`content`)
            if (content) content.style.zoom = this.zoom

            this.fetchinfointerval = new SchedulerService(5000);
            this.fetchinfointerval.addEventListener('action',  this.fetchInfo);
            this.fetchinfointerval.start();
            
            this.loadfilelistinterval = new SchedulerService(20000);
            this.loadfilelistinterval.addEventListener('action',  this.loadFilelist);
            this.loadfilelistinterval.start();
            
            this.clockinterval = new SchedulerService(1000);
            this.clockinterval.addEventListener('action', this.clock);  // event listener that reacts to the 'action' event (only reacts to 'action' from this instance and does not interfere)
            this.clockinterval.start();
                


            this.saveContentCallback = () => this.saveContent(true, 'auto');  // wegs 2 parameter muss dieser umweg genommen werden sonst kann ich den eventlistener nicht mehr entfernen
            this.saveinterval = new SchedulerService(20000);
            this.saveinterval.addEventListener('action', this.saveContentCallback );  // event listener that reacts to the 'action' event (only reacts to 'action' from this instance and does not interfere)
            this.saveinterval.start();


            attachExamMouseleaveGuard(signalBridge, this.config, this.sendFocuslost);

            signalBridge.on('getmaterials', (event) => {   this.getExamMaterials()  });
            
            signalBridge.on('finalsubmit', (event) => {  // triggered on exit exam mode - send exam to teacher
                console.log("activesheets @ finalsubmit: submit exam request received")
                this.sendExamToTeacher(true) 
            }); 

            signalBridge.on('submitexam', (event, why) => {  //send current work as base64 to teacher
                console.log("activesheets @ submitexam: submit exam request received")
                this.printBase64(false, typeof why === 'string' ? why : 'submitexam')
            });
            
            signalBridge.on('save', (event, why) => {  //trigger document save by signal "save" sent from sendExamtoteacher in communication handler
                console.log("activesheets @ save: Teacher saverequest received")
                this.saveContent(true, why) 
            }); 
            
            signalBridge.on('denied', (event, why) => {  //print request was denied by teacher because he can not handle so much requests at once
                this.printdenied(why)
            });

            signalBridge.on('backup', (event, filename) => {
                console.log("activesheets @ backup: Replace event received ")
                this.loadBAK(filename)
            });

            // add some eventlisteners once
            this._onPreviewClick = function() {  
                this.style.display = 'none';
                this.setAttribute("src", "about:blank");
                URL.revokeObjectURL(this.currentpreview);
            };
            document.querySelector("#preview").addEventListener("click", this._onPreviewClick);


            this.wlanInfo = await signalBridge.invoke('get-wlan-info')
            this.hostip = await signalBridge.invoke('checkhostip')

           
            this.hidepreview()
            this.loadFilelist()
            await this.getExamMaterials()

            this.loadPdfParserHtml()

            console.log(`activesheets @ mounted: Calling loadBackupFile`)
            this.loadBackupFile()

        });
    },
        beforeUnmount() {
        // Clean up interval services
        if (this.fetchinfointerval) {
            this.fetchinfointerval.removeEventListener('action', this.fetchInfo);
            this.fetchinfointerval.stop();
        }

        if (this.clockinterval) {
            this.clockinterval.removeEventListener('action', this.clock);
            this.clockinterval.stop();
        }

        if (this.loadfilelistinterval) {
            this.loadfilelistinterval.removeEventListener('action', this.loadFilelist);
            this.loadfilelistinterval.stop();
        }

        // Clean up DOM event listeners
        document.body.removeEventListener('mouseleave', this.sendFocuslost);
        
        // Clean up preview click listener
        const preview = document.querySelector("#preview");
        if (preview && this._onPreviewClick) {
            preview.removeEventListener("click", this._onPreviewClick);
        }

        // Clean up IPC listeners
        signalBridge.removeAllListeners('getmaterials');
        signalBridge.removeAllListeners('finalsubmit');
        signalBridge.removeAllListeners('submitexam');
        signalBridge.removeAllListeners('save');
        signalBridge.removeAllListeners('denied');
        this.stopSplitResize()
    },
    
}
</script>
<style >
@media print {
    #vuexambody {
            position:absolute !important;   /* position:absolute is required for printing of pdfs with multiple pages*/
    }
}

</style>


<style scoped lang="scss">

#toolbar {
    z-index: 10001;
    background-color: rgba(var(--bs-dark-rgb))
}

.activesheets-root {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
}

.activesheets-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}

#content {
    overflow: auto;
    height: 100%;
    min-height: 0;
    scrollbar-gutter: stable;
    width: 100%;
    overscroll-behavior: contain;
    background-color: #eee;
}

:deep(.pdf-scroll-container) {
    overflow: visible;
    height: auto;
    max-height: none;
    min-height: fit-content;
}

.split-view-container {
    display: flex;
    flex-direction: row;
    height: 100%;
    overflow: hidden;
}

.split-pane {
    flex: 0 0 auto;
    min-width: 0;
    overflow: hidden;
}

.split-pane--right {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    overscroll-behavior: contain;
}

.split-pane--left {
    background-color: transparent;
}

#statusbar {
    position: relative;
    bottom: 0px;
    width: 100%;
    height: 28px;
    background-color: #eeeefa;
    padding: 2px;
    padding-left: 6px;
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.2);
    font-size: 0.9em;
}

.zoombutton {
    height: 24px;
    float: right;
    cursor: pointer;
}

.zoombutton:hover {
    filter: invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg) brightness(82%) contrast(119%);
}

/* must integrate images this way otherwise they won't be integrated in the final build */
.splitback {
    position: relative;
}
.splitback.splitback--empty::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: url('/src/assets/img/svg/document-replace.svg');
    background-repeat: no-repeat;
    background-position: center;
    background-size: 180px;
    opacity: 0.85;
}
.splitback > * {
    position: relative;
    z-index: 1;
}

.split-divider {
    flex: 0 0 10px;
    cursor: col-resize;
    position: relative;
    background: transparent;
    touch-action: none;
}

.split-divider::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 2px;
    background: rgba(255, 255, 255, 0.25);
}

.split-divider:hover::before {
    background: rgba(13, 110, 253, 0.55);
}

#preview {
    display: none;
    position: absolute;
    top: var(--nx-preview-top-offset, var(--nx-apphead-h, 60px));
    left: 0;
    width:100vw;
    height: calc(100vh - var(--nx-preview-top-offset, var(--nx-apphead-h, 60px)));
    background-color: rgba(0, 0, 0, 0.4);
    z-index:100001;
    backdrop-filter: blur(2px);
  
}

.split-view-container #preview {
    display: block;
    position: relative;
    width: auto;
    height: auto;
    background-color: transparent;
    backdrop-filter: none;
    z-index: auto;
}

 //this controls how the activesheets view is printed (to pdf)

@media print { 


    #webview, #apphead, #focuswarning, .focus-container, #preview, #pdfembed, #toolbar  {
        display: none !important;
    }
    html, body {
        position: relative !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
    }
   
    // Use :deep() to target child component styles - remove all height restrictions for printing
    :deep(.pdf-overlay-root) {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
    }
    
    :deep(.pdf-scroll-container) {
        background-color: white !important;
        box-shadow: none !important;
        padding: 0px !important;
        margin: 0px !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
    }
    
    :deep(.pdf-page-wrapper) {
        page-break-after: always !important;
        page-break-inside: avoid !important;
        break-after: page !important;
        break-inside: avoid !important;
        margin-bottom: 0px !important;
        box-shadow: none !important;
    }



    #app {
        display:block !important;
       
        max-height: none !important;
        overflow: visible !important;
        position:absolute !important;
    }
    
    #content {
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
        position:absolute !important;
    }

    ::-webkit-scrollbar {
                display: none;
            }

    // p { page-break-after: always; }
    .footer { 
        position: fixed; 
        bottom: 0px; 
    }

    .zoombutton, #preview {
    display:none !important;
    }

    .swal2-container, .swal2-center, .swal2-backdrop-show , .swal2-popup, .swal2-modal, .swal2-icon-info, .swal2-show {
        display:none !important;
    }

  
    
    // Ensure content is visible
    #content {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        overflow: visible !important;
        height: auto !important;
    }

}




</style>