<template>
    <div class="column" style="height: 100%">
        <!-- HEADER START -->
        <exam-header
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
                <div v-if="(file.filetype == 'htm')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"
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
                 class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button" :title="getUrlDisplay(allowedUrl)"
                 @click="showUrl(getUrlDisplay(allowedUrl))">
                <img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22"
                     style="vertical-align: top;"> {{ getUrlDisplay(allowedUrl) }}
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
                    <div v-if="localLockdown" class="mt-2">
                        <div class="input-group">
                            <span class="input-group-text">{{ $t('student.password') }}</span>
                            <input
                                ref="localUnlockInput"
                                v-model="localUnlockPassword"
                                class="form-control"
                                type="password"
                                autocomplete="current-password"
                                :placeholder="$t('student.password')"
                                @input="localUnlockError = false"
                                @keyup.enter="tryUnlockLocalLockdown"
                            >
                            <button class="btn btn-outline-dark" type="button" :disabled="localUnlockBusy" @click="tryUnlockLocalLockdown">
                                {{ $t('editor.unlock') }}
                            </button>
                        </div>
                        <div v-if="localUnlockError" class="mt-2 text-dark">
                            {{ $t("general.wrongpassword") }}
                        </div>
                    </div>
                </div>
            </div>
            <!-- focuswarning end  -->
            <webview ref="wvmain" id="formswebview" autosize="on"
                     :src="formsUrlComputed"></webview>

        </div>
    </div>
</template>

<script>
import ExamHeader from '../components/ExamHeader.vue';
import {gracefullyExit, reconnect, showUrl} from '../utils/commonMethods.js'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'
import WebviewPane from '../components/WebviewPane.vue'
import {getExamMaterials, loadImage, loadPDF, resetPdfPreviewToolbar} from '../utils/filehandler.js'
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

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);

export default {
    mixins: [autoCleanupMixin],

    setup() {
        const configStore = useConfigStore();
        let development = ref(configStore.development);
        let serverApiPort = ref(configStore.serverApiPort);
        let electron = ref(configStore.electron);
        let hostip = ref(configStore.hostip);
        let showdevtools = ref(configStore.showdevtools);

        const infoStore = useInfoStore();
        infoStore.online = true;
        infoStore.componentName = "Forms";

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

        return { development, serverApiPort, electron, hostip, showdevtools,
            examtype, servername, servertoken, serverip, token, clientname, serverstatus, clientApiPort,
            pincode, localLockdown, online, battery, wlanInfo, entrytime };
    },

    data() {
        return {
            focus: true,
            exammode: false,
            currentFile: null,
            localUnlockPassword: '',
            localUnlockError: false,
            localUnlockBusy: false,

            // section and forms url will be resolved on first fetchInfo based on allowSectionSwitch
            lockedSection: null,
            formsUrl: null,

            clientinfo: null,
            localfiles: null,
            currentpreview: null,
            examMaterials: [],
            allowedUrls: [],
            urlForWebview: null,
            webviewVisible: false,

            // Event listener references for cleanup
            _onDomReady: null,
            _onPreviewClick: null,
            internetCheckCounter: 0,
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
        }
    },
    computed: {
        formsUrlComputed() {
            return this.formsUrl || 'about:blank'
        }
    },
    watch: {
        focus(newValue) {
            if (!newValue && this.localLockdown) {
                this.$nextTick(() => this.$refs.localUnlockInput?.focus());
            }
        },
    },
    components: {ExamHeader, PdfviewPaneRendered, WebviewPane},
    async mounted() {
        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()

        this.$nextTick(async () => { // Code that will run only after the entire view has been rendered

            this.autoSchedulerService(this.fetchInfo, 5000);
            await this.fetchInfo(); // initial sync for clientinfo, serverstatus and forms url

            try {
                this.wlanInfo = await signalBridge.invoke('get-wlan-info')
                this.hostip = await signalBridge.invoke('checkhostip')
                this.internetCheckCounter = 0
            } catch (err) {
                console.error('forms @ mounted: initial wlan/host ip error', err)
            }

            this.autoSchedulerService(this.loadFilelist, 10000);

            attachExamMouseleaveGuardBoolean(signalBridge, this.development, this.sendFocuslost);

            this.loadFilelist()
            this.getExamMaterials()


            const webview = document.getElementById('formswebview');
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
                                        formsUrl: this.formsUrl
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
                    if (this.showdevtools) {
                        webview.openDevTools();
                    }
                    webview.executeJavaScript(`
                        (() => {  // anonymous function for its own scope, otherwise the variable is re-declared on page reload (form submit) and fails
                            const formElement = document.querySelector('form'); // find the <form> element
                            const nextElement = formElement ? formElement.nextElementSibling : null;   //the element we want to hide has no id but comes directly after the form
                            if (nextElement) { nextElement.style.display = 'none'; }
                            const element = document.querySelector('[aria-label="Problem an Google melden"]');  // Finden des Elements mit aria-label="Problem an Google melden"
                            if (element) { element.style.display = 'none'; }
                            const element2 = document.querySelector('[aria-label="Punktzahl ansehen"]');  // the button doesnt work anyways and doesnt make sense if questions have been answered with longtext
                            if (element2) { element2.style.display = 'none'; }

                            // CSS-basiertes Ausblenden problematischer Links und Footer
                            try {
                                const style = document.createElement('style');
                                style.type = 'text/css';
                                style.textContent = \`
                                    /* Microsoft Forms: alle Links im Branding / Hilfebereich ausblenden */
                                    [role="link"] {
                                        display: none !important;
                                    }
                                    #branding-footer {
                                        display: none !important;
                                    }
                                    #FormTitleId_EnableScreenReader {
                                        display: none !important;
                                    }
                                    button[aria-label="Formularmenü"],
                                    button[aria-label="Form menu"] {
                                        display: none !important;
                                    }

                                    /* Google Forms: hide help/feedback menu including report abuse */
                                    div[data-report-abuse-url] button[aria-haspopup="menu"],
                                    div[data-report-abuse-url] button[aria-label="Hilfe und Feedback"],
                                    div[data-report-abuse-url] button[aria-label="Help & feedback"] {
                                        display: none !important;
                                    }
                                \`;
                                document.head.appendChild(style);
                            } catch (e) {
                                console.warn('[Next-Exam Forms] failed to inject CSS', e);
                            }


                        })();  // immediately invoke the anonymous function
                    `);
                };
                this.autoEventListener(webview, 'dom-ready', this._onDomReady);
            }


            // add some eventlisteners once
            this._onPreviewClick = function () {
                this.style.display = 'none';
                this.setAttribute("src", "about:blank");
                URL.revokeObjectURL(this.currentpreview);
            };
            this.autoEventListener(document.querySelector("#preview"), "click", this._onPreviewClick);

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
        getUrlDisplay(allowedUrl) {
            return typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
        },

        // from filehandler.js
        getExamMaterials: getExamMaterials,
        loadPDF: loadPDF,
        loadImage: loadImage,


        async reloadWebview() {
            if (!this.$swal) {
                this.$refs.wvmain.setAttribute("src", this.formsUrlComputed);
                return;
            }

            const result = await this.$swal.fire({
                title: this.$t('forms.reload_title') || 'Formular neu laden?',
                text: this.$t('forms.reload_text') || 'Wenn Sie das Formular neu laden, gehen alle bisherigen Eingaben verloren.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: this.$t('forms.reload_confirm') || 'OK',
                cancelButtonText: this.$t('forms.reload_cancel') || this.$t('dashboard.cancel') || 'Abbrechen',
                customClass: {
                    popup: 'my-popup',
                    title: 'my-title',
                    content: 'my-content',
                    actions: 'my-swal2-actions'
                }
            });

            if (result.isConfirmed) {
                this.$refs.wvmain.setAttribute("src", this.formsUrlComputed);
            }
        },

        hidepreview() {
            resetPdfPreviewToolbar(this);
            this.pdfPreviewState = null;
            let preview = document.querySelector("#preview")
            preview.style.display = 'none';
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
            if (await shouldSkipEdgeFocusLost(signalBridge, this.development)) return;
            if (isElectronWindow(window)) {
                let response = await signalBridge.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
                applyFocusLostFromIpc(this, response, this.development);
            }
        },
        async tryUnlockLocalLockdown() {
            if (!this.localLockdown) return;

            const expected = this.serverstatus?.password ?? "";
            const provided = this.localUnlockPassword ?? "";
            if (!expected || provided !== expected) {
                this.localUnlockError = true;
                return;
            }

            this.localUnlockBusy = true;
            try {
                const result = await signalBridge.invoke('restorefocusstateLocal');
                if (result?.ok) {
                    this.localUnlockPassword = '';
                    this.localUnlockError = false;
                    this.focus = true;
                    return;
                }
                this.localUnlockError = true;
            } finally {
                this.localUnlockBusy = false;
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

        // Apply forms examConfig for locked section; returns true if main webview URL changed.
        applyFormsConfigFromSection(sectionIndex) {
            const section = this.serverstatus?.examSections?.[sectionIndex];
            const groupKey = section?.groups && this.clientinfo?.group === 'b' ? 'groupB' : 'groupA';
            const formsConfig = section?.[groupKey]?.examConfig?.forms || null;
            if (!formsConfig || typeof formsConfig.url !== 'string') return false;
            const nextUrl = formsConfig.url;
            const urlChanged = nextUrl !== this.formsUrl;
            if (urlChanged) this.formsUrl = nextUrl;
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

            const urlChanged = this.applyFormsConfigFromSection(sectionIndex);
            if (urlChanged && this.$refs.wvmain) {
                this.$refs.wvmain.setAttribute('src', this.formsUrlComputed);
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

        // Clean up webview by removing it from DOM to prevent crashes (blocking is handled in backend, but we still clean up local listeners)
        const webview = document.getElementById('formswebview');
        if (webview) {
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


#formswebview {
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
    top: var(--nx-preview-top-offset, var(--nx-apphead-h, 60px));
    left: 0;
    width: 100vw;
    height: calc(100vh - var(--nx-preview-top-offset, var(--nx-apphead-h, 60px)));
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
