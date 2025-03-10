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
      :wlanInfo="wlanInfo"
      @reconnect="reconnect"
      @gracefullyexit="gracefullyexit"
    ></exam-header>
     <!-- HEADER END -->


    <!-- filelist start - show local files from workfolder (pdf and gbb only)-->
    <div id="toolbar" class="d-inline p-1 pt-0">  
   

        <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0  pe-2 ps-1 me-1 mb-0 btn-sm" @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img src="/src/assets/img/svg/games-solve.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{ $t('editor.materials') }}</div>

        <!-- exam materials start - these are base64 encoded files fetched on examstart or section start-->
        <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
            <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
            <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{file.filename}} </div>
        </div>
        <!-- exam materials end -->


        <div class="text-muted me-2 ms-2 small d-inline-block" style="vertical-align: middle;">{{ $t('editor.localfiles') }} </div>
        <div v-for="file in localfiles" :key="file.name" class="d-inline" style="text-align:left">
            <div v-if="(file.type == 'pdf')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
            <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.name; loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{file.name}} </div>
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
                    <div class="mt-3"> {{ formatTime(entrytime) }}</div>
                </div>
            </div>
        </div>
        <!-- focuswarning end  -->


        <!-- RDP Viewer start -->
        <div style="height: calc(100vh - 50px);">
            <button class="btn btn-danger" @click="reconnectRDP">Connect</button>
            <div ref="container" tabindex="0" @mousemove="handleMouseMove" @click="handleClick" @keydown="handleKeyDown" style="width: 100%; height: calc(100% - 40px); overflow: hidden;">
                <canvas ref="canvas" :width="rdpWidth" :height="rdpHeight" style="width: 100%; height: 100%; object-fit: contain;"></canvas>
                <div v-if="error" style="position: absolute; top: 100px; left: 50%; transform: translateX(-50%); color: #b02a37; z-index: 100000; text-align: center;">
                    {{ error }} <br>
                    <button class="btn btn-danger" @click="reconnectRDP">Reconnect</button>
                </div>
            </div>
        </div>
        <!-- RDP Viewer end -->

    </div>
</template>

<script>
import moment from 'moment-timezone';
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js'

import { getExamMaterials, loadPDF, loadImage, loadGGB} from '../utils/filehandler.js'

export default {
    data() {
        return {
            componentName: 'RDP View',
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
            wlanInfo: null,
            examMaterials: [],
            rdpWidth: 1280,
            rdpHeight: 720,
            error: null,
            canvas: null,
            ctx: null,
            rdpConfig: this.$route.params.serverstatus.examSections[this.$route.params.serverstatus.activeSection].rdpConfig

        }
    }, 
    components: { ExamHeader },  
    mounted() {
       
        this.$nextTick(() => { // Code that will run only after the entire view has been rendered
            console.log("RdpViewer.vue @ mounted: rdpConfig", this.rdpConfig)

            // Initialize canvas and context right after mounting
            this.canvas = this.$refs.canvas;
            this.ctx = this.canvas.getContext('2d', {
                alpha: false,
                desynchronized: true
            });

            this.entrytime = new Date().getTime()  
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
     
            // add some eventlisteners once
            document.querySelector("#preview").addEventListener("click", function() {  
                this.style.display = 'none';
                this.setAttribute("src", "about:blank");
                URL.revokeObjectURL(this.currentpreview);
            });


            // Empfang von Bitmap-Frames
            ipcRenderer.on('rdp-bitmap', (event, bitmap) => {
                try {
                    // Log incoming bitmap data for debugging
                    console.log('Received bitmap:', {
                        width: bitmap.width,
                        height: bitmap.height,
                        x: bitmap.x,
                        y: bitmap.y,
                        dataLength: bitmap.data.length
                    });

                    // Validate bitmap dimensions
                    if (!bitmap.width || !bitmap.height || bitmap.width <= 0 || bitmap.height <= 0) {
                        console.error('Invalid bitmap dimensions:', bitmap.width, bitmap.height);
                        return;
                    }

                    // Create a properly sized RGBA array
                    const pixels = new Uint8ClampedArray(bitmap.width * bitmap.height * 4);
                    
                    // Convert the incoming data to RGBA format
                    // Assuming the input is RGB (3 bytes per pixel)
                    for (let i = 0; i < bitmap.data.length; i += 3) {
                        const outputIndex = (i / 3) * 4;
                        pixels[outputIndex] = bitmap.data[i];       // R
                        pixels[outputIndex + 1] = bitmap.data[i + 1]; // G
                        pixels[outputIndex + 2] = bitmap.data[i + 2]; // B
                        pixels[outputIndex + 3] = 255;                // A (fully opaque)
                    }

                    // Create image data with proper dimensions
                    const imageData = new ImageData(pixels, bitmap.width, bitmap.height);

                    // Clear the area before drawing new bitmap
                    this.ctx.clearRect(bitmap.x, bitmap.y, bitmap.width, bitmap.height);
                    
                    // Draw the image data at the specified position
                    this.ctx.putImageData(imageData, bitmap.x || 0, bitmap.y || 0);

                } catch (error) {
                    console.error('Error in rdp-bitmap handler:', error);
                    console.error('Bitmap data:', {
                        width: bitmap.width,
                        height: bitmap.height,
                        x: bitmap.x,
                        y: bitmap.y,
                        dataLength: bitmap?.data?.length
                    });
                }
            });

            // Empfang von Fehlern
            ipcRenderer.on('rdp-error', (event, error) => {
                this.error = error;
            });


        });
    },
    methods: { 
        getExamMaterials:getExamMaterials,
        loadPDF:loadPDF,
        loadImage:loadImage,

        loadBase64file(file){
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


        async reconnectRDP(){
            console.log("RdpViewer.vue @ reconnect: reconnecting RDP connection")
            this.error = null;
            this.canvas = this.$refs.canvas;
            this.ctx = this.canvas.getContext('2d', {
                alpha: false,
                desynchronized: true
            });
            this.$refs.container.focus();

            // Set RDP resolution to a standard desktop resolution
            this.rdpWidth = 1920;
            this.rdpHeight = 1080;

            const cleanConfig = {
                domain: this.rdpConfig.domain,
                userName: this.rdpConfig.userName,
                password: this.rdpConfig.password,
                ip: this.rdpConfig.ip,
                port: this.rdpConfig.port,
                width: this.rdpWidth,
                height: this.rdpHeight
            }   

            try {
                await ipcRenderer.invoke("start-rdp", cleanConfig);
            } catch (e) {
                this.error = e;
            }
        },

        // handle mouse move
        handleMouseMove(event) {
            const rect = this.canvas.getBoundingClientRect();
            
            // Calculate relative coordinates
            let x = event.clientX - rect.left;
            let y = event.clientY - rect.top;
            
            // Scale coordinates to 0-65535 range
            x = Math.floor((x / rect.width) * 65535);
            y = Math.floor((y / rect.height) * 65535);
            
            // Clamp values to ensure they're within valid range
            x = Math.max(0, Math.min(65535, x));
            y = Math.max(0, Math.min(65535, y));
            
            ipcRenderer.send('rdp-input', { type: 'mouse', x, y, button: 0 });
        },

        // handle click
        handleClick(event) {
            return

            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const button = event.button === 2 ? 2 : 1;
            ipcRenderer.send('rdp-input', { type: 'mouse', x, y, button });
            },

        // handle key down
        handleKeyDown(event) {
            return
            
            ipcRenderer.send('rdp-input', { type: 'keyboard', keyCode: event.keyCode, event: true });
            setTimeout(() => {
                ipcRenderer.send('rdp-input', { type: 'keyboard', keyCode: event.keyCode, event: false });
            }, 50);
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
        async loadFilelist(){
            let filelist = await ipcRenderer.invoke('getfilesasync', null)
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
            
            this.wlanInfo = await ipcRenderer.invoke('get-wlan-info')

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
#webview{
    height: 100% !important;
    width: 100% !important;
    display: block;
    position: relative;
    top:0;
    left:0;
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
    z-index:100000;
}

#pdfembed { 
    position: absolute;
    top: 50%;
    left: 50%;
    margin-left: -30vw;
    margin-top: -45vh;
    width:60vw;
    height: 90vh;
    padding: 10px;
    background-color: rgba(255, 255, 255, 1);
    border: 0px solid rgba(255, 255, 255, 0.589);
    box-shadow: 0 0 15px rgba(22, 9, 9, 0.589);
    padding: 10px;
    border-radius: 6px;
}

</style>
