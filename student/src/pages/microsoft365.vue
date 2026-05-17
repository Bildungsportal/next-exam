<template>
    <div id="mainmenubar">

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
            :entrytime="entrytime"
            :componentName="componentName"
            :localLockdown="localLockdown"
            :wlanInfo="wlanInfo"
            :hostip="hostip"
            @reconnect="reconnect"
            @gracefullyExit="gracefullyExit"
        ></exam-header>
        <!-- HEADER END -->

        <!-- filelist start - show local files from workfolder (pdf and gbb only)-->
        <div id="toolbar" class="p-0 pb-1 ps-2">

            <button class="btn btn-primary p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="reloadBrowserView"
                    :title="$t('website.reloadwebview')"><img src="/src/assets/img/svg/edit-redo.svg" class=""
                                                              width="22" height="20">Reload MS365
            </button>


            <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                 @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img
                src="/src/assets/img/svg/games-solve.svg" class="white" width="22" height="22"
                style="vertical-align: top;"> {{ $t('editor.materials') }}
            </div>

            <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
            <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
                <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.filename; loadBase64file(file)"><img
                    src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                    style="vertical-align: top;"> {{ file.filename }}
                </div>
                <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                     @click="selectedFile=file.filename; loadBase64file(file)"><img
                    src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                    style="vertical-align: top;"> {{ file.filename }}
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
                                                                              style="vertical-align: top;">
                    {{ file.name }}
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
    </div>


    <div id="content">
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
                    <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32">
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
import {SchedulerService} from '../utils/schedulerservice.js'
import {gracefullyExit, reconnect, showUrl} from '../utils/commonMethods.js'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'
import WebviewPane from '../components/WebviewPane.vue'
import {getExamMaterials, loadImage, loadPDF, resetPdfPreviewToolbar} from '../utils/filehandler.js'
import {isElectronWindow} from "../types/platform.ts";
import {SignalBridge} from '../utils/signalBridge.js'
import { attachExamMouseleaveGuard, shouldSkipEdgeFocusLost } from '../utils/linuxCageKiosk.js'

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);

export default {
    data() {
        return {
            componentName: 'Microsoft365',
            online: true,
            focus: true,
            exammode: false,
            currentFile: null,
            fetchinfointerval: null,
            loadfilelistinterval: null,
            servername: this.$route.params.servername,
            servertoken: this.$route.params.servertoken,
            serverip: this.$route.params.serverip,
            token: this.$route.params.token,
            clientname: this.$route.params.clientname,
            serverApiPort: this.$route.params.serverApiPort,
            clientApiPort: this.$route.params.clientApiPort,
            electron: this.$route.params.electron,
            pincode: this.$route.params.pincode,
            serverstatus: this.$route.params.serverstatus,
            localLockdown: this.$route.params.localLockdown,
            config: this.$route.params.config,
            lockedSection: null,
            clientinfo: null,
            entrytime: 0,
            localfiles: null,
            battery: null,
            warning: false,
            currentpreview: null,
            wlanInfo: null,
            hostip: null,
            examtype: this.$route.params.examtype,
            localLockdown: this.$route.params.localLockdown,
            examMaterials: [],
            urlForWebview: null,
            allowedUrls: [],
            webviewVisible: false,
            internetCheckCounter: 0,
            msOfficeShare: null,
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
        }
    },
    components: {
        ExamHeader, PdfviewPaneRendered, WebviewPane
    },
    mounted() {
        this.fetchInfo()
        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()

        this.$nextTick(async () => { // Code that will run only after the entire view has been rendered

            // do not use setInterval() for intervals as it keeps all objects of the callbacks including fetch() responses in memory until the interval is stopped
            this.fetchinfointerval = new SchedulerService(5000);
            this.fetchinfointerval.addEventListener('action', this.fetchInfo);  // event listener that reacts to the 'action' event (only reacts to 'action' from this instance and does not interfere)
            this.fetchinfointerval.start();
            this.loadfilelistinterval = new SchedulerService(10000);
            this.loadfilelistinterval.addEventListener('action', this.loadFilelist);  // event listener that reacts to the 'action' event (only reacts to 'action' from this instance and does not interfere)
            this.loadfilelistinterval.start();

            attachExamMouseleaveGuard(signalBridge, this.config, this.sendFocuslost);

            this.loadFilelist()
            this.getExamMaterials()

            if (isElectronWindow(window)) {
                document.querySelector("#preview").addEventListener("click", function () {
                    this.style.display = 'none';
                    this.setAttribute("src", "about:blank");
                    URL.revokeObjectURL(this.currentpreview);
                    signalBridge.send('restore-browserview');
                });


                // Listen for window resize events to update header height
                window.addEventListener('resize', this.updateHeaderHeight);

                await this.sleep(1000)
                // Update header height after initial render
                this.updateHeaderHeight();

                this.wlanInfo = await signalBridge.invoke('get-wlan-info')
                this.hostip = await signalBridge.invoke('checkhostip')

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
                        signalBridge.send('update-menu-height', height);
                    }
                }
            });
        },

        // reload the browser view - this needs to load the ms365 domain again in electron browserview
        reloadBrowserView() {
            signalBridge.invoke('reload-browser-view', this.msOfficeShare);
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
            if (isElectronWindow(window)) {
                signalBridge.send('restore-browserview');   // ms365 only !!!!!!!!!!
            }
        },

        async sendFocuslost() {
            if (await shouldSkipEdgeFocusLost(signalBridge, this.config.development)) return;
            if (isElectronWindow(window)) {
                let response = await signalBridge.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
                if (!this.config.development && !response.focus) {  //immediately block frontend
                    this.focus = false
                }
            }
        },
        formatTime(unixTime) {
            const date = new Date(unixTime * 1000); // Convert Unix time to milliseconds
            return date.toLocaleTimeString('en-US', {hour12: false}); // Adjust locale and options as needed
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

        // implementing a sleep (wait) function
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        async loadFilelist() {
            if (isElectronWindow(window)) {
                let filelist = await signalBridge.invoke('getfilesasync', null)
                this.localfiles = filelist;
            }
        },
        async fetchInfo() {
            if (isElectronWindow(window)) {
                let getinfo = await signalBridge.invoke('getinfoasync')   // we need to fetch the updated version of the systemconfig from express api (server.js)

                this.clientinfo = getinfo.clientinfo;
                this.token = this.clientinfo.token
                this.focus = this.clientinfo.focus
                this.clientname = this.clientinfo.name
                this.exammode = this.clientinfo.exammode
                this.pincode = this.clientinfo.pin
                this.msOfficeShare = this.clientinfo.msofficeshare;

                this.serverstatus = getinfo.serverstatus

                // decide which locked section index is authoritative (client vs server)
                const sectionIndex = (this.serverstatus.allowSectionSwitch && this.clientinfo.lockedSection != null)
                    ? this.clientinfo.lockedSection
                    : this.serverstatus.lockedSection

                this.lockedSection = sectionIndex

                if (!this.focus) {
                    this.warning = true
                    this.entrytime = new Date().getTime()
                    signalBridge.send('collapse-browserview')
                }
                if (this.focus && this.warning) {
                    this.warning = false
                    signalBridge.send('restore-browserview')
                }

                if (this.clientinfo && this.clientinfo.token) {
                    this.online = true
                } else {
                    this.online = false
                }

                this.battery = await navigator.getBattery().then(battery => {
                    return battery
                })
                    .catch(error => {
                        console.error("Error accessing the Battery API:", error);
                    });

                this.internetCheckCounter++
                if (this.internetCheckCounter % 5 === 0) {
                    this.wlanInfo = await signalBridge.invoke('get-wlan-info')
                    this.hostip = await signalBridge.invoke('checkhostip')
                    this.internetCheckCounter = 0
                }
            }
        },

    },
    beforeUnmount() {
        this.loadfilelistinterval.removeEventListener('action', this.loadFilelist);
        this.loadfilelistinterval.stop()

        this.fetchinfointerval.removeEventListener('action', this.fetchInfo);
        this.fetchinfointerval.stop()
        document.body.removeEventListener('mouseleave', this.sendFocuslost);

        // Remove resize event listener
        window.removeEventListener('resize', this.updateHeaderHeight);

        // Clean up preview click listener
        const preview = document.querySelector("#preview");
        if (preview) {
            preview.removeEventListener("click", function () {
                this.style.display = 'none';
                this.setAttribute("src", "about:blank");
            });
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
