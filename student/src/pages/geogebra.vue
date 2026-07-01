 <!-- 
    Made with GeoGebra https://www.geogebra.org
    License Information: 
        https://stage.geogebra.org/license#NonCommercialLicenseAgreement
        https://www.gnu.org/licenses/gpl-3.0.html

    This page allows you to use geogebra classic and geogebra suite in the context of next-exam 
    Some features of geogebra are hidden because of the restrictive nature of the digital exam environment
    Tracking features have been removed to comply with dsgvo regulations
  -->
 
 
 <template> 
   
<div class="geogebra-page-root">

    <!-- HEADER START -->
    <exam-header
      @reconnect="reconnect"
      @gracefullyExit="gracefullyExit"
    ></exam-header>
     <!-- HEADER END -->

    <div class="geogebra-main">

    <!-- filelist start - show local files from workfolder (pdf and gbb only)-->
    <div id="toolbar" class="d-inline p-1">  
        <button title="backup" @click="saveContent(null, 'manual'); " class="btn d-inline btn-success p-0 pe-2 ps-1 ms-1 mb-0 btn-sm"><img src="/src/assets/img/svg/document-save.svg" class="white" width="20" height="20" ></button>
        <button title="delete" @click="clearAll(); " class=" btn  d-inline btn-danger p-0 pe-2 ps-1 ms-2 mb-0 btn-sm"><img src="/src/assets/img/svg/edit-delete.svg" class="white" width="20" height="20" ></button>
        <button title="paste" @click="showClipboard(); " class="btn  d-inline btn-secondary p-0 pe-2 ps-1 ms-2 mb-0 btn-sm"><img src="/src/assets/img/svg/edit-paste-style.svg" class="white" width="20" height="20" ></button>
        <div class="btn-group  ms-2 me-1 mb-0 " role="group">
            <div class="btn btn-outline-info btn-sm p-0 pe-2 ps-1  mb-0" @click="setsource('suite')"> <img src="/src/assets/img/svg/formula.svg" class="" width="20" height="20" >suite</div>
            <div class="btn btn-outline-info btn-sm p-0 pe-2 ps-1  mb-0" @click="setsource('classic')"> <img src="/src/assets/img/svg/formula.svg" class="" width="20" height="20" >classic</div>
        </div>
        

    
 


        <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
        <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm" @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ $t('editor.materials') }}</div>

        <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
            <div v-if="(file.filetype === 'htm')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}}</div>
            <div v-if="(file.filetype === 'docx')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}}</div>
            <div v-if="(file.filetype === 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
            <div v-if="(file.filetype === 'audio')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="loadBase64file(file)"><img src="/src/assets/img/svg/im-google-talk.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
            <div v-if="(file.filetype === 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
        </div>       
        
        <div v-if="allowedUrls.length !== 0"  v-for="allowedUrl in allowedUrls  " class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button" :title="getUrlDisplay(allowedUrl)" @click="showUrl(getUrlDisplay(allowedUrl))">
            <img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{getUrlDisplay(allowedUrl)}}
        </div>
        <!-- exam materials end -->





        <!-- local files start -->
        <div class="white text-muted me-2 ms-2 small d-inline-block mb-0" style="vertical-align: middle;">{{ $t('editor.localfiles') }} </div>
        <div v-for="file in localfiles" class="d-inline mb-0">
            <div v-if="(file.type == 'pdf')"   :class="{'bg-warning': file.name == currentFile}" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/document-replace.svg" class="" width="20" height="20" > {{file.name}} </div>
            <div v-if="(file.type == 'ggb')"   :class="{'bg-warning': file.name == currentFile}" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm" @click="selectedFile=file.name; loadGGB(file.name)"><img src="/src/assets/img/svg/document-replace.svg" class="" width="20" height="20" > {{file.name}} </div>
            <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm" @click="loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
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

    <div id="ggb-canvas-wrap" ref="ggbSurface" class="ggb-canvas-wrap">
          <!-- focus warning start -->
          <div v-if="!focus" class="focus-container">
            <div id="focuswarning" class="infodiv p-4 d-block focuswarning" >
                <div class="mb-3 row">
                    <div class="mb-3 "> {{$t('editor.leftkiosk')}} <br> {{$t('editor.tellsomeone')}} </div>
                    <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32" >
                    <div class="mt-3"> {{ formatTime(entrytime) }}</div>
                </div>
            </div>
        </div>
        <!-- focuswarning end  -->
        <div id="ggb-applet-host"></div>
    </div>

    </div>

    <Transition name="clipboard-slide">
      <aside
        v-if="isClipboardVisible"
        class="customClipboard"
        :aria-label="$t('editor.clipboard')"
      >
        <div class="customClipboard__header">
          <span class="customClipboard__title">{{ $t('editor.clipboard') }}</span>
          <button
            type="button"
            class="customClipboard__close"
            :aria-label="$t('editor.close')"
            @click="showClipboard()"
          >
            ×
          </button>
        </div>
        <div class="customClipboard__list">
          <button
            v-for="(item, index) in customClipboard"
            :key="index"
            type="button"
            class="customClipboard__item"
            @mousedown.prevent="insertFromClipboard(item)"
            @keydown.enter.prevent="insertFromClipboard(item)"
            @keydown.space.prevent="insertFromClipboard(item)"
          >
            <img
              src="/src/assets/img/svg/edit-paste-style.svg"
              alt=""
              width="16"
              height="16"
              class="customClipboard__item-icon"
            />
            <span class="customClipboard__item-text">{{ item }}</span>
          </button>
          <p v-if="!customClipboard.length" class="customClipboard__empty">{{ $t('editor.clipboardEmpty') }}</p>
        </div>
      </aside>
    </Transition>

</div>

</template>

<script>

/* global GGBApplet */

import ExamHeader from '../components/ExamHeader.vue';
import WebviewPane from '../components/WebviewPane.vue'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'

import { getExamMaterials, loadPDF, loadImage, loadGGB, resetPdfPreviewToolbar} from '../utils/filehandler.js'
import { gracefullyExit, reconnect, showUrl } from '../utils/commonMethods.js'
import {SignalBridge} from '../utils/signalBridge.js'
import {
    attachExamMouseleaveGuardBoolean,
    shouldSkipEdgeFocusLost
} from '../utils/linuxCageKiosk.js'
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

let ggbDeployLoadPromise = null

function loadGgbDeployScript() {
    if (typeof window !== 'undefined' && typeof window.GGBApplet === 'function') {
        return Promise.resolve()
    }
    if (ggbDeployLoadPromise) {
        return ggbDeployLoadPromise
    }
    const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
    ggbDeployLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `${base}GeoGebra/deployggb.js`
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('GeoGebra deploy script failed to load'))
        document.head.appendChild(script)
    })
    return ggbDeployLoadPromise
}

function ggbHtml5CodebaseUrl() {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
    return `${base}GeoGebra/HTML5/5.0/web3d/`
}



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
      infoStore.componentName = "GeoGebra";

      let examtype = ref(infoStore.examtype);
      let servername = ref(infoStore.servername);
      let serverip = ref(infoStore.serverip);
      let token = ref(infoStore.token);
      let clientname = ref(infoStore.clientname);
      let serverstatus = ref(infoStore.serverstatus);
      let pincode = ref(infoStore.pincode);
      let localLockdown = ref(infoStore.localLockdown);
      let online = ref(infoStore.online);
      let battery = ref(infoStore.battery);
      let wlanInfo = ref(infoStore.wlanInfo);
      let entrytime = ref(infoStore.entryTime);

      return { development, serverApiPort, electron, hostip,
        examtype, servername, serverip, token, clientname, serverstatus, pincode, localLockdown, online, battery, wlanInfo, entrytime};
    },

    data() {
        return {
            focus: true,
            exammode: false,
            currentFile:null,
            lockedSection: null,
            clientinfo: null,
            now : new Date().getTime(),
            localfiles: null,
            customClipboard: [],
            isClipboardVisible: false,
            currentpreview: null,
            examMaterials: [],
            allowedUrls: [],
            webviewVisible: false,
            urlForWebview: null,
            
            // Event listener references for cleanup
            _onPreviewClick: null,
            _onUnhandledRejection: null,
            internetCheckCounter:0,
            ggbReady:false,
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
            _resizeHandler: null,
            _ggbClipIgnoreSelectUntil: 0,
            _ggbResizeObs: null,
            customCSS: `
                #buttonsID { display: none !important; }
                button[id="mode26"],
                button[aria-label="Hilfe"],
                button[aria-label="Help"] { display: none !important; }

 
                button.helpBtn { display: none !important; }
                li[aria-label="Hilfe & Feedback"],
                li[aria-label="Help & Feedback"],
                li[aria-label="Anmelden"],
                li[aria-label="Sign In"],
                li[aria-label="Datei"],
                li[aria-label="File"] { display: none !important; }
            `,
            hideMenuTexts: [
                'Neu', 'New',
                'Prüfungsmodus', 'Exam Calculator',
                'Hilfe & Feedback', 'Help & Feedback',
                'Anmelden', 'Sign In',
                'Bild exportieren', 'Export Image',
                'Online speichern', 'Save Online',
                'Öffnen', 'Open',
                'Auf dem Computer speichern', 'Save to Device',
                'Teilen', 'Share',
                'Druckvorschau', 'Print Preview',
                'Austeilen', 'Assign',
                'Herunterladen als', 'Herunterladen als…', 'Download as', 'Download as…',
                'Download',
                'Bild', 'Image',
                'Hilfe', 'Help',
            ],
        }
    }, 
    components: { ExamHeader, WebviewPane, PdfviewPaneRendered  },  
    computed: {

    },
    async mounted() {
        this.currentFile = `${this.clientname}.ggb`
        this.entrytime = new Date().getTime()
         
        this._onUnhandledRejection = (event) => {
            const reason = event?.reason;
            const message = typeof reason === 'string' ? reason : reason && reason.message;
            if (message && message.includes('GUEST_VIEW_MANAGER_CALL')) {
                event.preventDefault(); // swallow guest webview noise from unrelated webviews
                return;
            }
        };
        this.autoEventListener(window,'unhandledrejection', this._onUnhandledRejection);


        signalBridge.on('save', (event, why) => {  //trigger document save by signal "save" sent from sendExamtoteacher in communication handler
            console.log("editor @ save: Teacher saverequest received")
            this.saveContent(false, why)
        });

        signalBridge.on('fileerror', (event, msg) => {
            console.log('geogebra @ fileerror: writing/deleting file error received');
            this.$swal.fire({
                title: "Error",
                text: msg.message,
                icon: "error",
                //timer: 30000,
                showCancelButton: false,
                didOpen: () => {
                    this.$swal.showLoading();
                },
            })
        });

        signalBridge.on('getmaterials', (event) => {  //trigger document save by signal "save" sent from sendExamtoteacher in communication handler
            console.log("geogebra @ getmaterials: get materials request received")
            this.getExamMaterials()
        });

        this._stopExammodeWatch = this.$watch('exammode', () => {
            this.injectCSS()
        })

        this.$nextTick(async function () { // Code that will run only after the entire view has been rendered


            // do not use setInterval() for intervals as it keeps all objects of the callbacks including fetch() responses in memory until the interval is stopped
            this.autoSchedulerService(this.fetchInfo, 5000);
            await this.fetchInfo(); // initial sync for clientinfo, serverstatus and lockedSection

            this.saveContentGgbAuto = () => this.saveContent(false, 'auto'); // detour so interval does not pass Scheduler event as first arg
            this.autoSchedulerService(this.saveContentGgbAuto, 20000);

            attachExamMouseleaveGuardBoolean(signalBridge, this.development, this.sendFocuslost);

            this.loadFilelist()
            this.getExamMaterials()

            // add some eventlisteners once
            this._onPreviewClick = () => {
                const preview = document.querySelector("#preview")
                if (!preview) {
                    return
                }
                preview.style.display = 'none'
                const wv = document.querySelector('#preview webview')
                if (wv && typeof wv.setAttribute === 'function') {
                    wv.setAttribute('src', 'about:blank')
                }
                URL.revokeObjectURL(this.currentpreview)
            }
            this.autoEventListener(document.querySelector("#preview"),"click", this._onPreviewClick);

            await this.$nextTick()
            try {
                await loadGgbDeployScript()
                await this.initGeoGebra('suite')
                await this.loadBackupGgbIfPresent()
            } catch (e) {
                console.error('geogebra @ mounted: GeoGebra bootstrap failed', e)
            }

            this.autoSchedulerService(this.loadFilelist, 10000)

            this.wlanInfo = await signalBridge.invoke('get-wlan-info')
            console.log(this.wlanInfo);
            this.hostip = await signalBridge.invoke('checkhostip')
        });
    },
    methods: {

        // from filehandler.js
        getExamMaterials:getExamMaterials,
        loadPDF:loadPDF,
        loadImage:loadImage,
        loadGGB:loadGGB,

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
            else if (file.filetype == 'ggb'){
                this.loadGGB(file,true)
                return
            }

        },


        isValidFullDomainName(str) {
            try {
                // Add https:// if no protocol is specified
                const urlString = str.includes('://') ? str : 'https://' + str;
                const url = new URL(urlString);
                
                // Check whether the protocol is correct
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    return false;
                }

                // Check whether host is present and valid
                if (!url.hostname || url.hostname.length < 1) {
                    return false;
                }

                // Check whether host contains at least one valid domain part
                const parts = url.hostname.split('.');
                if (parts.length < 2) {
                    return false;
                }

                // Check whether every domain part is valid
                const validPart = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
                return parts.every(part => 
                    part.length > 0 && 
                    part.length <= 63 && 
                    validPart.test(part)
                );

            } catch (e) {  return false;  }
        },

        
        async sendFocuslost(ctrlalt = false){
            if (await shouldSkipEdgeFocusLost(signalBridge, this.development)) return;
            let response = await signalBridge.invoke('focuslost', ctrlalt)  // refocus, go back to kiosk, inform teacher
            applyFocusLostFromIpc(this, response, this.development);
        },






        formatTime: formatFocusLostTime,


        async loadFilelist(){
            let filelist = await signalBridge.invoke('getfilesasync', null)
            this.localfiles = filelist;
        },

        ggbSurfaceSize() {
            const el = this.$refs.ggbSurface
            if (el && el.clientWidth > 0 && el.clientHeight > 0) {
                return { w: Math.floor(el.clientWidth), h: Math.floor(el.clientHeight) }
            }
            const tb = document.getElementById('toolbar')?.offsetHeight || 56
            return {
                w: Math.floor(window.innerWidth),
                h: Math.max(200, Math.floor(window.innerHeight - tb)),
            }
        },

        async initGeoGebra(appName = 'suite') {
            await loadGgbDeployScript()
            const container = document.getElementById('ggb-applet-host')
            if (!container) {
                return
            }
            if (window.ggbApplet) {
                try {
                    window.ggbApplet.remove()
                } catch (e) { /* ignore teardown errors */ }
            }
            container.innerHTML = ''
            this.ggbReady = false

            if (this._ggbResizeObs) {
                this._ggbResizeObs.disconnect()
                this._ggbResizeObs = null
            }
            if (this._resizeHandler) {
                window.removeEventListener('resize', this._resizeHandler)
                this._resizeHandler = null
            }

            const { w, h } = this.ggbSurfaceSize()
            const params = {
                "appName": appName,
                "language": "de",
              
                "width": w,
                "height": h,
                "showToolBar": true,
                "showAlgebraInput": true,
                "showMenuBar": true,
                "enableCAS": true,
       
                "enableFileFeatures": false,


                "isOffline": true,
                "disableAutoScale": true,
                "useBrowserForJS": false,
                "appletOnLoad": () => {
                    this.ggbReady = true
                    this.injectCSS()
                    const parseClientEvent = (event) => {
                        let e = event
                        if (typeof e === 'string') {
                            try {
                                e = JSON.parse(e)
                            } catch {
                                return null
                            }
                        }
                        if (e && typeof e === 'object' && !Array.isArray(e) && 'type' in e) {
                            return { type: e.type, target: e.target }
                        }
                        if (Array.isArray(e) && e.length >= 2) {
                            return { type: e[0], target: e[1] }
                        }
                        return null
                    }
                    this._ggbClipIgnoreSelectUntil = 0
                    window.ggbApplet.registerClientListener((event) => {
                        const ev = parseClientEvent(event)
                        if (!ev || !ev.type) {
                            return
                        }
                        if (ev.type === 'editorKeyTyped') {
                            this._ggbClipIgnoreSelectUntil = Date.now() + 550
                            return
                        }
                        if (ev.type !== 'select' || !ev.target) {
                            return
                        }
                        if (Date.now() < this._ggbClipIgnoreSelectUntil) {
                            return
                        }
                        const label = String(ev.target)
                        const pushVal = () => {
                            try {
                                const api = window.ggbApplet
                                const val = this.ggbClipboardValueFromObject(api, label)
                                if (val && !this.customClipboard.includes(val)) {
                                    this.customClipboard.push(val)
                                    if (this.customClipboard.length > 10) {
                                        this.customClipboard.shift()
                                    }
                                }
                            } catch (e) { /* ignore selection parse errors */ }
                        }
                        requestAnimationFrame(() => { requestAnimationFrame(pushVal) })
                    })
                    if (this._resizeHandler) {
                        window.removeEventListener('resize', this._resizeHandler)
                    }
                    let resizeTimer = null
                    this._resizeHandler = () => {
                        clearTimeout(resizeTimer)
                        resizeTimer = setTimeout(() => {
                            const s = this.ggbSurfaceSize()
                            window.ggbApplet?.setSize(s.w, s.h)
                        }, 150)
                    }
                  this.autoEventListener(window,'resize', this._resizeHandler)

                    const surface = this.$refs.ggbSurface
                    if (surface && typeof ResizeObserver !== 'undefined') {
                        this._ggbResizeObs = new ResizeObserver(() => {
                            const s = this.ggbSurfaceSize()
                            window.ggbApplet?.setSize(s.w, s.h)
                        })
                        this._ggbResizeObs.observe(surface)
                    }
                }
            }
            const applet = new GGBApplet(params, true)
            applet.setHTML5Codebase(ggbHtml5CodebaseUrl())
            applet.inject('ggb-applet-host')
        },

        injectCSS() {
            const restrictUi = !!this.exammode
            const cssText = restrictUi ? this.customCSS : ''
            const hideTexts = restrictUi ? this.hideMenuTexts : []

            let style = document.getElementById('__ggb_custom_css__')
            if (style) {
                style.remove()
            }
            if (restrictUi) {
                style = document.createElement('style')
                style.id = '__ggb_custom_css__'
                style.textContent = cssText
                document.head.appendChild(style)
            }

            if (window.__ggbMenuObserver__) {
                window.__ggbMenuObserver__.disconnect()
                window.__ggbMenuObserver__ = null
            }
            if (hideTexts.length > 0) {
                const hide = (menu) => menu.querySelectorAll('li.gwt-MenuItem').forEach(li => {
                    if (hideTexts.includes(li.textContent.trim())) {
                        li.style.setProperty('display', 'none', 'important')
                    }
                })
                window.__ggbMenuObserver__ = new MutationObserver(() => {
                    document.querySelectorAll('.gwt-MenuBar-vertical').forEach(hide)
                })
                window.__ggbMenuObserver__.observe(document.body, { childList: true, subtree: true })
                document.querySelectorAll('.gwt-MenuBar-vertical').forEach(hide)
            }
        },

        setsource(source) {
            this.initGeoGebra(source)
        }, 





        async fetchInfo() {
            const getinfo = await signalBridge.invoke('getinfoasync');
            const prevExammode = this.exammode;

            applyClientinfoFromFetch(this, getinfo.clientinfo);
            applyServerstatusFromFetch(this, getinfo.serverstatus);

            const sectionIndex = resolveLockedSection(this.serverstatus, this.clientinfo);
            if (sectionIndex !== this.lockedSection) this.lockedSection = sectionIndex;

            if (this.pincode !== '0000') this.localLockdown = false;

            if (this.exammode !== prevExammode) this.injectCSS();
            this.battery = await navigator.getBattery().then(battery => battery)
                .catch(error => { console.error('Error accessing the Battery API:', error); });

            this.internetCheckCounter++;
            if (this.internetCheckCounter % 5 === 0) {
                this.wlanInfo = await signalBridge.invoke('get-wlan-info');
                this.hostip = await signalBridge.invoke('checkhostip');
                this.internetCheckCounter = 0;
            }
        },

        showClipboard() {
            this.isClipboardVisible = !this.isClipboardVisible
        },

        ggbClipboardValueFromObject(api, label) {
            const t = String(api.getObjectType(label) ?? '').toLowerCase()
            if (['numeric', 'numericfree', 'angle'].includes(t)) {
                const v = api.getValue(label)
                if (Number.isFinite(v)) {
                    const r = Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v
                    return String(r)
                }
            }
            const raw = String(api.getValueString(label) ?? '').trim()
            const eq = raw.indexOf('=')
            if (eq >= 0) {
                return raw.slice(eq + 1).trim() || raw
            }
            return raw
        },

        ggbClipboardAppendToEditor(api, insertText) {
            if (typeof api.getEditorState !== 'function' || typeof api.setEditorState !== 'function') {
                return
            }
            const text = String(insertText ?? '')
            if (!text) {
                return
            }
            let state = api.getEditorState()
            if (typeof state === 'string') {
                try {
                    state = JSON.parse(state)
                } catch {
                    state = {}
                }
            }
            if (!state || typeof state !== 'object') {
                state = {}
            }
            const content = String(state.content ?? '')
            let insertStart = typeof state.caret === 'number' ? state.caret : content.length
            insertStart = Math.max(0, Math.min(insertStart, content.length))
            const insertEnd = insertStart
            const newContent = content.slice(0, insertStart) + text + content.slice(insertEnd)
            const newCaret = insertStart + text.length
            api.setEditorState({ ...state, content: newContent, caret: newCaret })
        },

        insertFromClipboard(value) {
            const text = String(value ?? '')
            if (!text || !window.ggbApplet) {
                return
            }
            this.ggbClipboardAppendToEditor(window.ggbApplet, text)
        },

        clearAll(){
            this.$swal({
                title: "",
                text: this.$t("math.clear") ,
                showCancelButton: true,
                inputAttributes: {
                    maxlength: 20,
                },
                confirmButtonText: 'Ok',
                cancelButtonText: this.$t("editor.cancel")
         
             })
            .then((result) => {
                if (result.isConfirmed) { 
                    window.ggbApplet?.reset()
                }
                else {return; }
            });
        },

         // Silent restore of clientname.ggb when present in examDir (e.g. after section switch).
        async loadBackupGgbIfPresent() {
            for (let i = 0; i < 50 && !this.ggbReady; i++) {
                await new Promise((r) => setTimeout(r, 100));
            }
            if (!this.ggbReady || !window.ggbApplet) return;
            const filename = `${this.clientname}.ggb`;
            const loadResult = await signalBridge.invoke('loadGGB', filename);
            if (loadResult?.status !== 'success' || !loadResult.content) return;
            window.ggbApplet.setBase64(loadResult.content);
            this.currentFile = filename;
        },

         /** Saves Content as GGB */
        async saveContent(event=false, reason=false) { 
            if (!window.ggbApplet) {
                console.log("geogebra @ saveContent: applet not present"); // one line comment
                return;
            }

            if (!this.ggbReady) {
                console.log("geogebra @ saveContent: applet not ready"); // one line comment
                return;
            }

            const getBase64FromApplet = async () => {
                try {
                    return await new Promise((resolve, reject) => {
                        window.ggbApplet.getBase64(resolve)
                        setTimeout(() => reject(new Error('timeout')), 10000)
                    })
                } catch (e) {
                    console.error('geogebra @ saveContent:', e)
                    return null
                }
            }

            let filename = this.currentFile
            if (reason == "manual" ){ 
                await this.$swal({
                    title: this.$t("math.filename") ,
                    input: 'text',
                    inputPlaceholder: 'Type here...',
                    showCancelButton: true,
                    inputAttributes: {
                        maxlength: 20,
                    },
                    confirmButtonText: 'Ok',
                    cancelButtonText: this.$t("editor.cancel"),
                    inputValidator: (value) => {
                        const v = typeof value === 'string' ? value.trim() : '';
                        const regex = /^[A-Za-z0-9]{1,20}$/;
                        if (!v.match(regex)) {
                            return  this.$t("math.nospecial") ;
                        }                   
                     },
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        const stem = String(result.value ?? '').trim();
                        filename = `${stem}-bak.ggb`;
                        this.currentFile = filename
                        const base64GgbFile = await getBase64FromApplet()
                        if (!base64GgbFile) {
                            console.log("geogebra @ saveContent: no base64 content returned"); // one line comment
                            return;
                        }
                        let response = await signalBridge.invoke('saveGGB', { filename: filename, content: base64GgbFile, reason: 'manual' });
                        if (response && response.status === "success" && reason == "manual" ){  // we wait for a response - only show feed back if manually saved
                            this.loadFilelist();
                            this.$swal.fire({
                                title: this.$t("editor.saved"),
                                text: filename,
                                icon: "info"
                            });
                        }
                    }
                    else {return; }
                });
            }
            else {
                const base64GgbFile = await getBase64FromApplet();
                if (!base64GgbFile) {
                    console.log("geogebra @ saveContent: no base64 content returned"); // one line comment
                } 
                else {
                    const saveReason = typeof reason === 'string' ? reason : 'auto';
                    let response = await signalBridge.invoke('saveGGB', { filename: filename, content: base64GgbFile, reason: saveReason });
                    if (response && response.status === "success" && reason == "manual" ){  // we wait for a response - only show feed back if manually saved
                        this.loadFilelist();
                        this.$swal.fire({
                            title: this.$t("editor.saved"),
                            text: filename,
                            icon: "info"
                        });
                    }
                }
            }
 
            this.loadFilelist()
 
        }
    },
 
    beforeUnmount() {
        if (typeof this._stopExammodeWatch === 'function') {
            this._stopExammodeWatch()
        }

        document.body.removeEventListener('mouseleave', this.sendFocuslost);

        if (this._ggbResizeObs) {
            this._ggbResizeObs.disconnect()
            this._ggbResizeObs = null
        }
        if (window.ggbApplet) {
            try {
                window.ggbApplet.remove()
            } catch (e) { /* ignore */ }
        }
        const rmStyle = document.getElementById('__ggb_custom_css__')
        if (rmStyle) {
            rmStyle.remove()
        }
        if (window.__ggbMenuObserver__) {
            window.__ggbMenuObserver__.disconnect()
            window.__ggbMenuObserver__ = null
        }

        signalBridge.removeAllListeners('getmaterials')
        signalBridge.removeAllListeners('fileerror')
        signalBridge.removeAllListeners('save')
        
        
        // Clean up preview click listener
        const preview = document.querySelector("#preview");
        if (preview && this._onPreviewClick) {
            preview.removeEventListener("click", this._onPreviewClick);
        }
    }
}

</script>

<style scoped>

.geogebra-page-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    min-height: 0;
    width: 100%;
}

.geogebra-main {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.ggb-canvas-wrap {
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
    width: 100%;
}

#ggb-applet-host {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.clipboard-slide-enter-active,
.clipboard-slide-leave-active {
    transition:
        transform 0.38s cubic-bezier(0.22, 1, 0.36, 1),
        opacity 0.32s ease,
        box-shadow 0.38s ease;
}

.clipboard-slide-enter-from,
.clipboard-slide-leave-to {
    transform: translateX(100%);
    opacity: 0;
    box-shadow: -4px 0 24px rgba(15, 23, 42, 0);
}

.customClipboard {
    position: fixed;
    top: 56px;
    right: 0;
    bottom: 0;
    z-index: 1000000;
    width: min(280px, 86vw);
    display: flex;
    flex-direction: column;
    padding: 0;
    margin: 0;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-left: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: -8px 0 32px rgba(15, 23, 42, 0.12);
    border-radius: 12px 0 0 0;
}

.customClipboard__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
    flex-shrink: 0;
}

.customClipboard__title {
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: rgba(15, 23, 42, 0.75);
    text-transform: uppercase;
}

.customClipboard__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.06);
    color: rgba(15, 23, 42, 0.55);
    font-size: 1.35rem;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}

.customClipboard__close:hover {
    background: rgba(15, 23, 42, 0.1);
    color: rgba(15, 23, 42, 0.85);
}

.customClipboard__list {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.customClipboard__empty {
    margin: 24px 8px 0;
    font-size: 0.875rem;
    color: rgba(15, 23, 42, 0.45);
    text-align: center;
}

.customClipboard__item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    text-align: left;
    padding: 10px 12px;
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.65);
    color: rgba(15, 23, 42, 0.88);
    font-size: 0.8125rem;
    line-height: 1.35;
    cursor: pointer;
    transition:
        background 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease;
}

.customClipboard__item:hover {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(13, 110, 253, 0.25);
    box-shadow: 0 2px 12px rgba(13, 110, 253, 0.08);
}

.customClipboard__item-icon {
    flex-shrink: 0;
    margin-top: 2px;
    opacity: 0.65;
}

.customClipboard__item-text {
    word-break: break-word;
    min-width: 0;
}

#suiteAppPicker {
    visibility: visible !important;
}

@media print{
    .customClipboard {
        display: none !important;
    }
    #apphead {
        display: none !important;
    }
    .geogebra-main {
        display: block !important;
    }
    #ggb-applet-host {
        height: 100vh !important;
        width: 100vw !important;
        border-radius:0px !important;
        position: relative !important;
        inset: auto !important;
    }
    #q-app {
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
}

</style>
