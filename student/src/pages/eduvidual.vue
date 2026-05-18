 <template> 

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
    <div id="toolbar" class="d-inline p-1 pt-0">  
        <!-- reload webview button -->
        <button class="btn btn-primary p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="reloadWebview" :title="$t('website.reloadwebview')"> <img src="/src/assets/img/svg/edit-redo.svg" class="" width="22" height="20" >{{moodleDomain}}</button>

        <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
        <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm" @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ $t('editor.materials') }}</div>

        <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
            <div v-if="(file.filetype == 'htm')" class="btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm"   @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{file.filename}}</div>
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


       
    <div v-if="isLoading" class="overlay">
        <div class="spinner"></div>
        <p>Loading...</p>
    </div>

    <webview id="webviewmain" autosize="on" :src="url" :style="{ visibility: isLoading ? 'hidden' : 'visible' }"></webview>


</template>


<script>
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js'
import {isElectronWindow} from "../types/platform.js";
import { gracefullyExit, reconnect, showUrl } from '../utils/commonMethods.js'
import {SignalBridge} from '../utils/signalBridge.js'
import { attachExamMouseleaveGuard, shouldSkipEdgeFocusLost } from '../utils/linuxCageKiosk.js'
import {
    applyClientinfoFromFetch,
    applyServerstatusFromFetch,
    resolveLockedSection,
} from '../utils/examFetchInfoSync.js'

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);

import { getExamMaterials, loadPDF, loadImage, resetPdfPreviewToolbar} from '../utils/filehandler.js'
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue'
import WebviewPane from '../components/WebviewPane.vue';

export default {
    data() {
        return {
            componentName: 'Moodle Test',
        
            online: true,
            focus: true,
            exammode: false,
            examtype: this.$route.params.examtype,
            currentFile:null,
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
            pincode : this.$route.params.pincode,
            serverstatus: this.$route.params.serverstatus,
            // section and moodle config will be resolved on first fetchInfo based on allowSectionSwitch
            activeSection: null,
            lockedSection: null,
            url: null,
            moodleDomain: null,
            moodleTestType: null,
            moodleTestId: null,

            config: this.$route.params.config,
            localLockdown: this.$route.params.localLockdown,
            clientinfo: null,
            entrytime: 0,
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
            
            // Event listener references for cleanup
            _onDidFinishLoad: null,
            _onDidStartLoading: null,
            _onDidStopLoading: null,
            _onPreviewClick: null,
            internetCheckCounter:0,
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
        }
    }, 
    components: { ExamHeader, PdfviewPaneRendered, WebviewPane },  
    mounted() {
        signalBridge.on('getmaterials', (event) => {
            console.log("eduvidual @ getmaterials: get materials request received")
            this.getExamMaterials()
        });
 
        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()  
         
        // console.log(this.serverstatus.lockedSection)
        // console.log(this.serverstatus.examSections[this.serverstatus.lockedSection].moodleURL)
        // console.log(this.serverstatus.examSections[this.serverstatus.lockedSection].moodleDomain)
        // console.log(this.serverstatus.examSections[this.serverstatus.lockedSection].moodleTestId)

        this.$nextTick(async () => { // Code that will run only after the entire view has been rendered
                  

            // do not use setInterval() for intervals as it keeps all objects of the callbacks including fetch() responses in memory until the interval is stopped
            this.fetchinfointerval = new SchedulerService(5000);
            this.fetchinfointerval.addEventListener('action',  this.fetchInfo);  // event listener that reacts to the 'action' event (only reacts to 'action' from this instance and does not interfere)
            this.fetchinfointerval.start();
            await this.fetchInfo(); // initial sync for clientinfo, serverstatus and moodle url

            try {
                this.wlanInfo = await signalBridge.invoke('get-wlan-info')
                this.hostip = await signalBridge.invoke('checkhostip')
                this.internetCheckCounter = 0
            } catch (err) {
                console.error('eduvidual @ mounted: initial wlan/host ip error', err)
            }
                
            this.loadfilelistinterval = new SchedulerService(20000);
            this.loadfilelistinterval.addEventListener('action',  this.loadFilelist);
            this.loadfilelistinterval.start();
            attachExamMouseleaveGuard(signalBridge, this.config, this.sendFocuslost);


            this.loadFilelist()
            this.getExamMaterials()

            // add some eventlisteners once
            this._onPreviewClick = function() {  
                this.style.display = 'none';
                this.setAttribute("src", "about:blank");
                URL.revokeObjectURL(this.currentpreview);
            };
            document.querySelector("#preview").addEventListener("click", this._onPreviewClick);


            // fetches shadow root of webview and sets height to 100% 
            const webview = document.getElementById('webviewmain');
            if (webview) { 
                const shadowRoot = webview.shadowRoot;
                const iframe = shadowRoot.querySelector('iframe');
                if (iframe) { iframe.style.height = '100%'; } 
                
                // Setup blocking in backend via IPC - this ensures events are caught early
                const setupBackendBlocking = async () => {
                    if (webview.getWebContentsId) {
                        const guestId = webview.getWebContentsId();
                        if (guestId) {
                            try {
                                if(isElectronWindow(window)) {
                                    await signalBridge.invoke('start-blocking-for-website-webview', {
                                        guestId,
                                        mode: 'eduvidual',
                                        moodleTestId: this.moodleTestId,
                                        moodleDomain: this.moodleDomain
                                    });
                                    console.log(`eduvidual @ mounted: backend blocking setup for webview ${guestId}`);
                                }
                            } catch (error) {
                                console.error('eduvidual @ mounted: failed to setup backend blocking', error);
                            }
                        }
                    }
                };
                
                // Try to setup blocking immediately, retry on dom-ready if needed
                setupBackendBlocking().catch(() => {
                    const retrySetup = () => {
                        setTimeout(() => {
                            setupBackendBlocking().catch(() => {
                                console.warn('eduvidual @ mounted: backend blocking setup failed, will retry');
                            });
                        }, 100);
                    };
                    webview.addEventListener('dom-ready', retrySetup, { once: true });
                });
                
                console.log('eduvidual @ mounted: backend blocking setup initiated');
                
                this._onDidFinishLoad = () => {
                    if (this.config.showdevtools) {webview.openDevTools();  }
                    const preloadScriptContent = `
                        (function() {
                            const css = \`
                            * {transition: .1s !important;}
                            .branding { display: none !important; }
                            #header { display: none !important; }
                            .drawer-left-toggle { display: none !important; }
                            .drawer.drawer-right { top:0 !important; height: 100% !important;}
                            #page-footer { display: none !important; }
                            #theme_boost-drawers-courseindex { display: none !important; }
                            #page.drawers {margin-top:0px !important;}
                            #page-wrapper {padding-top:0px !important;}
                            .navbar, #nav-drawer, #page-header {display: none !important;}
                            body {margin-left: 0px !important;}
                            #page {height: 100% !important}
                            #page.drawers.show-drawer-left  {margin-left: 0px !important; padding-left: 3rem !important; }
                            .bycs-header {display: none !important;}
                            .mbsfooter {display: none !important;}
                            #footnote {display: none !important;}
                            \`;

                            const style = document.createElement('style');
                            style.type = 'text/css';
                            style.innerHTML = css;
                            document.head.appendChild(style);
                        })();
                    `;
                    webview.executeJavaScript(preloadScriptContent)
                    .then(() => {     this.isLoading = false;  })  // Verberge das Overlay und zeige den Webview-Inhalt
                    .catch((err) => { this.isLoading = false;  })
                };
                webview.addEventListener('did-finish-load', this._onDidFinishLoad);
                
                this._onDidStartLoading = () => { this.isLoading = true;   }; // show the overlay while loading
                this._onDidStopLoading = () => {   this.isLoading = false;  };           // hide the overlay when loading stops
                webview.addEventListener('did-start-loading', this._onDidStartLoading);
                webview.addEventListener('did-stop-loading', this._onDidStopLoading);
            }
            this.wlanInfo = await signalBridge.invoke('get-wlan-info')
            this.hostip = await signalBridge.invoke('checkhostip')
            
        });
    },
    methods: { 

        // from filehandler.js
        getExamMaterials:getExamMaterials,
        loadPDF:loadPDF,
        loadImage:loadImage,

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

        reloadWebview(){
            const webview = document.getElementById('webviewmain');
            webview.setAttribute("src", this.url);
        },

        formatTime(unixTime) {
            const date = new Date(unixTime * 1000); // Convert Unix time to milliseconds
            return date.toLocaleTimeString('en-US', { hour12: false }); // Adjust locale and options as needed
        },
        async sendFocuslost(){
            if (await shouldSkipEdgeFocusLost(signalBridge, this.config.development)) return;
            if (isElectronWindow(window)) {
                let response = await signalBridge.invoke('focuslost')  // refocus, go back to kiosk, inform teacher
                if (!this.config.development && !response.focus) {  //immediately block frontend
                    this.focus = false
                }
            }
        },

        async loadFilelist(){
            if(isElectronWindow(window)) {
                let filelist = await signalBridge.invoke('getfilesasync', null)
                this.localfiles = filelist;
            }
        },  
        // Apply moodle/eduvidual examConfig for locked section; returns true if main webview URL changed.
        applyEduvidualConfigFromSection(sectionIndex) {
            const section = this.serverstatus?.examSections?.[sectionIndex];
            const groupKey = section?.groups && this.clientinfo?.group === 'b' ? 'groupB' : 'groupA';
            const eduConfig = section?.[groupKey]?.examConfig?.eduvidual || null;
            if (!eduConfig) return false;
            const nextUrl = eduConfig.url || null;
            const nextDomain = eduConfig.moodleDomain || null;
            const nextTestId = eduConfig.moodleTestId || null;
            const urlChanged = nextUrl !== this.url;
            if (urlChanged) this.url = nextUrl;
            if (nextDomain !== this.moodleDomain) this.moodleDomain = nextDomain;
            this.moodleTestType = null;
            if (nextTestId !== this.moodleTestId) this.moodleTestId = nextTestId;
            return urlChanged;
        },

        async fetchInfo() {
            const getinfo = await signalBridge.invoke('getinfoasync');

            applyClientinfoFromFetch(this, getinfo.clientinfo);
            if (getinfo.serverstatus) {
                applyServerstatusFromFetch(this, getinfo.serverstatus);
            }

            const sectionIndex = resolveLockedSection(this.serverstatus, this.clientinfo);
            const sectionChanged = sectionIndex !== this.lockedSection;
            if (sectionChanged) this.lockedSection = sectionIndex;

            const urlChanged = this.applyEduvidualConfigFromSection(sectionIndex);
            if (urlChanged) {
                const webview = document.getElementById('webviewmain');
                if (webview && this.url) webview.setAttribute('src', this.url);
            }

            if (!this.focus) this.entrytime = new Date().getTime();

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
        this.fetchinfointerval.removeEventListener('action', this.fetchInfo);
        this.fetchinfointerval.stop() 
        this.loadfilelistinterval.removeEventListener('action', this.loadFilelist);
        this.loadfilelistinterval.stop() 

        document.body.removeEventListener('mouseleave', this.sendFocuslost);
        
        // Clean up webview event listeners (blocking is handled in backend, but we still clean up local listeners)
        const webview = document.getElementById('webviewmain');
        if (webview) {
            if (this._onDidFinishLoad) {
                webview.removeEventListener('did-finish-load', this._onDidFinishLoad);
            }
            if (this._onDidStartLoading) {
                webview.removeEventListener('did-start-loading', this._onDidStartLoading);
            }
            if (this._onDidStopLoading) {
                webview.removeEventListener('did-stop-loading', this._onDidStopLoading);
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
    top: var(--nx-preview-top-offset, var(--nx-apphead-h, 60px));
    left: 0;
    width:100vw;
    height: calc(100vh - var(--nx-preview-top-offset, var(--nx-apphead-h, 60px)));
    background-color: rgba(0, 0, 0, 0.4);
    z-index:100001;
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



</style>
