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
      :currenttime="currenttime"
      :timesinceentry="timesinceentry"
      :componentName="componentName"
      :localLockdown="localLockdown"
      @reconnect="reconnect"
      @gracefullyexit="gracefullyexit"
    ></exam-header>
     <!-- HEADER END -->


    <!-- filelist start - show local files from workfolder (pdf and gbb only)-->
    <div id="toolbar" class="d-inline p-1 pt-0">  
        <div v-for="file in localfiles" class="d-inline">
            <div v-if="(file.type == 'pdf')" class="btn btn-secondary  p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/document-replace.svg" class="" width="22" height="20" > {{file.name}} </div>
            <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
        </div>
    </div>
    <!-- filelist end -->
    

    <!-- angabe/pdf preview start -->
    <div id="preview" class="fadeinfast p-4">
        <div class="embed-container">
            <embed src="" id="pdfembed"></embed>
        </div>
    </div>
    <!-- angabe/pdf preview end -->


    <!-- focus warning start -->
    <div v-if="!focus" class="focus-container">
        <div id="focuswarning" class="infodiv p-4 d-block focuswarning" >
            <div class="mb-3 row">
                <div class="mb-3 "> {{$t('editor.leftkiosk')}} <br> {{$t('editor.tellsomeone')}} </div>
                <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32" >
            </div>
        </div>
    </div>
    <!-- focuswarning end  -->


       
    <div v-if="isLoading" class="overlay">
        <div class="spinner"></div>
        <p>Loading...</p>
    </div>

    <webview id="webview" autosize="on" :src="url" :style="{ visibility: isLoading ? 'hidden' : 'visible' }"></webview>


</template>


<script>
import moment from 'moment-timezone';
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js'


export default {
    data() {
        return {
            componentName: 'Moodle Test',
       
            online: true,
            focus: true,
            exammode: false,
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
            clientinfo: null,
            entrytime: 0,
            timesinceentry: 0,
            currenttime: 0,
            now : new Date().getTime(),
            localfiles: null,
            battery: null,
            url: null,
            currentpreview: null,
            isLoading: true
        }
    }, 
    components: { ExamHeader },  
    mounted() {
      
        this.url = this.serverstatus.moodleURL

        // if (this.serverstatus.moodleDomain === "eduvidual.at"){
        //     this.url =`https://eduvidual.at/mod/${this.serverstatus.moodleTestType}/view.php?id=${this.serverstatus.moodleTestId}`    // https://www.eduvidual.at/mod/quiz/view.php?id=4172287   
        // }
        // else {
        //     this.url =`https://${this.serverstatus.moodleDomain}/mod/${this.serverstatus.moodleTestType}/view.php?id=${this.serverstatus.moodleTestId}`    // https://www.eduvidual.at/mod/quiz/view.php?id=4172287  
        // }

        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()  
         
        this.$nextTick(() => { // Code that will run only after the entire view has been rendered
            
            // intervalle nicht mit setInterval() da dies sämtliche objekte der callbacks inklusive fetch() antworten im speicher behält bis das interval gestoppt wird
            this.fetchinfointerval = new SchedulerService(5000);
            this.fetchinfointerval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.fetchinfointerval.start();
                
            this.loadfilelistinterval = new SchedulerService(20000);
            this.loadfilelistinterval.addEventListener('action',  this.loadFilelist);
            this.loadfilelistinterval.start();
            
            this.clockinterval = new SchedulerService(1000);
            this.clockinterval.addEventListener('action', this.clock);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.clockinterval.start();
                
            document.body.addEventListener('mouseleave', this.sendFocuslost);
            
            
            this.loadFilelist()
     
            const webview = document.getElementById('webview');
            const shadowRoot = webview.shadowRoot;
            const iframe = shadowRoot.querySelector('iframe');
            if (iframe) { iframe.style.height = '100%'; } 

         

            // add some eventlisteners once
            document.querySelector("#preview").addEventListener("click", function() {  
                this.style.display = 'none';
                this.setAttribute("src", "about:blank");
                URL.revokeObjectURL(this.currentpreview);
            });

 

            webview.addEventListener('did-finish-load', () => {

                if (config.showdevtools) {webview.openDevTools();  }

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
            });
            
            
            webview.addEventListener('did-start-loading', () => { this.isLoading = true;   }); // Zeige das Overlay während des Ladens
            webview.addEventListener('did-stop-loading', () => {   this.isLoading = false;  });           // Verberge das Overlay, wenn das Laden gestoppt ist
            
            
            // Event abfangen, wenn eine Navigation beginnt
            webview.addEventListener('will-navigate', (event) => {
                console.log(event.url)
                if (!event.url.includes(this.serverstatus.moodleTestId)){  //we block everything whithout testID except pages that contain the following keyword-combinations
                    console.log(event.url)
                    //check if this an exception (login, init) - if URL doesn't include either of these combinations - block! EXPLICIT is easier to read ;-)
                    if ( event.url.includes("startattempt.php") && event.url.includes(this.serverstatus.moodleDomain) )        { console.log(" url allowed") }  // moodledomain ohne testid
                    else if ( event.url.includes("processattempt.php") && event.url.includes(this.serverstatus.moodleDomain) ) { console.log(" url allowed") }  // moodledomain ohne testid
                    else if ( event.url.includes("login") && event.url.includes("Microsoft") )                                 { console.log(" url allowed") }  // microsoft365 login
                    else if ( event.url.includes("mysignins") && event.url.includes("microsoft") )                             { console.log(" url allowed") }  // 2fa activation
                    else if ( event.url.includes("account") && event.url.includes("windowsazure") )                            { console.log(" url allowed") }  // microsoft braucht mehr contact information (telnr)
                    else if ( event.url.includes("login") && event.url.includes("Google") )                                    { console.log(" url allowed") }
                    else if ( event.url.includes("login") && event.url.includes("microsoftonline") )                           { console.log(" url allowed") }  // microsoft365 login
                    else if ( event.url.includes("accounts") && event.url.includes("google.com") )                             { console.log(" url allowed") }
                    else if ( event.url.includes("logout") && event.url.includes(this.serverstatus.moodleDomain) )             { console.log(" url allowed") }
                    else if ( event.url.includes("lookup") && event.url.includes("google") )                                   { console.log(" url allowed") }
                    else if ( event.url.includes("login") && event.url.includes("eduvidual") )                                 { console.log(" url allowed") }
                    else if ( event.url.includes("login") && event.url.includes(this.serverstatus.moodleDomain) )              { console.log(" url allowed") }
                    else if ( event.url.includes("policy") && event.url.includes(this.serverstatus.moodleDomain) )              { console.log(" url allowed") }

                    else {
                        console.log("blocked leaving exam mode")
                        webview.stop()
                    }
                }
                else { console.log("entered valid test environment")  }
            });
        });
    },
    methods: { 
        reconnect(){
            this.$swal.fire({
                title: this.$t("editor.reconnect"),
                text:  this.$t("editor.info"),
                icon: 'info',
                input: 'number',
                inputLabel: "PIN",
                inputValue: this.pincode,
                inputValidator: (value) => {
                    if (!value) {return this.$t("student.nopin")}
                }
            }).then((input) => {
                this.pincode = input.value
                if (!input.value) {return}
                let IPCresponse = ipcRenderer.sendSync('register', {clientname:this.clientname, servername:this.servername, serverip: this.serverip, pin:this.pincode })
                console.log(IPCresponse)
                this.token = IPCresponse.token  // set token (used to determine server connection status)

                if (IPCresponse.status === "success") {
                        this.$swal.fire({
                            title: "OK",
                            text: this.$t("student.registeredinfo"),
                            icon: 'success',
                            showCancelButton: false,
                        })
                    }
                if (IPCresponse.status === "error") {
                    this.$swal.fire({
                        title: "Error",
                        text: IPCresponse.message,
                        icon: 'error',
                        showCancelButton: false,
                    })
                }
            })
        },
        gracefullyexit(){
            this.$swal.fire({
                title: this.$t("editor.exit"),
                text:  this.$t("editor.exitkiosk"),
                icon: "question",
                showCancelButton: true,
                cancelButtonText: this.$t("editor.cancel"),
                reverseButtons: true
            })
            .then((result) => {
                if (result.isConfirmed) {
                    ipcRenderer.send('gracefullyexit')
                } 
            }); 
        },

        sendFocuslost(){
            let response = ipcRenderer.send('focuslost')  // refocus, go back to kiosk, inform teacher
            if (!this.config.development && !response.focus){  //immediately block frontend
                this.focus = false 
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


         // fetch file from disc - show preview
         async loadPDF(file){
            URL.revokeObjectURL(this.currentpreview);
            let data = await ipcRenderer.invoke('getpdfasync', file )
        
            let isvalid = this.isValidPdf(data)
            if (!isvalid){
                this.$swal.fire({
                    title: this.$t("general.error"),
                    text: this.$t("general.nopdf"),
                    icon: "error",
                    timer: 3000,
                    showCancelButton: false,
                    didOpen: () => { this.$swal.showLoading(); },
                })
                return
            }

            this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "application/pdf"})) 

            const pdfEmbed = document.querySelector("#pdfembed");
            pdfEmbed.style.backgroundImage = '';
            pdfEmbed.style.height = "95vh";
            pdfEmbed.style.width = "67vh";
            pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0`);

            document.querySelector("#preview").style.display = 'block';
        },

        // fetch file from disc - show preview
        async loadImage(file){
            URL.revokeObjectURL(this.currentpreview);
            let data = await ipcRenderer.invoke('getpdfasync', file )
            this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "image/jpeg"})) 
            const pdfEmbed = document.querySelector("#pdfembed");
            
            // Create an image element to determine the dimensions of the image
            // always resize the pdfembed div to the same aspect ratio of the given image
            const img = new window.Image();
            img.onload = function() {
                const width = img.width;
                const height = img.height;
                const aspectRatio = width / height;

                const containerWidth = window.innerWidth * 0.8;
                const containerHeight = window.innerHeight * 0.8;
                const containerAspectRatio = containerWidth / containerHeight;

                if (aspectRatio > containerAspectRatio) {
                    pdfEmbed.style.width = '80vw';
                    pdfEmbed.style.height = `calc(80vw / ${aspectRatio})`;
                } else {
                    pdfEmbed.style.height = '80vh';
                    pdfEmbed.style.width = `calc(80vh * ${aspectRatio})`;
                }
                pdfEmbed.style.backgroundImage = `url(${this.currentpreview})`;

            }.bind(this);
            img.src = this.currentpreview;

            // clear the pdf viewer
            pdfEmbed.setAttribute("src", "about:blank");
            document.querySelector("#preview").style.display = 'block';    

        },





        async loadFilelist(){
            let filelist = await ipcRenderer.invoke('getfilesasync', null)
            this.localfiles = filelist;
        },
        clock(){
            this.now = new Date().getTime()
            this.timesinceentry =  new Date(this.now - this.entrytime).toISOString().substr(11, 8)
            this.currenttime = moment().tz('Europe/Vienna').format('HH:mm:ss');
        },  
        async fetchInfo() {
            let getinfo = await ipcRenderer.invoke('getinfoasync')   // we need to fetch the updated version of the systemconfig from express api (server.js)
            
            this.clientinfo = getinfo.clientinfo;
            this.token = this.clientinfo.token
            this.focus = this.clientinfo.focus
            this.clientname = this.clientinfo.name
            this.exammode = this.clientinfo.exammode
            this.pincode = this.clientinfo.pin

            if (!this.focus){  this.entrytime = new Date().getTime()}
            if (this.clientinfo && this.clientinfo.token){  this.online = true  }
            else { this.online = false  }

            this.battery = await navigator.getBattery().then(battery => { return battery })
            .catch(error => { console.error("Error accessing the Battery API:", error);  });
        }, 
       
    },
    beforeUnmount() {
        this.fetchinfointerval.removeEventListener('action', this.fetchInfo);
        this.fetchinfointerval.stop() 

        this.clockinterval.removeEventListener('action', this.clock);
        this.clockinterval.stop() 

        this.loadfilelistinterval.removeEventListener('action', this.loadFilelist);
        this.loadfilelistinterval.stop() 

        document.body.removeEventListener('mouseleave', this.sendFocuslost);
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

#webview{
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
  transform: translate(-50%, -50%);
  display: flex;
  align-items: flex-start;
}

</style>
