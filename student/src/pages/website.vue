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
    <div id="toolbar" class="d-inline p-1 pt-0"> 
        <button class="btn btn-primary p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="reloadWebview" :title="$t('website.reloadwebview')"> <img src="/src/assets/img/svg/edit-redo.svg" class="" width="22" height="20" >{{domain}}</button>


        <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
        <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm" @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ $t('editor.materials') }}</div>

        <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
            <div v-if="(file.filetype == 'bak')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}}</div>
            <div v-if="(file.filetype == 'docx')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}}</div>
            <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
            <div v-if="(file.filetype == 'audio')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="loadBase64file(file)"><img src="/src/assets/img/svg/im-google-talk.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
            <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
        </div>
        <div v-if="allowedUrls.length !== 0"  v-for="allowedUrl in allowedUrls  " class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button" :title="getUrlDisplay(allowedUrl)" @click="showUrl(getUrlDisplay(allowedUrl))">
            <img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{getUrlDisplay(allowedUrl)}}
        </div>
        <!-- exam materials end -->

        <!-- local files start -->
        <div class="white text-muted me-2 ms-2 small d-inline-block mb-0" style="vertical-align: middle;">{{ $t('editor.localfiles') }} </div>
        <div v-for="file in localfiles" class="d-inline mb-0">
            <div v-if="(file.type == 'pdf')"   class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/document-replace.svg" class="" width="20" height="20" > {{file.name}} </div>
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




    <div id="content">
        <!-- focus warning start -->
        <div v-if="!focus" class="focus-container">
            <div id="focuswarning" class="infodiv p-4 d-block focuswarning" >
                <div class="mb-3 row">
                    <div class="mb-3 "> {{$t('editor.leftkiosk')}} <br> {{$t('editor.tellsomeone')}} </div>
                    <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32" >
                    <div class="mt-3"> {{ formatTime(entrytime) }}</div>
                </div>
                <div v-if="localLockdown" class="mt-2">
                    <div class="input-group">
                        <span class="input-group-text">Passwort</span>
                        <input
                            ref="localUnlockInput"
                            v-model="localUnlockPassword"
                            class="form-control"
                            type="password"
                            autocomplete="current-password"
                            placeholder="Passwort"
                            @input="localUnlockError = false"
                            @keyup.enter="tryUnlockLocalLockdown"
                        >
                        <button class="btn btn-outline-dark" type="button" :disabled="localUnlockBusy" @click="tryUnlockLocalLockdown">
                            Freischalten
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
import moment from 'moment-timezone';
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js'
import { gracefullyExit, reconnect, showUrl } from '../utils/commonMethods.js'
import { getExamMaterials, loadPDF, loadImage, resetPdfPreviewToolbar} from '../utils/filehandler.js'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'
import WebviewPane from '../components/WebviewPane.vue';
import {SignalBridge} from '../utils/signalBridge.js'

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);


export default {
    data() {
        return {
            componentName: 'Website',
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
            config: this.$route.params.config,
            localLockdown: this.$route.params.localLockdown,
            localUnlockPassword: '',
            localUnlockError: false,
            localUnlockBusy: false,

            // section and url will be resolved on first fetchInfo based on allowSectionSwitch
            lockedSection: null,
            serverstatus: this.$route.params.serverstatus,
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
            blockSubdomains: false, // Block subdomains setting from teacher
            blockSubfolders: false, // Block subfolders setting from teacher

            // Event listener references for cleanup
            _onDidStartLoading: null,
            _onDidStopLoading: null,
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
       
        async sendFocuslost(){
            let response = await signalBridge.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
            if (!this.config.development && !response.focus){  //immediately block frontend
                this.focus = false 
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
        async loadFilelist(){
            let filelist = await signalBridge.invoke('getfilesasync', null)
            this.localfiles = filelist;
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

            // update url/domain based on current locked section (respect allowSectionSwitch)
            const section = this.serverstatus?.examSections?.[sectionIndex]
            if (section && typeof section.domainname === 'string') {
                this.url = section.domainname
                this.domain = section.domainname
                this.blockSubdomains = !!section.blockSubdomains
                this.blockSubfolders = !!section.blockSubfolders
                try {
                    const urlObj = new URL(this.url);
                    this.allowedDomain = urlObj.hostname;
                } catch (error) {
                    if (typeof this.url === 'string') {
                        this.allowedDomain = this.url.replace(/https?:\/\//, '').split('/')[0].split(':')[0];
                    } else {
                        this.allowedDomain = null;
                    }
                }
            }

            if (!this.focus){  this.entrytime = new Date().getTime() }
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
    },
    mounted() {
        
        console.log(`website @ mounted: ${this.url}`)

        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()  
    
        this.$nextTick(async () => { // Code that will run only after the entire view has been rendered
            
            // intervalle nicht mit setInterval() da dies sämtliche objekte der callbacks inklusive fetch() antworten im speicher behält bis das interval gestoppt wird
            this.fetchinfointerval = new SchedulerService(5000);
            this.fetchinfointerval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.fetchinfointerval.start();
            await this.fetchInfo(); // initial sync for clientinfo, serverstatus and url
                
            this.loadfilelistinterval = new SchedulerService(20000);
            this.loadfilelistinterval.addEventListener('action',  this.loadFilelist);
            this.loadfilelistinterval.start();
            
            this.clockinterval = new SchedulerService(1000);
            this.clockinterval.addEventListener('action', this.clock);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.clockinterval.start();
                
            document.body.addEventListener('mouseleave', this.sendFocuslost);
            
            signalBridge.on('getmaterials', (event) => {  //trigger document save by signal "save" sent from sendExamtoteacher in communication handler
                console.log("website @ getmaterials: get materials request received")
                this.getExamMaterials() 
            });


            this.loadFilelist()
            this.getExamMaterials()

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
            document.querySelector("#preview").addEventListener("click", this._onPreviewClick);


            this._onDomReady = () => {
                if (config.showdevtools){ webview.openDevTools();   }
                const css = ``;
                webview.executeJavaScript(`
                    (() => {  // Anonyme Funktion für eigenen Scope sonst wird beim reload der page (absenden der form ) die variable erneut deklariert und failed
                        const style = document.createElement('style');
                        style.type = 'text/css';
                        style.innerHTML = \`${css}\`;
                        document.head.appendChild(style);
                    })();  
                `);
            };
            webview.addEventListener('dom-ready', this._onDomReady);
              
            // loading events to hide css manipulation
            this._onDidStopLoading = () => {   this.isLoading = false;  };           // Verberge das Overlay, wenn das Laden gestoppt ist
            webview.addEventListener('did-stop-loading', this._onDidStopLoading);

            this.wlanInfo = await signalBridge.invoke('get-wlan-info')
            this.hostip = await signalBridge.invoke('checkhostip')

            
        });
    },
    beforeUnmount() {
        this.fetchinfointerval.removeEventListener('action', this.fetchInfo);
        this.fetchinfointerval.stop() 

        this.clockinterval.removeEventListener('action', this.clock);
        this.clockinterval.stop() 

        this.loadfilelistinterval.removeEventListener('action', this.loadFilelist);
        this.loadfilelistinterval.stop() 

        document.body.removeEventListener('mouseleave', this.sendFocuslost);
        
        // Clean up webview by removing it from DOM to prevent crashes
        const webview = document.getElementById('webviewmain');
        if (webview) {
            // Remove webview element listeners (blocking is handled in backend, but we still clean up local listeners)
            if (this._onDidStartLoading) {
                webview.removeEventListener('did-start-loading', this._onDidStartLoading);
            }
            if (this._onDidStopLoading) {
                webview.removeEventListener('did-stop-loading', this._onDidStopLoading);
            }
            if (this._onDomReady) {
                webview.removeEventListener('dom-ready', this._onDomReady);
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
    top:0;
    left: 0;
    width:100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index:100001;
    backdrop-filter: blur(2px);
  
}


</style>
