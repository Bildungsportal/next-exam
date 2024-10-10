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
    <div id="toolbar" class="d-inline p-1">  
        <button title="backup" @click="saveContent(null, 'manual'); " class="btn d-inline btn-success p-0 pe-2 ps-1 ms-1 mb-1 btn-sm"><img src="/src/assets/img/svg/document-save.svg" class="white" width="20" height="20" ></button>
        <button title="delete" @click="clearAll(); " class=" btn  d-inline btn-danger p-0 pe-2 ps-1 ms-2 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-delete.svg" class="white" width="20" height="20" ></button>
        <button title="paste" @click="showClipboard(); " class="btn  d-inline btn-secondary p-0 pe-2 ps-1 ms-2 mb-1 btn-sm"><img src="/src/assets/img/svg/edit-paste-style.svg" class="white" width="20" height="20" ></button>
        <div class="btn-group  ms-2 me-1 mb-1 " role="group">
            <div class="btn btn-outline-info btn-sm p-0 pe-2 ps-1  mb-0" @click="setsource('suite')"> <img src="/src/assets/img/svg/formula.svg" class="" width="20" height="20" >suite</div>
            <div class="btn btn-outline-info btn-sm p-0 pe-2 ps-1  mb-0" @click="setsource('classic')"> <img src="/src/assets/img/svg/formula.svg" class="" width="20" height="20" >classic</div>
        </div>
        
        <div v-for="file in localfiles" class="d-inline">
            <div v-if="(file.type == 'pdf')"   class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-1 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/document-replace.svg" class="" width="20" height="20" > {{file.name}} </div>
            <div v-if="(file.type == 'ggb')"   class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-1 btn-sm" @click="selectedFile=file.name; loadGGB(file.name)"><img src="/src/assets/img/svg/document-replace.svg" class="" width="20" height="20" > {{file.name}} </div>
            <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-1 btn-sm" @click="loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
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

    <div id="content">
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
        <iframe id="geogebraframe" src="./geogebra/classic.html"></iframe>
    </div>


    <div v-if="isClipboardVisible" class="customClipboard">
      <button class="btn btn-sm btn-outline-success m-1" style="display: block; width:132px" v-for="(item, index) in customClipboard" :key="index" @click="insertFromClipboar(item)">
        <img src="/src/assets/img/svg/edit-paste-style.svg" class="white" width="16" height="16" >{{ item }}
      </button>
    </div>


</template>

<script>

import moment from 'moment-timezone';
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js'


export default {
    data() {
        return {
            componentName: 'GeoGebra',
            online: true,
            focus: true,
            exammode: false,
            currentFile:null,
            saveinterval: null,
            fetchinfointerval: null,
            loadfilelistinterval: null,
            clockinterval: null,
            servername: this.$route.params.servername,
            servertoken: this.$route.params.servertoken,
            serverip: this.$route.params.serverip,
            token: this.$route.params.token,
            clientname: this.$route.params.clientname,
            serverApiPort: this.$route.params.serverApiPort,
            serverstatus: this.$route.params.serverstatus,
            clientApiPort: this.$route.params.clientApiPort,
            config: this.$route.params.config,
            electron: this.$route.params.electron,
            pincode : this.$route.params.pincode,
            localLockdown: this.$route.params.localLockdown,
            clientinfo: null,
            entrytime: 0,
            timesinceentry: 0,
            currenttime : 0,
            now : new Date().getTime(),
            localfiles: null,
            battery: null,
            customClipboard: [],
            isClipboardVisible: false,
            currentpreview: null
        }
    }, 
    components: { ExamHeader  },  
    mounted() {

        this.redefineConsole()  // overwrite console log to grep specific outputs and store as clipboard entry

        this.currentFile = this.clientname
        this.entrytime = new Date().getTime()  
         
        if (this.electron){
        
            this.saveEvent = ipcRenderer.on('save', (event, why) => {  //trigger document save by signal "save" sent from sendExamtoteacher in communication handler
                console.log("editor @ save: Teacher saverequest received")
                this.saveContent(true, why) 
            }); 


            ipcRenderer.on('fileerror', (event, msg) => {
                console.log('geogebra @ fileerror: writing/deleting file error received');
                this.$swal.fire({
                        title: "Error",
                        text: msg.message,
                        icon: "error",
                        //timer: 30000,
                        showCancelButton: false,
                        didOpen: () => { this.$swal.showLoading(); },
                })
            });
        }
        this.$nextTick(function () { // Code that will run only after the entire view has been rendered
           
            // intervalle nicht mit setInterval() da dies sämtliche objekte der callbacks inklusive fetch() antworten im speicher behält bis das interval gestoppt wird
            this.fetchinfointerval = new SchedulerService(5000);
            this.fetchinfointerval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.fetchinfointerval.start();

            this.clockinterval = new SchedulerService(1000);
            this.clockinterval.addEventListener('action', this.clock);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.clockinterval.start();          

            this.saveinterval = new SchedulerService(20000);
            this.saveinterval.addEventListener('action', this.saveContent );  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
            this.saveinterval.start();
            
            document.body.addEventListener('mouseleave', this.sendFocuslost);

            this.loadFilelist()


            // add some eventlisteners once
            document.querySelector("#preview").addEventListener("click", function() {  
                this.style.display = 'none';
                this.setAttribute("src", "about:blank");
                URL.revokeObjectURL(this.currentpreview);
            });
        })
    },
    methods: { 
        redefineConsole(){
            const ggbIframe = document.getElementById('geogebraframe');
            const iframeWindow = ggbIframe.contentWindow;  // Zugriff auf den Kontext des iframe
            const originalIframeConsoleLog = iframeWindow.console.log;  // Speichern der originalen console.log Funktion des iframe

            iframeWindow.console.log = (message) => {
                // Prüfen, ob die Nachricht ein GeoGebra-spezifisches Muster enthält
                if (typeof message === "string" && message.includes("existing")) {
                    const partAfterExistingGeo = message.split("existing geo:")[1].trim();
                    const extractedText = partAfterExistingGeo.split("=")[1].trim();
                    this.customClipboard.push( extractedText )
                    if (this.customClipboard.length > 10) {    this.customClipboard.shift();     }   //customclipboard länge begrenzen
                } 
                else {
                    // geogebra spammed jede aktion in die console daher unterdrücken wir das erstmal
                    //originalIframeConsoleLog.apply(iframeWindow.console, arguments);      // Aufrufen der ursprünglichen Funktion für alle anderen Nachrichten
                }
            };
        },
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


        // disable lock but keep examwindow
        gracefullyexit(){
            this.$swal.fire({
                title: this.$t("editor.exit"),
                text:  this.$t("editor.exitkiosk"),
                icon: "question",
                showCancelButton: true,
                cancelButtonText: this.$t("editor.cancel"),
                reverseButtons: true,

                html: this.localLockdown ? `
                    <div class="m-2 mt-4"> 
                        <div class="input-group m-1 mb-1"> 
                            <span class="input-group-text col-3" style="width:140px;">Passwort</span>
                            <input class="form-control" type="text" id="localpassword" placeholder='Passwort'>
                        </div>
                    </div>
                ` : '',
            })
            .then((result) => {
                if (result.isConfirmed) {
                    if (this.localLockdown){
                        let password = document.getElementById('localpassword').value; 
                        if (password == this.serverstatus.password){ ipcRenderer.send('gracefullyexit')  }
                    }
                    else {
                        ipcRenderer.send('gracefullyexit')
                    }  
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
        setsource(source){
            let iFrame = document.getElementById('geogebraframe')
            if (source === "suite")   { iFrame.src = `./geogebra/suite.html`  }
            if (source === "classic") { iFrame.src = `./geogebra/classic.html`}
            iFrame.parentNode.replaceChild(iFrame.cloneNode(), iFrame);
            this.redefineConsole()
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
            
            if (this.pincode !== "0000"){this.localLockdown = false}

            if (!this.focus){  this.entrytime = new Date().getTime()}
            if (this.clientinfo && this.clientinfo.token){  this.online = true  }
            else { this.online = false  }

         
            this.battery = await navigator.getBattery().then(battery => { return battery })
            .catch(error => { console.error("Error accessing the Battery API:", error);  });


        }, 
        showClipboard() {
            this.isClipboardVisible = this.isClipboardVisible ? false: true;
        },
        insertFromClipboar(value){
            const ggbIframe = document.getElementById('geogebraframe');
            const ggbApplet = ggbIframe.contentWindow.ggbApplet;   // get the geogebra applet and all of its methods
            
            ggbApplet.evalCommand(value);
        },

        clearAll(){
            const ggbIframe = document.getElementById('geogebraframe');
            const ggbApplet = ggbIframe.contentWindow.ggbApplet;   // get the geogebra applet and all of its methods
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
                    ggbApplet.reset()
                }
                else {return; }
            });
        },

         /** Saves Content as GGB */
        async saveContent(event=false, reason=false) { 
            const ggbIframe = document.getElementById('geogebraframe');
            const ggbApplet = ggbIframe.contentWindow.ggbApplet;   // get the geogebra applet and all of its methods
            let filename = `${this.clientname}.ggb`
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
                        const regex = /^[A-Za-z0-9]+$/;
                        if (!value.match(regex)) {
                            return  this.$t("math.nospecial") ;
                        }                   
                     },
                 }).then((result) => {
                    if (result.isConfirmed) { 
                        filename = `${result.value}-bak.ggb`
                        ggbApplet.getBase64( async (base64GgbFile) => {
                            let response = await ipcRenderer.invoke('saveGGB', {filename: filename, content: base64GgbFile})   // send base64 string to backend for saving
                            if (response.status === "success" && reason == "manual" ){  // we wait for a response - only show feed back if manually saved
                                this.loadFilelist()
                                this.$swal.fire({
                                    title: this.$t("editor.saved"),
                                    text: filename,
                                    icon: "info"
                                })
                            }
                        })
                    }
                    else {return; }
                });
            }
            else {
                ggbApplet.getBase64( async (base64GgbFile) => {
                    let response = await ipcRenderer.invoke('saveGGB', {filename: filename, content: base64GgbFile, reason: reason })   // send base64 string to backend for saving
                    if (response.status === "success" && reason == "manual" ){  // we wait for a response - only show feed back if manually saved
                        this.loadFilelist()
                        this.$swal.fire({
                            title: this.$t("editor.saved"),
                            text: filename,
                            icon: "info"
                        })
                    }
                })
            }
 
            this.loadFilelist()

        },



        // get file from local examdirectory and replace editor content with it
        async loadGGB(file){
            this.$swal.fire({
                title: this.$t("editor.replace"),
                html:  `${this.$t("editor.replacecontent1")} <b>${file}</b> ${this.$t("editor.replacecontent2")}`,
                icon: "question",
                showCancelButton: true,
                cancelButtonText: this.$t("editor.cancel"),
                reverseButtons: true
            })
            .then(async (result) => {
                if (result.isConfirmed) {

                    const result = await ipcRenderer.invoke('loadGGB', file);
                    if (result.status === "success") {
                        const base64GgbFile = result.content;
                        const ggbIframe = document.getElementById('geogebraframe');
                        const ggbApplet = ggbIframe.contentWindow.ggbApplet;
                        ggbApplet.setBase64(base64GgbFile);
                    } else {
                        console.error('Error loading file');
                    }
                } 
            }); 
        },
    },
    beforeUnmount() {
        this.saveinterval.removeEventListener('action', this.saveContent);
        this.saveinterval.stop() 

        this.fetchinfointerval.removeEventListener('action', this.fetchInfo);
        this.fetchinfointerval.stop() 

        this.clockinterval.removeEventListener('action', this.clock);
        this.clockinterval.stop() 
        
        document.body.removeEventListener('mouseleave', this.sendFocuslost);

        this.saveEvent = null
    },
}

</script>

<style scoped>

.customClipboard {
    z-index: 1000000;
    width: 160px;
    height: 380px;
    position: absolute;
    top: 100px;
    left: 50%;
    margin-left: -100px;
    background-color: rgb(33,37,41);
    border-radius: 5px;
    padding: 10px;
    box-shadow: 0 0 15px rgba(0,0,0,0.8);

}


#suiteAppPicker {
    visibility: visible !important;
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
