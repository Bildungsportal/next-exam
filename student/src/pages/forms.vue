<template>
  <div class="column" style="height: 100%">
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
    <div id="toolbar" class="d-inline p-1">
        <button class="btn btn-primary p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="reloadWebview"
                :title="$t('website.reloadwebview')"><img src="/src/assets/img/svg/edit-redo.svg" class="" width="22"
                                                          height="20">Reload Forms
        </button>


        <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
        <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
             @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img
            src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;">
            {{ $t('editor.materials') }}
        </div>

        <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
            <div v-if="(file.filetype == 'bak')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                 @click="selectedFile=file.filename; loadBase64file(file)"><img
                src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;">
                {{ file.filename }}
            </div>
            <div v-if="(file.filetype == 'docx')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
                 @click="selectedFile=file.filename; loadBase64file(file)"><img
                src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;">
                {{ file.filename }}
            </div>
            <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                 @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg"
                                                                                class="grey" width="22" height="22"
                                                                                style="vertical-align: top;">
                {{ file.filename }}
            </div>
            <div v-if="(file.filetype == 'audio')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                 @click="loadBase64file(file)"><img src="/src/assets/img/svg/im-google-talk.svg" class="" width="22"
                                                    height="22" style="vertical-align: top;"> {{ file.filename }}
            </div>
            <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                 @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg"
                                                                                class="grey" width="22" height="22"
                                                                                style="vertical-align: top;">
                {{ file.filename }}
            </div>
        </div>

        <div v-if="allowedUrls.length !== 0" v-for="allowedUrl in allowedUrls  "
             class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button" :title="allowedUrl"
             @click="showUrl(allowedUrl)">
            <img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                 style="vertical-align: top;"> {{ allowedUrl }}
        </div>

        <!-- exam materials end -->
        <!-- local files start -->
        <div class="white text-muted me-2 ms-2 small d-inline-block mb-0" style="vertical-align: middle;">
            {{ $t('editor.localfiles') }}
        </div>
        <div v-for="file in localfiles" class="d-inline mb-0">
            <div v-if="(file.type == 'pdf')" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm"
                 @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/document-replace.svg"
                                                                          class="" width="20" height="20">
                {{ file.name }}
            </div>
            <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm"
                 @click="loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22"
                                                    height="22" style="vertical-align: top;"> {{ file.name }}
            </div>
        </div>
        <!-- local files end -->
    </div>
    <!-- filelist end -->


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
        <PdfviewPane
            :src="currentpreview"
            :localLockdown="localLockdown"
            :examtype="examtype"
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
        <webview ref="wvmain" id="gformswebview" autosize="on"
                 :src="`https://docs.google.com/forms/d/e/${gformsTestId}/viewform`"></webview>

    </div>
  </div>
</template>

<script>
import moment from 'moment-timezone';
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js'
import {gracefullyExit, reconnect, showUrl} from '../utils/commonMethods.js'
import PdfviewPane from '../components/PdfviewPane.vue'
import WebviewPane from '../components/WebviewPane.vue'
import {getExamMaterials, loadImage, loadPDF} from '../utils/filehandler.js'
import {isElectronWindow} from "../types/platform.ts";
import {SignalBridge} from '../utils/signalBridge.js'

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);

export default {
    data() {
        return {
            componentName: 'Forms',
            online: true,
            focus: true,
            exammode: false,
            examtype: this.$route.params.examtype,
            currentFile: null,
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
            pincode: this.$route.params.pincode,

            serverstatus: this.$route.params.serverstatus,
            localLockdown: this.$route.params.localLockdown,

            gformsTestId: this.$route.params.serverstatus.examSections[this.$route.params.serverstatus.lockedSection].gformsTestId,

            config: this.$route.params.config,
            clientinfo: null,
            entrytime: 0,
            timesinceentry: 0,
            currenttime: 0,
            now: new Date().getTime(),
            localfiles: null,
            battery: null,
            currentpreview: null,
            wlanInfo: null,
            hostip: null,
            examMaterials: [],
            allowedUrls: [],
            urlForWebview: null,
            webviewVisible: false,

            // Event listener references for cleanup
            _onDomReady: null,
            _onPreviewClick: null,
            internetCheckCounter: 0
        }
    },
    components: {ExamHeader, PdfviewPane, WebviewPane},
    async mounted() {
        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()

        // console.log(this.serverstatus)

        this.$nextTick(async () => { // Code that will run only after the entire view has been rendered

            // intervalle nicht mit setInterval() da dies sämtliche objekte der callbacks inklusive fetch() antworten im speicher behält bis das interval gestoppt wird
            this.fetchinfointerval = new SchedulerService(5000);
            this.fetchinfointerval.addEventListener('action', this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.fetchinfointerval.start();

            this.clockinterval = new SchedulerService(1000);
            this.clockinterval.addEventListener('action', this.clock);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.clockinterval.start();

            this.loadfilelistinterval = new SchedulerService(10000);
            this.loadfilelistinterval.addEventListener('action', this.loadFilelist);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.loadfilelistinterval.start();

            document.body.addEventListener('mouseleave', this.sendFocuslost);

            this.loadFilelist()
            this.getExamMaterials()


            const webview = document.getElementById('gformswebview');
            if (webview) {
                const shadowRoot = webview.shadowRoot;
                const iframe = shadowRoot.querySelector('iframe');
                if (iframe) {
                    iframe.style.height = '100%';
                }  // for some reason iframe height is only 200px

                // Setup blocking in backend via IPC - this ensures events are caught early
                const setupBackendBlocking = async () => {
                    if (webview.getWebContentsId) {
                        const guestId = webview.getWebContentsId();
                        if (guestId) {
                            try {
                                if (isElectronWindow(window)) {
                                    await signalBridge.invoke('start-blocking-for-website-webview', {
                                        guestId,
                                        mode: 'forms',
                                        gformsTestId: this.gformsTestId
                                    });
                                    console.log(`forms @ mounted: backend blocking setup for webview ${guestId}`);
                                }
                            } catch (error) {
                                console.error('forms @ mounted: failed to setup backend blocking', error);
                            }
                        }
                    }
                };

                // Try to setup blocking immediately, retry on dom-ready if needed
                setupBackendBlocking().catch(() => {
                    const retrySetup = () => {
                        setTimeout(() => {
                            setupBackendBlocking().catch(() => {
                                console.warn('forms @ mounted: backend blocking setup failed, will retry');
                            });
                        }, 100);
                    };
                    webview.addEventListener('dom-ready', retrySetup, {once: true});
                });

                console.log('forms @ mounted: backend blocking setup initiated');

                this._onDomReady = () => {
                    if (config.showdevtools) {
                        webview.openDevTools();
                    }
                    webview.executeJavaScript(`
                        (() => {  // Anonyme Funktion für eigenen Scope sonst wird beim reload der page (absenden der form ) die variable erneut deklariert und failed
                            const formElement = document.querySelector('form'); // Finden des <form> Elements
                            const nextElement = formElement ? formElement.nextElementSibling : null;   //das element das wir ausblenden wollen hat keine id aber es kommt direkt nach der form
                            if (nextElement) { nextElement.style.display = 'none'; }
                            const element = document.querySelector('[aria-label="Problem an Google melden"]');  // Finden des Elements mit aria-label="Problem an Google melden"
                            if (element) { element.style.display = 'none'; }
                            const element2 = document.querySelector('[aria-label="Punktzahl ansehen"]');  // the button doesnt work anyways and doesnt make sense if questions have been answered with longtext
                            if (element2) { element2.style.display = 'none'; }
                        })();  // Sofortige Ausführung der anonymen Funktion
                    `);
                };
                webview.addEventListener('dom-ready', this._onDomReady);
            }


            // add some eventlisteners once
            this._onPreviewClick = function () {
                this.style.display = 'none';
                this.setAttribute("src", "about:blank");
                URL.revokeObjectURL(this.currentpreview);
            };
            document.querySelector("#preview").addEventListener("click", this._onPreviewClick);


        });
        if (isElectronWindow(window)) {
            this.wlanInfo = await signalBridge.invoke('get-wlan-info')
            this.hostip = await signalBridge.invoke('checkhostip')
        }

    },
    methods: {
        // from commonMethods.js
        gracefullyExit: gracefullyExit,
        showUrl: showUrl,
        reconnect: reconnect,

        // from filehandler.js
        getExamMaterials: getExamMaterials,
        loadPDF: loadPDF,
        loadImage: loadImage,


        reloadWebview() {
            this.$refs.wvmain.setAttribute("src", `https://docs.google.com/forms/d/e/${this.gformsTestId}/viewform`);
        },

        hidepreview() {
            let preview = document.querySelector("#preview")
            preview.style.display = 'none';
            preview.setAttribute("src", "about:blank");
            URL.revokeObjectURL(this.currentpreview);
        },


        loadBase64file(file) {
            this.webviewVisible = false
            if (file.filetype == 'pdf') {
                this.loadPDF(file, true)
                return
            } else if (file.filetype == 'image') {
                this.loadImage(file, true)
                return
            }
        },

        async sendFocuslost() {
            if (isElectronWindow(window)) {
                let response = await signalBridge.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
                if (!this.config.development && !response.focus) {  //immediately block frontend
                    this.focus = false
                }
            }
        },
        //checks if arraybuffer contains a valid pdf file
        isValidPdf(data) {
            const header = new Uint8Array(data, 0, 5); // Lese die ersten 5 Bytes für "%PDF-"
            // Umwandlung der Bytes in Hexadezimalwerte für den Vergleich
            const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D]; // "%PDF-" in Hex
            for (let i = 0; i < pdfHeader.length; i++) {
                if (header[i] !== pdfHeader[i]) {
                    return false; // Früher Abbruch, wenn ein Byte nicht übereinstimmt
                }
            }
            return true; // Alle Bytes stimmen mit dem PDF-Header überein
        },


        async loadFilelist() {
            if (isElectronWindow(window)) {
                let filelist = await signalBridge.invoke('getfilesasync', null)
                this.localfiles = filelist;
            }
        },
        clock() {
            this.now = new Date().getTime()
            this.timesinceentry = new Date(this.now - this.entrytime).toISOString().substr(11, 8)
            this.currenttime = moment().tz('Europe/Vienna').format('HH:mm:ss');
        },

        formatTime(unixTime) {
            const date = new Date(unixTime * 1000); // Convert Unix time to milliseconds
            return date.toLocaleTimeString('en-US', {hour12: false}); // Adjust locale and options as needed
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
                
                this.serverstatus = getinfo.serverstatus
                this.lockedSection = this.clientinfo.lockedSection

                if (!this.focus) {
                    this.entrytime = new Date().getTime()
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

        this.clockinterval.removeEventListener('action', this.clock);
        this.clockinterval.stop()
        document.body.removeEventListener('mouseleave', this.sendFocuslost);

        // Clean up webview by removing it from DOM to prevent crashes (blocking is handled in backend, but we still clean up local listeners)
        const webview = document.getElementById('gformswebview');
        if (webview) {
            // Remove webview element listeners
            if (this._onDomReady) {
                webview.removeEventListener('dom-ready', this._onDomReady);
            }
            // Remove webview from DOM to prevent crashes when window closes
            try {
                if (webview.parentNode) {
                    webview.parentNode.removeChild(webview);
                }
            } catch (err) {
                console.warn('forms @ beforeUnmount: error removing webview from DOM:', err);
            }
        }

        // Clean up preview click listener
        const preview = document.querySelector("#preview");
        if (preview && this._onPreviewClick) {
            preview.removeEventListener("click", this._onPreviewClick);
        }
    },
}
</script>

<style scoped>


#gformswebview {
    height: 100% !important;
    width: 100% !important;
    display: block;
    position: relative;
    top: 0;
    left: 0;
}

iframe {
    height: 100% !important;
    width: 100% !important;
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


#localfiles {
    position: relative;


}


#preview {
    display: none;
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 100001;
    backdrop-filter: blur(2px);

}


#pdfembed {
    background-color: rgba(255, 255, 255, 0.5);
    border: 0px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 15px rgba(22, 9, 9, 0.5);
    border-radius: 6px;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center;
}

.embed-container {
    position: absolute;
    top: 50%;
    left: 50%;
    margin-top: 30px;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: flex-start;
}


</style>
