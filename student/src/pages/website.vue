<template>
    <div class="column" style="height: 100%">
        <!-- HEADER START -->
        <exam-header
            @reconnect="reconnect"
            @gracefullyExit="gracefullyExit"
        ></exam-header>
        <!-- HEADER END -->


        <!-- filelist start - show local files from workfolder (pdf and gbb only)-->
        <div id="toolbar" class="d-inline p-1 pt-0">
            <button class="btn btn-primary p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="reloadWebview" :title="$t('website.reloadwebview')"> <img src="/img/svg/edit-redo.svg" class="" width="22" height="20" >{{domain}}</button>


            <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
            <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 ms-2 mb-0 btn-sm" @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img src="/img/svg/gtk-convert.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ $t('editor.materials') }}</div>

            <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
                <div v-if="(file.filetype == 'htm')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.filename; loadBase64file(file)"><img src="/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}}</div>
                <div v-if="(file.filetype == 'docx')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.filename; loadBase64file(file)"><img src="/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}}</div>
                <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
                <div v-if="(file.filetype == 'audio')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="loadBase64file(file)"><img src="/img/svg/im-google-talk.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
                <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
            </div>
            <div v-if="allowedUrls.length !== 0"  v-for="allowedUrl in allowedUrls  " class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button" :title="getUrlDisplay(allowedUrl)" @click="showUrl(getUrlDisplay(allowedUrl))">
                <img src="/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{getUrlDisplay(allowedUrl)}}
            </div>
            <!-- exam materials end -->

            <!-- local files start -->
            <div class="white text-muted me-2 ms-2 small d-inline-block mb-0" style="vertical-align: middle;">{{ $t('editor.localfiles') }} </div>
            <div v-for="file in localfiles" class="d-inline mb-0">
                <div v-if="(file.type == 'pdf')"   class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/img/svg/document-replace.svg" class="" width="20" height="20" > {{file.name}} </div>
                <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm" @click="loadImage(file.name)"><img src="/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
                <div v-if="(file.type == 'scratch')" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm" @click="selectedFile=file.name; loadScratchProject(file.name)"><img src="/img/svg/document-replace.svg" class="" width="20" height="20" > {{file.name}}</div>
            </div>
            <!-- local files end -->


        </div>
        <!-- filelist end -->



        <!-- angabe/pdf preview start -->
        <div id="preview" class="fadeinfast p-4">
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
                <div id="focuswarning" class="infodiv p-4 d-block focuswarning" >
                    <div class="mb-3 row">
                        <div class="mb-3 "> {{$t('editor.leftkiosk')}} <br> {{$t('editor.tellsomeone')}} </div>
                        <img src="/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32" >
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


            <div v-if="isLoading" class="overlay">
                <div class="spinner"></div>
                <p>Loading...</p>
            </div>

            <!-- <webview id="webview" autosize="on" ref="wv"  style="width:100%;height:100%"  :src="url" allowpopups></webview> -->
            <webview id="webviewmain" autosize="on" ref="wvmain"   :src="url" :style="{ visibility: isLoading ? 'hidden' : 'visible' }"  allowpopups></webview>

        </div>
    </div>
</template>

<script>
import ExamHeader from '../components/ExamHeader.vue';
import {getBatteryStatus, gracefullyExit, reconnect, showUrl} from '../utils/commonMethods.js'
import { getExamMaterials, loadPDF, loadImage, resetPdfPreviewToolbar} from '../utils/filehandler.js'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'
import WebviewPane from '../components/WebviewPane.vue';
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
        let hostip = ref(configStore.hostip);

        const infoStore = useInfoStore();
        infoStore.online = true;
        infoStore.componentName = "Website";

        let examtype = ref(infoStore.examtype);
        let clientname = ref(infoStore.clientname);
        let serverstatus = ref(infoStore.serverstatus);
        let localLockdown = ref(infoStore.localLockdown);
        let battery = ref(infoStore.battery);
        let wlanInfo = ref(infoStore.wlanInfo);
        let entrytime = ref(infoStore.entryTime);

        return { development, hostip,
            examtype, clientname, serverstatus, localLockdown, battery, wlanInfo, entrytime};
    },

    data() {
        return {
            focus: true,
            exammode: false,
            currentFile:null,
            lockedSection: null,

            // section and url will be resolved on first fetchInfo based on allowSectionSwitch
            url: null,
            domain: null,

            clientinfo: null,
            localfiles: null,

            localUnlockPassword: '',
            localUnlockError: false,
            localUnlockBusy: false,

            currentpreview: null,
            isLoading: true,

            examMaterials: [],
            urlForWebview: null,
            allowedUrls: [],
            webviewVisible: false,
            allowedDomain: null, // Extracted domain for navigation validation
            blockSubdomains: false, // Block subdomains setting from teacher
            blockSubfolders: false, // Block subfolders setting from teacher

            // Event listener references for cleanup
            _onDomReady: null,
            _onPreviewClick: null,
            internetCheckCounter:0,
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
        }
    },
    watch: {
        focus(newValue) {
            if (!newValue && this.localLockdown) {
                this.$nextTick(() => this.$refs.localUnlockInput?.focus());
            }
        },
    },
    components: { ExamHeader, PdfviewPaneRendered, WebviewPane },
    methods: {

        // from filehandler.js
        getExamMaterials:getExamMaterials,
        loadPDF:loadPDF,
        loadImage:loadImage,

        // from commonMethods.js
        gracefullyExit:gracefullyExit,
        showUrl:showUrl,
        reconnect:reconnect,

        getUrlDisplay(allowedUrl) {
            return typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
        },

        hidepreview(){
            resetPdfPreviewToolbar(this);
            this.pdfPreviewState = null;
            let preview = document.querySelector("#preview")
            preview.style.display = 'none';
            URL.revokeObjectURL(this.currentpreview);
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


        reloadWebview(){
            this.$refs.wvmain.setAttribute("src", this.url);
        },

        isScratchEditor() {
            return String(this.url || '').includes('scratch.mit.edu/projects');
        },

        // Load a local .sb2/.sb3 into the Scratch editor without a native file dialog.
        async loadScratchProject(filename) {
            if (!this.isScratchEditor()) return;
            const result = await this.$swal.fire({
                title: this.$t('editor.replace'),
                html: `${this.$t('editor.replacecontent1')} <b>${filename}</b> ${this.$t('editor.replacecontent2')}`,
                icon: 'question',
                showCancelButton: true,
                cancelButtonText: this.$t('editor.cancel'),
            });
            if (!result.isConfirmed) return;
            const webview = document.getElementById('webviewmain');
            const guestId = webview?.getWebContentsId?.();
            if (!guestId) return;
            const loadResult = await signalBridge.invoke('load-scratch-into-webview', { guestId, filename });
            if (!loadResult?.ok) console.error('website @ loadScratchProject:', loadResult?.reason || 'failed');
        },

        // Auto-save scratch project as clientname.sb3 (same interval as text editor backup).
        async saveScratchContent(reason = 'auto') {
            if (!this.isScratchEditor()) return;
            if (reason === 'auto' && useInfoStore().switchingToSection != null) return;
            const webview = document.getElementById('webviewmain');
            const guestId = webview?.getWebContentsId?.();
            if (!guestId) return;
            await signalBridge.invoke('save-scratch-from-webview', {
                guestId,
                filename: `${this.clientname}.sb3`,
                reason,
            });
        },

        async sendFocuslost(){
            if (await shouldSkipEdgeFocusLost(signalBridge, this.development)) return;
            let response = await signalBridge.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
            applyFocusLostFromIpc(this, response, this.development);
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
        async loadFilelist(){
            let filelist = await signalBridge.invoke('getfilesasync', null)
            this.localfiles = filelist;
        },
        formatTime: formatFocusLostTime,
        // Apply website examConfig for locked section; returns true if main webview URL changed.
        applyWebsiteConfigFromSection(sectionIndex) {
            const section = this.serverstatus?.examSections?.[sectionIndex];
            const groupKey = section?.groups && this.clientinfo?.group === 'b' ? 'groupB' : 'groupA';
            const websiteConfig = section?.[groupKey]?.examConfig?.website || null;
            if (!websiteConfig || typeof websiteConfig.url !== 'string') return false;
            const nextUrl = websiteConfig.url;
            const urlChanged = nextUrl !== this.url;
            if (urlChanged) this.url = nextUrl;
            if (nextUrl !== this.domain) this.domain = nextUrl;
            const nextBlockSub = !!websiteConfig.blockSubdomains;
            const nextBlockFolder = !!websiteConfig.blockSubfolders;
            if (nextBlockSub !== this.blockSubdomains) this.blockSubdomains = nextBlockSub;
            if (nextBlockFolder !== this.blockSubfolders) this.blockSubfolders = nextBlockFolder;
            let nextAllowedDomain;
            try {
                nextAllowedDomain = new URL(nextUrl).hostname;
            } catch {
                nextAllowedDomain = nextUrl.replace(/https?:\/\//, '').split('/')[0].split(':')[0];
            }
            if (nextAllowedDomain !== this.allowedDomain) this.allowedDomain = nextAllowedDomain;
            return urlChanged;
        },

        async fetchInfo() {
            const getinfo = await signalBridge.invoke('getinfoasync');

            applyClientinfoFromFetch(this, getinfo.clientinfo);
            if (getinfo.serverstatus) {
                applyServerstatusFromFetch(this, getinfo.serverstatus);
            }

            const sectionIndex = resolveLockedSection(this.serverstatus, this.clientinfo);
            if (sectionIndex !== this.lockedSection) this.lockedSection = sectionIndex;

            const urlChanged = this.applyWebsiteConfigFromSection(sectionIndex);
            if (urlChanged && this.$refs.wvmain && this.url) {
                this.$refs.wvmain.setAttribute('src', this.url);
            }

            this.battery = await getBatteryStatus(this.battery);

            this.internetCheckCounter++;
            if (this.internetCheckCounter % 5 === 0) {
                this.wlanInfo = await signalBridge.invoke('get-wlan-info');
                this.hostip = await signalBridge.invoke('checkhostip');
                this.internetCheckCounter = 0;
            }
        },
    },
    mounted() {

        console.log(`website @ mounted: ${this.url}`)

        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()

        this.$nextTick(async () => { // Code that will run only after the entire view has been rendered

            this.autoSchedulerService(this.fetchInfo, 5000);
            await this.fetchInfo(); // initial sync for clientinfo, serverstatus and url

            try {
                this.wlanInfo = await signalBridge.invoke('get-wlan-info')
                this.hostip = await signalBridge.invoke('checkhostip')
                this.internetCheckCounter = 0
            } catch (err) {
                console.error('website @ mounted: initial wlan/host ip error', err)
            }

            this.autoSchedulerService(this.loadFilelist, 20000);
            this.saveScratchAuto = () => this.saveScratchContent('auto');
            this.autoSchedulerService(this.saveScratchAuto, 20000);

            attachExamMouseleaveGuardBoolean(signalBridge, this.development, this.sendFocuslost);

            signalBridge.on('getmaterials', (event) => {  //trigger document save by signal "save" sent from sendExamtoteacher in communication handler
                console.log("website @ getmaterials: get materials request received")
                this.getExamMaterials();
            });

            signalBridge.on('exam-download-complete', () => { this.loadFilelist(); });


            this.loadFilelist();
            this.getExamMaterials();

            const webview = document.getElementById('webviewmain');
            if (webview) {
                const shadowRoot = webview.shadowRoot;
                const iframe = shadowRoot.querySelector('iframe');
                if (iframe) { iframe.style.height = '100%'; }

                // Setup blocking in backend via IPC - uses unified start-blocking-for-webview with webFilter
                const setupBackendBlocking = async () => {
                    if (webview.getWebContentsId) {
                        const guestId = webview.getWebContentsId();
                        if (guestId) {
                            try {
                                await signalBridge.invoke('start-blocking-for-webview', {
                                    guestId,
                                    allowedUrls: [{
                                        url: this.url,
                                        blockSubdomains: this.blockSubdomains,
                                        blockSubfolders: this.blockSubfolders
                                    }]
                                });
                                console.log(`website @ mounted: backend blocking setup for webview ${guestId}`);
                            }
                            catch (error) {
                                console.error('website @ mounted: failed to setup backend blocking', error);
                            }
                        }
                    }
                };

                // Try to setup blocking immediately, retry on dom-ready if needed
                setupBackendBlocking().catch(() => {
                    const retrySetup = () => {
                        setTimeout(() => {
                            setupBackendBlocking().catch(() => {
                                console.warn('website @ mounted: backend blocking setup failed, will retry');
                            });
                        }, 100);
                    };
                    webview.addEventListener('dom-ready', retrySetup, { once: true });
                });

                console.log('website @ mounted: backend blocking setup initiated');
            }


            // add some eventlisteners once
            this._onPreviewClick = function() {
                this.style.display = 'none';
                this.setAttribute("src", "about:blank");
                URL.revokeObjectURL(this.currentpreview);
            };
            this.autoEventListener(document.querySelector("#preview"), "click", this._onPreviewClick);


            this._onDomReady = () => {
                if (config.showdevtools){ webview.openDevTools();   }
                const isScratch = String(this.url || '').includes('scratch.mit.edu/projects');
                if (!isScratch) return;
                webview.executeJavaScript(`
                    (() => {
                        if (!window.__nxeScratchExamHideInit) {
                            window.__nxeScratchExamHideInit = true;
                            const style = document.createElement('style');
                            style.id = '__nxeScratchExamHide__';
                            style.textContent = '[class*="menu-bar_account-info-group"]{display:none!important;}';
                            document.head.appendChild(style);
                            const hideScratchLoadMenu = () => {
                                document.querySelectorAll('[data-menu-item="true"]').forEach((el) => {
                                    const t = (el.textContent || '').trim().toLowerCase();
                                    if (t.includes('load from your computer') || t.includes('von deinem computer laden')) {
                                        el.style.display = 'none';
                                        el.setAttribute('aria-hidden', 'true');
                                    }
                                });
                            };
                            hideScratchLoadMenu();
                            const obs = new MutationObserver(hideScratchLoadMenu);
                            obs.observe(document.documentElement, { childList: true, subtree: true });
                        }
                        const visitFiber = (f) => {
                            if (!f) return null;
                            const vm = f.memoizedProps?.vm || f.pendingProps?.vm || f.stateNode?.props?.vm;
                            if (vm?.loadProject) return vm;
                            return visitFiber(f.child) || visitFiber(f.sibling);
                        };
                        window.__nxeFindScratchVm = () => {
                            for (const root of document.querySelectorAll('#app, body > div')) {
                                const fiberKey = Object.keys(root).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
                                if (!fiberKey) continue;
                                const vm = visitFiber(root[fiberKey]);
                                if (vm) return vm;
                            }
                            for (const el of document.querySelectorAll('*')) {
                                const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
                                if (!fiberKey) continue;
                                let f = el[fiberKey];
                                while (f) {
                                    const store = f.memoizedProps?.store || f.stateNode?.store;
                                    const storeVm = store?.getState?.()?.scratchGui?.vm;
                                    if (storeVm?.loadProject) return storeVm;
                                    f = f.return;
                                }
                                const vm = visitFiber(el[fiberKey]);
                                if (vm) return vm;
                            }
                            return null;
                        };
                        window.__nxeLoadScratchFromBase64 = async (base64, filename) => {
                            const bin = atob(base64);
                            const bytes = new Uint8Array(bin.length);
                            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                            const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
                            let vm = null;
                            for (let i = 0; i < 24; i++) {
                                vm = window.__nxeFindScratchVm();
                                if (vm?.loadProject) break;
                                await new Promise((r) => setTimeout(r, 250));
                            }
                            if (!vm?.loadProject) return { ok: false, reason: 'no-vm' };
                            try {
                                await vm.loadProject(arrayBuffer);
                                return { ok: true };
                            } catch (err) {
                                return { ok: false, reason: err?.message || String(err) };
                            }
                        };
                        window.__nxeExportScratchSb3 = async () => {
                            let vm = window.__nxeFindScratchVm();
                            if (!vm?.saveProjectSb3) {
                                for (let i = 0; i < 8; i++) {
                                    await new Promise((r) => setTimeout(r, 250));
                                    vm = window.__nxeFindScratchVm();
                                    if (vm?.saveProjectSb3) break;
                                }
                            }
                            if (!vm?.saveProjectSb3) return { ok: false, reason: 'no-vm' };
                            try {
                                const blob = await vm.saveProjectSb3();
                                const buf = await blob.arrayBuffer();
                                const bytes = new Uint8Array(buf);
                                let bin = '';
                                const chunk = 0x8000;
                                for (let i = 0; i < bytes.length; i += chunk) {
                                    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
                                }
                                return { ok: true, base64: btoa(bin) };
                            } catch (err) {
                                return { ok: false, reason: err?.message || String(err) };
                            }
                        };
                    })();
                `);
            };
            this.autoEventListener(webview, 'dom-ready', this._onDomReady);

            // loading events to hide css manipulation
            this.autoEventListener(webview, 'did-stop-loading', () => {   this.isLoading = false;  });

            this.wlanInfo = await signalBridge.invoke('get-wlan-info')
            this.hostip = await signalBridge.invoke('checkhostip')


        });
    },
    beforeUnmount() {
        document.body.removeEventListener('mouseleave', this.sendFocuslost);

        signalBridge.removeAllListeners('getmaterials')
        signalBridge.removeAllListeners('exam-download-complete')

        // Clean up preview click listener
        const preview = document.querySelector("#preview");
        if (preview && this._onPreviewClick) {
            preview.removeEventListener("click", this._onPreviewClick);
        }
    },
}
</script>

<style scoped>


#toolbar {
    z-index: 10001;
    background-color: rgba(var(--bs-dark-rgb))
}


.overlay {
    position: fixed;
    top:45px;
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



#webviewmain{
    height: 100% !important;
    width: 100% !important;
    display: block;
    position: relative;
    top:0;
    left:0;
}

iframe{
    height: 100% !important;
    width: 100% !important;
}


@media print{
    #apphead {
        display: none !important;
    }
    #content {
        height: 100vh !important;
        width: 100vw !important;
        border-radius:0px !important;
    }
    #geogebraframe{
        height: 100% !important;
        width: 100% !important;
    }
    #app {
        display:block !important;
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
    width:100vw;
    height: calc(100vh - var(--nx-preview-top-offset, var(--nx-apphead-h, 60px)));
    background-color: rgba(0, 0, 0, 0.4);
    z-index:100001;
    backdrop-filter: blur(2px);

}


</style>
