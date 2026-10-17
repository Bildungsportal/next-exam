<template>
    <div id="mainmenubar">

        <!-- HEADER START -->
        <exam-header
            @reconnect="reconnect"
            @gracefullyExit="gracefullyExit"
        ></exam-header>
        <!-- HEADER END -->

        <!-- filelist start - show local files from workfolder (pdf and gbb only)-->
        <div id="toolbar" class="p-0 pb-1 ps-2">

            <button class="btn btn-primary p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="reloadBrowserView"
                    :title="$t('website.reloadwebview')"><img src="/img/svg/edit-redo.svg" class=""
                                                              width="22" height="20">Reload MS365
            </button>


            <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 ms-2 mb-0 btn-sm"
                 @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img
                src="/img/svg/gtk-convert.svg" class="white" width="22" height="22"
                style="vertical-align: top;"> {{ $t('editor.materials') }}
            </div>

            <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
            <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
                <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.filename; loadBase64file(file)"><img
                    src="/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                    style="vertical-align: top;"> {{ file.filename }}
                </div>
                <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.filename; loadBase64file(file)"><img
                    src="/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                    style="vertical-align: top;"> {{ file.filename }}
                </div>
            </div>
            <div v-if="allowedUrls.length !== 0" v-for="allowedUrl in allowedUrls  "
                 class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button" :title="getUrlDisplay(allowedUrl)"
                 @click="showUrl(allowedUrl)">
                <img src="/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                     style="vertical-align: top;"> {{ getUrlDisplay(allowedUrl) }}
            </div>
            <!-- exam materials end -->


            <div class="text-muted white me-2 ms-2 small d-inline-block" style="vertical-align: middle;">
                {{ $t('editor.localfiles') }}
            </div>
            <div v-for="file in localfiles" :key="file.name" class="d-inline" style="text-align:left">
                <div v-if="(file.type == 'pdf')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.name; loadPDF(file.name)"><img src="/img/svg/eye-fill.svg"
                                                                              class="white" width="22" height="22"
                                                                              style="vertical-align: top;">
                    {{ file.name }}
                </div>
                <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.name; loadImage(file.name)"><img src="/img/svg/eye-fill.svg"
                                                                                class="white" width="22" height="22"
                                                                                style="vertical-align: top;">
                    {{ file.name }}
                </div>
            </div>
        </div>
        <!-- filelist end -->
    </div>


    <div id="content" :class="{ 'nx-ms365-flex': isIOSPlatform }">
        <!-- native ms365 webview placeholder (iOS) start -->
        <div v-if="isIOSPlatform" id="webviewmain"></div>
        <div v-if="isIOSPlatform && isLoading" class="overlay">
            <div class="spinner"></div>
            <p>{{ $t('student.enteringExamMode') }}</p>
        </div>
        <!-- native ms365 webview placeholder (iOS) end -->

        <!-- angabe/pdf preview start -->
        <div id=preview class="fadeinfast p-4">
            <WebviewPane
                id="webview"
                :src="urlForWebview || ''"
                :visible="webviewVisible"
                :allowed-url="urlForWebview"
                :block-external="true"
                @close="hidepreview"
            />
            <PdfviewPaneRendered
                :localLockdown="localLockdown"
                :examtype="examtype"
                :toolbar="pdfPreviewUi"
                :preview="pdfPreviewState"
                @close="hidepreview"
            />
        </div>
        <!-- angabe/pdf preview end -->

        <!-- focus warning start -->
        <div v-if="!focus" class="focus-container">
            <div id="focuswarning" class="infodiv p-4 d-block focuswarning">
                <div class="mb-3 row">
                    <div class="mb-3 "> {{ $t('editor.leftkiosk') }} <br> {{ $t('editor.tellsomeone') }}</div>
                    <div v-if="focusLockReason" class="mb-3 text-dark fw-bold">{{ $t('editor.focusLockReason') }}: {{ $te('editor.focusLockReason_' + focusLockReason) ? $t('editor.focusLockReason_' + focusLockReason) : focusLockReason }}</div>
                    <img src="/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32">
                    <div class="mt-3"> {{ formatTime(entrytime) }}</div>
                </div>
            </div>
        </div>
        <!-- focuswarning end  -->
    </div>

    <!--
    Microsoft 365 embeds it's editors into an iframe and activates strict content security. therfore it is not possible to inject
    Javascript into the frame inside a frame like <iframe></iframe> <embed> or chromium <webview></webview>
    The only way to inject JS code is via the backend but only if we open the Microsoft365 page directly in the electron window (no sub-frames whatsoever)
    That's why we use electrons "BrowserView" feature to load 2 pages in 1 window. we present this page as "topmenu" and load the ms editors as "content" below.
    This is actually the safest way to do this because of "ContextIsolation" no scripts from the loaded pages can interfere with the rest of the app.
    Unfortunately this means that we need to collapse the browserview when we want to open a file or a url from the next-exam header.
    -->


</template>

<script>
import ExamHeader from '../components/ExamHeader.vue';
import {getBatteryStatus, gracefullyExit, reconnect, showUrl} from '../utils/commonMethods.js'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'
import WebviewPane from '../components/WebviewPane.vue'
import {getExamMaterials, loadImage, loadPDF, resetPdfPreviewToolbar} from '../utils/filehandler.js'
import {isElectronWindow, isIOS} from "../types/platform.ts";
import { attachExamMouseleaveGuardBoolean, detachExamMouseleaveGuard, shouldSkipEdgeFocusLost } from '../utils/linuxCageKiosk.js'
import {
    applyClientinfoFromFetch,
    applyServerstatusFromFetch,
    resolveLockedSection,
    formatFocusLostTime,
    applyFocusLostFromIpc,
} from '../utils/examFetchInfoSync.js'
import {useConfigStore} from "../stores/configStore.ts";
import {useInfoStore} from "../stores/infoStore.ts";
import {storeToRefs} from "pinia";
import {autoCleanupMixin} from "../mixins/autoCleanupMixin.ts";
import loggingBridge from '../utils/loggingBridge.js';

export default {
    mixins: [autoCleanupMixin],

    setup() {
        let {development, serverApiPort, electron, hostip} = storeToRefs(useConfigStore());

        const infoStore = useInfoStore();
        infoStore.online = true;
        infoStore.componentName = "Microsoft365";
        infoStore.examType = "microsoft365";
        let {examtype, servername, servertoken, serverip, token, clientname, serverstatus, clientApiPort, pincode, localLockdown, online, battery, wlanInfo, entrytime} = storeToRefs(infoStore);

        return { development, serverApiPort, electron, hostip, isIOSPlatform: isIOS(),
            examtype, servername, servertoken, serverip, token, clientname, serverstatus, clientApiPort,
            pincode, localLockdown, online, battery, wlanInfo, entrytime };
    },

    data() {
        return {
            focus: true,
            focusLockReason: '',
            exammode: false,
            currentFile: null,
            lockedSection: null,
            clientinfo: null,
            localfiles: null,
            currentpreview: null,
            examMaterials: [],
            urlForWebview: null,
            allowedUrls: [],
            webviewVisible: false,
            internetCheckCounter: 0,
            msOfficeShare: null,
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
            _onMs365Loaded: null,
            _onMs365LoadFailed: null,
            _onPreviewClick: null,
            isLoading: true,
            missingShareWarningShown: false,
            mountTime: 0,
        }
    },
    components: {
        ExamHeader, PdfviewPaneRendered, WebviewPane
    },
    watch: {
        // focuswarning overlay: collapse Office BrowserView on any focus loss (poll or focuslost IPC), restore when focus returns
        focus(now) {
            if (!isElectronWindow(window)) return;
            window.ipcRenderer.send(now ? 'restore-browserview' : 'collapse-browserview');
        },
    },
    mounted() {
        if (isIOS()) {
            this._onMs365Loaded = () => {
                this.isLoading = false;
                loggingBridge.info('microsoft365 @ ms365-loaded: native webview finished loading');
            };
            this._onMs365LoadFailed = (error) => {
                this.isLoading = false;
                loggingBridge.error('microsoft365 @ ms365-load-failed:', error?.message ?? error);
                console.error('microsoft365 @ iOS MS365 load failed:', error);
                if (!this.msOfficeShare) {
                    this.$swal.fire({
                        title: "Error",
                        text: this.$t("student.microsoft365LoadFailed"),
                        icon: 'error',
                        showCancelButton: false,
                    });
                }
            };
            window.ipcRenderer.on('ms365-loaded', this._onMs365Loaded);
            window.ipcRenderer.on('ms365-load-failed', this._onMs365LoadFailed);
        }
        if (isIOS() && typeof ResizeObserver !== 'undefined') {
            // keep the native ms365 webview frame in sync when the header/toolbar wraps (sections second row, materials, rotation)
            this._ms365HeaderResizeObserver = new ResizeObserver(() => this.updateHeaderHeight());
            const menuBar = document.getElementById('mainmenubar');
            if (menuBar) this._ms365HeaderResizeObserver.observe(menuBar);
        }
        this.mountTime = Date.now()
        this.fetchInfo()
        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()

        this.$nextTick(async () => { // Code that will run only after the entire view has been rendered
            this.autoSchedulerService(this.fetchInfo, 5000);
            this.autoSchedulerService(this.loadFilelist, 10000);

            attachExamMouseleaveGuardBoolean(this.development, this.sendFocuslost);

            window.ipcRenderer.on('getmaterials', () => {
                this.getExamMaterials()
            });

            this.loadFilelist()
            this.getExamMaterials()

            if (isElectronWindow(window)) {
                this._onPreviewClick = function () {
                    this.style.display = 'none';
                    this.setAttribute("src", "about:blank");
                    URL.revokeObjectURL(this.currentpreview);
                    window.ipcRenderer.send('restore-browserview');
                };
                this.autoEventListener(document.querySelector("#preview"), "click", this._onPreviewClick);

                this.autoEventListener(window, 'resize', this.updateHeaderHeight);

                await this.sleep(1000)
                // Update header height after initial render
                this.updateHeaderHeight();

                this.wlanInfo = await window.ipcRenderer.invoke('get-wlan-info')
                this.hostip = await window.ipcRenderer.invoke('checkhostip')

            }
        });
    },
    methods: {
        // from filehandler.js
        getExamMaterials: function () {
            getExamMaterials.call(this);
            // Update header height after materials are loaded (may change toolbar height)
            this.updateHeaderHeight();
        },
        loadPDF: loadPDF,
        loadImage: loadImage,

        // from commonMethods.js
        gracefullyExit: gracefullyExit,
        showUrl: showUrl,
        reconnect: reconnect,
        getUrlDisplay(allowedUrl) {
            return typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
        },


        // Update header height and send to backend
        updateHeaderHeight() {
            this.$nextTick(() => {
                const mainMenuBar = document.querySelector('#mainmenubar');
                if (mainMenuBar) {
                    const height = mainMenuBar.offsetHeight;
                    if (isElectronWindow(window)) {
                        window.ipcRenderer.send('update-menu-height', height);
                    } else if (isIOS() && this.msOfficeShare) {
                        const placeholder = document.getElementById('webviewmain');
                        if (placeholder) {
                            const rect = placeholder.getBoundingClientRect();
                            window.ipcRenderer.invoke('resize-ms365', {
                                frame: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                            });
                        }
                    }
                }
            });
        },

        // Opens the native iOS Microsoft 365 view inside the Vue placeholder.
        async openNativeMs365() {
            if (!isIOS() || !this.msOfficeShare) return;
            loggingBridge.info(`microsoft365 @ openNativeMs365: sending share link to native view (${this.msOfficeShare})`);
            await this.$nextTick();
            const placeholder = document.getElementById('webviewmain');
            if (!placeholder) return;
            const rect = placeholder.getBoundingClientRect();
            this.isLoading = true;
            await window.ipcRenderer.invoke('open-ms365', {
                url: this.msOfficeShare,
                frame: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            });
        },

        // reload the browser view - this needs to load the ms365 domain again in electron browserview
        reloadBrowserView() {
            if (isIOS()) {
                window.ipcRenderer.invoke('reload-ms365');
                return;
            }
            window.ipcRenderer.invoke('reload-browser-view', this.msOfficeShare);
        },

        loadBase64file(file) {
            if (file.filetype == 'pdf') {
                this.loadPDF(file, true)
                return
            } else if (file.filetype == 'image') {
                this.loadImage(file, true)
                return
            }
        },

        hidepreview() {
            resetPdfPreviewToolbar(this);
            this.pdfPreviewState = null;
            let preview = document.querySelector("#preview")
            preview.style.display = 'none';
            URL.revokeObjectURL(this.currentpreview);
            if (isElectronWindow(window) || isIOS()) {
                window.ipcRenderer.send('restore-browserview');   // ms365 only !!!!!!!!!!
            }
        },

        async sendFocuslost() {
            if (await shouldSkipEdgeFocusLost(this.development)) return;
            if (isElectronWindow(window)) {
                let response = await window.ipcRenderer.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
                applyFocusLostFromIpc(this, response, this.development);
            }
        },
        formatTime: formatFocusLostTime,

        //checks if arraybuffer contains a valid pdf file
        isValidPdf(data) {
            const header = new Uint8Array(data, 0, 5); // read the first 5 bytes for "%PDF-"
            // Convert bytes to hex values for comparison
            const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D]; // "%PDF-" in Hex
            for (let i = 0; i < pdfHeader.length; i++) {
                if (header[i] !== pdfHeader[i]) {
                    return false; // early exit if a byte does not match
                }
            }
            return true; // all bytes match the PDF header
        },

        // implementing a sleep (wait) function
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        async loadFilelist() {
            if (isElectronWindow(window)) {
                let filelist = await window.ipcRenderer.invoke('getfilesasync', null)
                this.localfiles = filelist;
            }
        },
        async fetchInfo() {
            const getinfo = await window.ipcRenderer.invoke('getinfoasync');

            applyClientinfoFromFetch(this, getinfo.clientinfo);
            if (getinfo.serverstatus) {
                applyServerstatusFromFetch(this, getinfo.serverstatus);
            }

            const sectionIndex = resolveLockedSection(this.serverstatus, this.clientinfo);
            if (sectionIndex !== this.lockedSection) this.lockedSection = sectionIndex;

            const nextShare = this.clientinfo?.msofficeshare ?? null;
            if (nextShare !== this.msOfficeShare) {
                this.msOfficeShare = nextShare;
                loggingBridge.info(`microsoft365 @ fetchInfo: msofficeshare ${nextShare ? `received (${nextShare})` : 'absent'}`);
                if (isIOS() && nextShare) {
                    if (this.missingShareWarningShown) this.$swal.close();
                    this.openNativeMs365();
                }
            }

            // iOS: a late-connecting student depends on the teacher pushing the OneDrive share link
            // (dashboard.vue assigns it on its next poll). If it never arrives, don't leave the
            // "Loading secured exam mode …" spinner up forever — inform the student once instead.
            if (isIOS() && this.isLoading && !this.msOfficeShare && !this.missingShareWarningShown
                && Date.now() - this.mountTime > 60000) {
                this.missingShareWarningShown = true;
                this.$swal.fire({
                    title: "Error",
                    text: this.$t("student.microsoft365MissingShare"),
                    icon: 'error',
                    showCancelButton: false,
                });
            }

            this.battery = await getBatteryStatus(this.battery);

            this.internetCheckCounter++;
            if (this.internetCheckCounter % 5 === 0) {
                this.wlanInfo = await window.ipcRenderer.invoke('get-wlan-info');
                this.hostip = await window.ipcRenderer.invoke('checkhostip');
                this.internetCheckCounter = 0;
            }
        },

    },
    beforeUnmount() {
        detachExamMouseleaveGuard(this.sendFocuslost);

        window.ipcRenderer.removeAllListeners('getmaterials')
        if (isIOS()) {
            window.ipcRenderer.removeAllListeners('ms365-loaded');
            window.ipcRenderer.removeAllListeners('ms365-load-failed');
            window.ipcRenderer.invoke('close-ms365');
            if (this._ms365HeaderResizeObserver) {
                this._ms365HeaderResizeObserver.disconnect();
                this._ms365HeaderResizeObserver = null;
            }
        }
    },
}
</script>


<style scoped>
@media print {
    #apphead, #mainmenubar {
        display: none !important;
    }

    #content {
        height: 100vh !important;
        width: 100vw !important;
        border-radius: 0px !important;
    }

    #geogebraframe {
        height: 100% !important;
        width: 100% !important;
    }

    #app {
        display: block !important;
        height: 100% !important;

    }

    ::-webkit-scrollbar {
        display: none;
    }
}

#mainmenubar {
    min-height: 94px;
}

/* not a flex item here → z-index needs position; keeps exit/reconnect above focuswarning blur */
#mainmenubar :deep(#apphead) {
    position: relative;
}

#content.nx-ms365-flex {
    display: flex;
    flex-flow: column;
}

#webviewmain {
    flex: 1 1 0 !important;   /* fill remaining height in #q-app flex column */
    min-height: 0;
    width: 100% !important;
    display: flex;
    position: relative;
    top: 0;
    left: 0;
}

.overlay {
    position: fixed;
    top: 45px;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #eef2f8;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.spinner {
    border: 16px solid #fff;
    border-top: 16px solid #3498db;
    border-radius: 50%;
    width: 120px;
    height: 120px;
    animation: spin 2s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}


#apphead, #toolbar {
    min-width: 840px;
}


#localfiles {
    position: relative;
}

#preview {
    display: none;
    position: absolute;
    top: var(--nx-preview-top-offset, var(--nx-apphead-h, 60px));
    left: 0;
    width: 100vw;
    height: calc(100vh - var(--nx-preview-top-offset, var(--nx-apphead-h, 60px)));
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 100000;
}

#pdfembed {
    position: absolute;
    top: 50%;
    left: 50%;
    margin-left: -30vw;
    margin-top: -45vh;
    width: 60vw;
    height: 90vh;
    padding: 10px;
    background-color: rgba(255, 255, 255, 1);
    border: 0px solid rgba(255, 255, 255, 0.589);
    box-shadow: 0 0 15px rgba(22, 9, 9, 0.589);
    padding: 10px;
    border-radius: 6px;
}

</style>
