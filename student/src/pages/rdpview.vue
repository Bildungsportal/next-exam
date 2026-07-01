<template>
    <div class="column nx-rdp-root" style="height: 100%; position: relative;">
        <!-- HEADER START -->
        <exam-header
            @reconnect="reconnect"
            @gracefullyExit="gracefullyExit"
        ></exam-header>
        <!-- HEADER END -->


        <!-- filelist start - show local files from workfolder (pdf and gbb only)-->
        <div id="toolbar" class="d-inline p-1 pt-0">
            <button class="btn btn-primary p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="reloadWebview"
                    :title="$t('website.reloadwebview')"><img src="/src/assets/img/svg/edit-redo.svg" class="" width="22"
                                                              height="20">Reload RD Webclient
            </button>

            <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                 @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img
                src="/src/assets/img/svg/games-solve.svg" class="white" width="22" height="22" style="vertical-align: top;">
                {{ $t('editor.materials') }}
            </div>

            <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
            <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
                <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg"
                                                                                    class="grey" width="22" height="22"
                                                                                    style="vertical-align: top;">
                    {{ file.filename }}
                </div>
                <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg"
                                                                                    class="grey" width="22" height="22"
                                                                                    style="vertical-align: top;">
                    {{ file.filename }}
                </div>
            </div>

            <div v-if="allowedUrls.length !== 0" v-for="allowedUrl in allowedUrls  "
                 class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button" :title="getUrlDisplay(allowedUrl)"
                 @click="showUrl(getUrlDisplay(allowedUrl))">
                <img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                     style="vertical-align: top;"> {{ getUrlDisplay(allowedUrl) }}
            </div>


            <!-- exam materials end -->


            <div class="text-muted white me-2 ms-2 small d-inline-block" style="vertical-align: middle;">
                {{ $t('editor.localfiles') }}
            </div>
            <div v-for="file in localfiles" :key="file.name" class="d-inline" style="text-align:left">
                <div v-if="(file.type == 'pdf')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/eye-fill.svg"
                                                                              class="white" width="22" height="22"
                                                                              style="vertical-align: top;"> {{ file.name }}
                </div>
                <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.name; loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg"
                                                                                class="white" width="22" height="22"
                                                                                style="vertical-align: top;">
                    {{ file.name }}
                </div>
            </div>

        </div>
        <!-- filelist end -->


        <!-- angabe/pdf preview start -->
        <div
            id="preview"
            class="fadeinfast p-4"
            style="--nx-preview-chrome-top: 80px; --nx-preview-top-offset: 0px;"
        >
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


        <div id="content">
            <!-- focus warning start -->
            <div v-if="!focus" class="focus-container">
                <div id="focuswarning" class="infodiv p-4 d-block focuswarning">
                    <div class="mb-3 row">
                        <div class="mb-3 "> {{ $t('editor.leftkiosk') }} <br> {{ $t('editor.tellsomeone') }}</div>
                        <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32">
                        <div class="mt-3"> {{ formatTime(entrytime) }}</div>
                    </div>
                </div>
            </div>
            <!-- focuswarning end  -->


            <!-- RDP Viewer start -->
            <div style="height:100%" width="100%" ref="container">
                <webview ref="wvmain" :src="rdpUrl" style="height:100%; width:100%;"></webview>
            </div>
            <!-- RDP Viewer end -->

        </div>
    </div>
</template>

<script>
import ExamHeader from '../components/ExamHeader.vue';
import {getExamMaterials, loadImage, loadPDF, resetPdfPreviewToolbar} from '../utils/filehandler.js'
import {gracefullyExit, reconnect, showUrl} from '../utils/commonMethods.js'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'
import WebviewPane from '../components/WebviewPane.vue'
import {isElectronWindow} from "../types/platform.ts";
import {SignalBridge} from '../utils/signalBridge.js'
import { attachExamMouseleaveGuardBoolean, shouldSkipEdgeFocusLost } from '../utils/linuxCageKiosk.js'
import {
    applyClientinfoFromFetch,
    applyServerstatusFromFetch,
    resolveLockedSection,
    formatFocusLostTime,
    applyFocusLostFromIpc,
} from '../utils/examFetchInfoSync.js'
import {ref} from "vue";
import {useConfigStore} from "../stores/configStore.ts";
import {useInfoStore} from "../stores/infoStore.ts";
import {autoCleanupMixin} from "../mixins/autoCleanupMixin.ts";

const signalBridge = new SignalBridge(window);

export default {
    mixins: [autoCleanupMixin],

    setup() {
        const configStore = useConfigStore();
        let development = ref(configStore.development);
        let serverApiPort = ref(configStore.serverApiPort);
        let electron = ref(configStore.electron);
        let hostip = ref(configStore.hostip);

        const infoStore = useInfoStore();
        infoStore.online = true;
        infoStore.componentName = "RDP View";

        let examtype = ref(infoStore.examtype);
        let servername = ref(infoStore.servername);
        let servertoken = ref(infoStore.servertoken);
        let serverip = ref(infoStore.serverip);
        let token = ref(infoStore.token);
        let clientname = ref(infoStore.clientname);
        let serverstatus = ref(infoStore.serverstatus);
        let clientApiPort = ref(infoStore.clientApiPort);
        let pincode = ref(infoStore.pincode);
        let localLockdown = ref(infoStore.localLockdown);
        let online = ref(infoStore.online);
        let battery = ref(infoStore.battery);
        let wlanInfo = ref(infoStore.wlanInfo);
        let entrytime = ref(infoStore.entryTime);

        return { development, serverApiPort, electron, hostip,
            examtype, servername, servertoken, serverip, token, clientname, serverstatus, clientApiPort,
            pincode, localLockdown, online, battery, wlanInfo, entrytime };
    },

    data() {
        return {
            focus: true,
            exammode: false,
            currentFile: null,
            lockedSection: null,
            clientinfo: null,
            localfiles: null,
            url: null,
            currentpreview: null,
            examMaterials: [],
            error: null,
            // rdpConfig and rdpUrl will be resolved on first fetchInfo based on allowSectionSwitch
            rdpConfig: null,
            rdpUrl: null,
            activeSession: false,
            allowedUrls: [],
            urlForWebview: null,
            webviewVisible: false,
            internetCheckCounter: 0,
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
            _onPreviewClick: null,
        }
    },
    components: {ExamHeader, PdfviewPaneRendered, WebviewPane},
    async mounted() {
        console.log("RdpViewer.vue @ mounted: rdpConfig", this.rdpConfig)

        this.getExamMaterials()

        this.entrytime = new Date().getTime()

        this.autoSchedulerService(this.fetchInfo, 5000);
        await this.fetchInfo(); // initial sync for clientinfo, serverstatus, lockedSection and rdpConfig

        this.autoSchedulerService(this.loadFilelist, 20000);

        attachExamMouseleaveGuardBoolean(signalBridge, this.development, this.sendFocuslost);

        this.loadFilelist()

        // add some eventlisteners once
        this._onPreviewClick = function () {
            this.style.display = 'none';
            this.setAttribute("src", "about:blank");
            URL.revokeObjectURL(this.currentpreview);
        };
        this.autoEventListener(document.querySelector("#preview"), "click", this._onPreviewClick);

        const webview = this.$refs.wvmain;
        if (webview) {
            this.autoEventListener(webview, 'did-fail-load', this._onDidFailLoad);
        }
        if (isElectronWindow(window)) {
            this.wlanInfo = await signalBridge.invoke('get-wlan-info')
            this.hostip = await signalBridge.invoke('checkhostip')
        }
    },
    methods: {

        // from filehandler.js
        getExamMaterials: getExamMaterials,
        loadPDF: loadPDF,
        loadImage: loadImage,

        // from commonMethods.js
        gracefullyExit: gracefullyExit,
        showUrl: showUrl,
        reconnect: reconnect,
        getUrlDisplay(allowedUrl) {
            return typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
        },


        reloadWebview() {
            const webview = this.$refs.wvmain;
            webview.setAttribute("src", this.rdpUrl);
        },

        _onDidFailLoad(event) {
            const errorCode = event.errorCode;
            const errorDescription = event.errorDescription;
            const validatedURL = event.validatedURL;

            // Show error popup with SweetAlert2
            this.$swal.fire({
                icon: 'error',
                title: 'Failed to load',
                html: `
                    <div style="text-align: left;">
                        <p><strong>URL:</strong></p>
                        <p style="word-break: break-all; color: #666;">${validatedURL}</p>
                        <br>
                        <p><strong>Error Code:</strong> ${errorCode}</p>
                        <p><strong>Error Description:</strong> ${errorDescription}</p>
                    </div>
                `,
                confirmButtonText: 'OK'
            });
        },


        loadBase64file(file) {
            if (file.filetype == 'pdf') {
                this.loadPDF(file, true)
                return
            } else if (file.filetype == 'image') {
                this.loadImage(file, true)
                return
            } else if (file.filetype == 'ggb') {
                this.loadGGB(file, true)
                return
            }
        },


        hidepreview() {
            resetPdfPreviewToolbar(this);
            this.pdfPreviewState = null;
            let preview = document.querySelector("#preview")
            preview.style.display = 'none';
            URL.revokeObjectURL(this.currentpreview);
        },


        // implementing a sleep (wait) function
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        async sendFocuslost() {
            if (await shouldSkipEdgeFocusLost(signalBridge, this.development)) return;
            if (isElectronWindow(window)) {
                let response = await signalBridge.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
                applyFocusLostFromIpc(this, response, this.development);
            }
        },

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
        async loadFilelist() {
            if (isElectronWindow(window)) {
                let filelist = await signalBridge.invoke('getfilesasync', null)
                this.localfiles = filelist;
            }
        },
        formatTime: formatFocusLostTime,
        // Apply RDP examConfig for locked section; returns true if webview URL changed.
        applyRdpConfigFromSection(sectionIndex) {
            const section = this.serverstatus?.examSections?.[sectionIndex];
            const groupKey = section?.groups && this.clientinfo?.group === 'b' ? 'groupB' : 'groupA';
            const nextConfig = section?.[groupKey]?.examConfig?.rdp || null;
            const protocol = nextConfig?.protocol === 'http' ? 'http' : 'https';
            const nextUrl = nextConfig?.domain
                ? `${protocol}://${nextConfig.domain}/RDWeb/webclient/index.html`
                : null;
            const urlChanged = nextUrl !== this.rdpUrl;
            if (urlChanged) {
                this.rdpUrl = nextUrl;
                this.rdpConfig = nextConfig;
            }
            return urlChanged;
        },

        async fetchInfo() {
            if (!isElectronWindow(window)) return;
            const getinfo = await signalBridge.invoke('getinfoasync');

            applyClientinfoFromFetch(this, getinfo.clientinfo);
            if (getinfo.serverstatus) {
                applyServerstatusFromFetch(this, getinfo.serverstatus);
            }

            const sectionIndex = resolveLockedSection(this.serverstatus, this.clientinfo);
            if (sectionIndex !== this.lockedSection) this.lockedSection = sectionIndex;

            const urlChanged = this.applyRdpConfigFromSection(sectionIndex);
            if (urlChanged && this.$refs.wvmain && this.rdpUrl) {
                this.$refs.wvmain.setAttribute('src', this.rdpUrl);
            }

            this.battery = await navigator.getBattery().then(battery => battery)
                .catch(error => { console.error('Error accessing the Battery API:', error); });

            this.internetCheckCounter++;
            if (this.internetCheckCounter % 5 === 0) {
                this.wlanInfo = await signalBridge.invoke('get-wlan-info');
                this.hostip = await signalBridge.invoke('checkhostip');
                this.internetCheckCounter = 0;
            }
        },

    },
    beforeUnmount() {

        document.body.removeEventListener('mouseleave', this.sendFocuslost);

        const preview = document.querySelector("#preview");
        if (preview && this._onPreviewClick) {
            preview.removeEventListener("click", this._onPreviewClick);
        }
    },
}
</script>

<style scoped>
#webview {
    height: 100% !important;
    width: 100% !important;
    display: block;
    position: relative;
    top: 0 !important;
    left: 0;
}


@media print {
    #apphead {
        display: none !important;
    }

    #content {
        height: 100vh !important;
        width: 100vw !important;
        border-radius: 0px !important;
    }

    #app {
        display: block !important;
        height: 100% !important;

    }

    ::-webkit-scrollbar {
        display: none;
    }
}

#localfiles {
    position: relative;
}

#preview {
    display: none;
    position: absolute;
    top: var(--nx-preview-chrome-top, 148px);
    left: 0;
    width: 100%;
    box-sizing: border-box;
    height: calc(100% - var(--nx-preview-chrome-top, 148px));

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
