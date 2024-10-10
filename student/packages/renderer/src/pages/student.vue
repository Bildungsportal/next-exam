<template>


<div  id="apphead" class="w-100 p-3 text-white bg-dark shadow text-right ">
    <img src='/src/assets/img/svg/speedometer.svg' class="white me-2  " width="32" height="32" >
    <span class="fs-4 align-middle me-4 ">Next-Exam</span>
    <span class="fs-4 align-middle  ms-3" style="float: right">Student</span>
    
    <div v-if="token && !localLockdown" id="adv" class="btn btn-success btn-sm m-0  mt-1 " style="cursor: unset; float: right">{{ $t("student.connected") }}</div>
    <button v-if="clientinfo.groups && clientinfo.group == 'a' && token && !localLockdown" type="button" class="btn btn-info btn-sm  m-1 mt-1" style="cursor: unset; width: 32px; float: right"> A  </button>
    <button v-if="clientinfo.groups && clientinfo.group == 'b' && token && !localLockdown" type="button" class="btn btn-warning btn-sm m-1 mt-1" style="cursor: unset; width: 32px; float: right"> B  </button>
                     
    <div v-if="!hostip" id="adv" class="btn btn-danger btn-sm m-0  mt-1 " style="cursor: unset; float: right">{{ $t("student.offline") }}</div>
    <div v-if="networkerror" id="adv" class="btn btn-danger btn-sm m-0  mt-1 " style="cursor: unset; float: right">{{ $t("student.noapi") }}</div>
</div>
 

<div id="wrapper" class="w-100 h-100 d-flex" >

    <!-- SIDEBAR -->
    <div class="p-3 text-white bg-dark h-100" style="width: 240px; min-width: 240px;">
        <div class="btn btn-light m-0 text-start infobutton">
            <img src='/src/assets/img/svg/server.svg' class="me-2"  width="16" height="16" > {{$t('student.exams')}} 
        </div><br>
        <div v-if="!advanced" id="adv"  class="btn btn-sm btn-outline-secondary mt-2" @click="toggleAdvanced();"> {{ $t("student.advanced") }}</div>
        <div v-if="advanced" id="adv"  class="btn btn-sm btn-outline-secondary mt-2" @click="toggleAdvanced();"> {{ $t("student.simple") }}</div>
        

        <div v-if="advanced" @click="setupLocalLockdown()" class="form-check form-switch  m-1 mt-4"  :class="(token)? 'disabledexam':''" style="font-size:0.9em">
            <!-- Checkbox mit dem Label "BiP Login" -->
            <input class="form-check-input" type="checkbox" id="localLockdown" v-model="localLockdown"> 
            <label class="form-check-label" for="localLockdown"> Lokal absperren</label>
        </div>

        <div v-if="config.bipIntegration && advanced" @click="clearUser()" class="form-check form-switch  m-1 mb-2 mt-2" :class="(token)? 'disabledexam':''"  style="font-size:0.9em">
            <!-- Checkbox mit dem Label "BiP Login" -->
            <input class="form-check-input" type="checkbox" id="bipLogin" v-model="biplogin"> 
            <label class="form-check-label" for="bipLogin"> BiP Login</label>
        </div>

        
        <div  id="biploginbutton" v-if="biplogin" @click="loginBiP()" class="btn btn-info mb-1 me-0" style="padding:0;">
            <img v-if="biplogin" style="width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
             <span id="biploginbuttonlabel">Bildungsportal - Login</span>
        </div> 
        


        <div class="m-2">
            <br><div id="statusdiv" class="btn btn-warning m-1"></div>
        </div>
        <br>

        <span @click="showCopyleft()" style="position: absolute; bottom:2px; left: 6px; font-size:0.8em;cursor: pointer;">
            <span style=" display:inline-block; transform: scaleX(-1);font-size:1.2em; ">&copy; </span> 
            <span style="vertical-align: text-bottom;">&nbsp;{{version}} {{ info }}</span>
        </span>

    </div>

    <!-- CONTENT -->
    <div id="content" class="fadeinfast p-3">



        <div class="col-8 mb-2" :class="(token)? 'disabledtext':''">
            <div v-if="!biplogin" class="input-group  mb-1">
                <span class="input-group-text col-3" style="width:135px;" id="inputGroup-sizing-lg">{{ $t("student.name") }}</span>
                <input v-model="username" type="text" required="required" maxlength="25" class="form-control" id="user" placeholder="" style="width:200px;max-width:200px;min-width:135px;">
            </div> 

            <div v-if="biplogin" class="input-group  mb-1">
                <span class="input-group-text col-3" style="width:135px;" id="inputGroup-sizing-lg">{{ $t("student.name") }}</span>
               
                <span v-if="username" class="input-group-text col-3" style="width:200px;" id="inputGroup-sizing-lg"> {{ username  }} </span>
                <span v-else class="input-group-text col-3 " style="width:200px;" id="inputGroup-sizing-lg">  </span>
               
            </div> 
      
            <div class="input-group  mb-1"> 
                <span class="input-group-text col-3" style="width:135px;" id="inputGroup-sizing-lg">{{ $t("student.pin") }}</span>
                <input  v-model="pincode" type="number" min="0" oninput="validity.valid||(value='')" class="form-control" id="pin" placeholder="" style="width:135px;max-width:135px;min-width:135px;">
            </div>
            <div v-if="advanced || servertimeout > 2 " class="input-group  mb-1"> 
                <span class="input-group-text col-3" style="width:135px;" id="inputGroup-sizing-lg">{{ $t("student.ip") }}</span>
                <input  v-model="serverip" class="form-control" id="serverip" placeholder="" style="width:135px;max-width:135px;min-width:135px;">
            </div>
        </div>
  
  
       
   
        <h4 class="mt-4">{{ $t("student.exams") }}</h4>
        <div id="list" class="" style="overflow-y:auto; height: 369px; display:flex; flex-wrap: wrap; flex-direction: row;">
            <div v-for="server in serverlist" class="row p-3 m-0 mb-2 border bg-light" style="border-radius: 4px; margin-right: 10px !important; min-height:100px; max-height:100px;  min-width:234px; max-width: 234px;">
                <strong style="padding:0px;">{{server.servername}}
                <img v-if="!server.reachable" src="/src/assets/img/svg/emblem-warning.svg" :title="$t('student.unreachable')"  style="width:20px;float:right;vertical-align:top;cursor: help;" ></strong>  
                <input v-if="!token" :id="server.servername" type="button" name="register" class="btn btn-sm btn-info" :value="$t('student.register')" @click="registerClient(server.serverip,server.servername)"/>
                <input v-if="token && clientinfo.servername !== server.servername" :id="server.servername" disabled type="button" name="register" class="btn btn-secondary" :value="$t('student.register')" />
                <input v-if="token && clientinfo.servername === server.servername" :id="server.servername" disabled type="button" name="register" class="btn btn-success" :value="$t('student.registered')" />
            </div>
            <div v-if="serverlist.length === 0"><h5>0</h5> </div>
        </div>
    </div>
</div>


</template>


<script>
import validator from 'validator'
import log from 'electron-log/renderer'
import {SchedulerService} from '../utils/schedulerservice.js'


// Erfassen von unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  log.error('Unhandled promise rejection:', event.reason); // Loggen des Fehlers
});

Object.assign(console, log.functions);  //alle console logs durch logger ersetzen


export default {
    data() {
        return {
            version: this.$route.params.version,
            info: config.info,
            token: "",
            username: config.development ? "Thomas":"",
            pincode: config.development ? "1337":"",
            clientinfo: {},
            serverlist: [],
            serverlistAdvanced: [],
            fetchinterval: null,
            serverApiPort: this.$route.params.serverApiPort,
            clientApiPort: this.$route.params.clientApiPort,
            electron: this.$route.params.electron,
            config: this.$route.params.config,
            startExamEvent: null,
            advanced: false,
            serverip: "",
            servername: "",
            hostip: config.hostip,
            networkerror: false,
            localLockdown: false,
            biplogin: false,
            biptest:false,
            bipToken:false,
            bipuserID: false,
            servertimeout: false
        };
    },
    methods: {

        setupLocalLockdown(){
            this.$swal({
                title: 'Lokale Prüfung' ,
               
                html:`
                    Prüfungsmodus wählen <br> <br>
                    <div style="text-align: left; width: 150px; margin: auto auto;">
                            <input class="form-check-input" name=etesttype type="radio" id="editor" value="editor" checked>
                            <label class="form-check-label" for="editor"> Sprachen </label>
                            <br>
                            <input class="form-check-input"  name=etesttype type="radio" id="math" value="math">
                            <label class="form-check-label" for="math"> Mathematik </label>
                    </div>

                    <div class=" m-2 mt-4"> 

                        <div class="input-group  m-1 mb-1"> 
                            <span class="input-group-text col-3" style="width:140px;">Benutzername</span>
                            <input class="form-control" type=text id=localuser placehoder='Benutzername'>
                        </div>

                        <div class="input-group m-1 mb-1"> 
                            <span class="input-group-text col-3" style="width:140px;">Passwort</span>
                            <input class="form-control" type=text id=localpassword placehoder='Passwort'>
                        </div>
                    </div>
                                
                `,
                showCancelButton: true,
                confirmButtonText: 'Ok',
                cancelButtonText: this.$t("editor.cancel"),
            
                focusConfirm: false,
                icon: 'info',
                didOpen:() => {
                    document.getElementById("localuser").addEventListener("keypress", function(e) {
                         // var lettersOnly = /^[a-zA-Z ]+$/;
                        var lettersOnly = /^[a-zA-ZäöüÄÖÜß ]+$/;  //give some special chars for german a chance
                        var key = e.key || String.fromCharCode(e.which);
                        if (!lettersOnly.test(key)) { e.preventDefault(); }
                    });


                },

            }).then((result) => {
                if (result.isConfirmed) { 

                    const radioButtons = document.querySelectorAll('input[name="etesttype"]');
                    let exammode = '';
                    radioButtons.forEach((radio) => {
                        if (radio.checked) {
                            exammode = radio.value;
                        }
                    });

                    let username = document.getElementById('localuser').value; 
                    username = username.replace(/^\s+|\s+$/g, '');  //check username - remove leading and trailing spaces
                    let password = document.getElementById('localpassword').value; 

                    if (username == "" || password == ""){
                        this.localLockdown = false
                        return; 
                    }

                    this.localLockdown = true
                    ipcRenderer.send('locallockdown', {password:result.value, exammode: exammode, clientname: username, password: password })
                }
                else {
                    this.localLockdown = false
                    return; 
                }
            });

        },


        loginBiP(){
            let IPCresponse = ipcRenderer.sendSync('loginBiP', this.biptest)
            console.log(IPCresponse)
        },
        clearUser(){
            this.username = ""
        },  

        // Überprüfen, ob der String Base64-codiert ist
        isBase64(str) {
            try {
                return btoa(atob(str)) === str;
            } catch (err) {
                return false;
            }
        },

        // Base64-String dekodieren und mögliche Tokens extrahieren
        decodeBase64AndExtractTokens(base64Str) {
            if (!this.isBase64(base64Str)) {
                return null;
            }
            const decodedStr = atob(base64Str);
            const tokens = decodedStr.split(/[:\s,]+/); // Trennzeichen anpassen, falls nötig
            return tokens;
        },








        async fetchInfo() {
        
            let getinfo = await ipcRenderer.invoke('getinfoasync')  // gets serverlist and clientinfo from multicastclient
            this.clientinfo = getinfo.clientinfo;

            this.token = this.clientinfo.token;
            if (this.token && this.token != "0000" || !this.token) { this.localLockdown = false}  //other token than 0000 or no token.. no (local) exam mode

            if ( (this.advanced || this.servertimeout > 2 ) && !this.token) {
                if (validator.isIP(this.serverip) || validator.isFQDN(this.serverip)){
                   
                    //give some userfeedback here
                    if (this.serverlistAdvanced.length == 0){ this.status("Suche Prüfungen...")  }
                
                    fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/serverlist`)
                    .then(response => response.json()) // Parse JSON response
                    .then(data => {
                        if (data && data.status === "success") {
                            this.serverlistAdvanced = data.serverlist;
                            //if (this.serverlistAdvanced.length > 0){ this.status("Prüfung gefunden...") }
                            this.networkerror = false;
                        }
                    })
                    .catch(err => {
                        log.error(`student.vue @ fetchInfo (advanced): ${err.message}`);
                        this.networkerror = true;
                    });
                }
            }
            else {
                this.networkerror = false;
            }

            if (getinfo.serverlist.length  !== 0 ) {
                this.serverlist = getinfo.serverlist; 
                this.servertimeout = 0 // reset servertimeout (if more than 2 requests return without servers we display serveraddress field - probably multicast blocked)
                if (this.serverlistAdvanced.length !== 0){  // add servers coming from direct ip polling
                    this.serverlist = [...this.serverlist, ...this.serverlistAdvanced];
            
                    this.serverlist = this.serverlist.reduce((unique, server) => {
                        if (!unique.some(u => u.serverip === server.serverip && u.servername === server.servername)) {  // Prüfen, ob der Server bereits im Array basierend auf serverip und servername existiert
                            unique.push(server); // Fügt den Server hinzu, wenn er nicht existiert
                        }
                        return unique;
                    }, []);
                } 
            }
            else {  // sometimes explicit is easier to read (no servers incoming via multicast)
                if (this.serverlistAdvanced.length !== 0){ this.serverlist = this.serverlistAdvanced }  // one server coming via direct ip polling
                else { this.serverlist = []; this.servertimeout++ }  // no servers found
            }

            // check im networkconnection is still alive - otherwise exit here
            this.hostip = ipcRenderer.sendSync('checkhostip')
            if (!this.hostip) return;  
            for (let server of this.serverlist){      
                const signal = AbortSignal.timeout(2000); // 2000 Millisekunden = 2 Sekunden
                fetch(`https://${server.serverip}:${this.serverApiPort}/server/control/pong`, { method: 'GET', signal })
                .then(response => {
                    if (!response.ok) throw new Error('Response not OK');
                    server.reachable = true; // Markieren als erreichbar, wenn erfolgreich
                })
                .catch(err => {
                    if (err.name === 'AbortError') {   console.log('student.vue @ fetchinfo (ping): Fetch request was aborted due to timeout'); } 
                    else {  console.log("student @ fetchinfo:", err.message);  }
                    server.reachable = false; // Markieren als nicht erreichbar bei Fehlern
                });
            }
        },  
        
        toggleAdvanced(){
            if (this.advanced) {this.advanced = false} else {this.advanced = true}
            this.serverip = ""
        },
        

        //show status message
        async status(text){  
            const statusDiv = document.querySelector("#statusdiv");
            statusDiv.textContent = text;
            statusDiv.style.visibility = "visible";
            this.fadeIn(statusDiv);
            await this.sleep(2000);
            this.fadeOut(statusDiv)
        },



         // implementing a sleep (wait) function
         sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },


        /** register client on the server **/
        registerClient(serverip, servername){
           if (this.username === ""){
               this.$swal.fire({
                    title: "Error",
                    text: this.$t("student.nouser"),
                    icon: 'error',
                    showCancelButton: false,
                })
            }
            else if(this.pincode ===""){
                this.$swal.fire({
                    title: "Error",
                    text: this.$t("student.nopin"),
                    icon: 'error',
                    showCancelButton: false,
                })
            }
            else {
                //check username - remove leading and trailing spaces
                this.username = this.username.replace(/^\s+|\s+$/g, '');

                let IPCresponse = ipcRenderer.sendSync('register', {clientname:this.username, servername:servername, serverip, serverip, pin:this.pincode, bipuserID:this.bipuserID })
                console.log(`student @ registerClient: ${IPCresponse.message}`)
                if (IPCresponse && IPCresponse.token){
                    this.token = IPCresponse.token  // set token (used to determine server connection status)
                }

                if (IPCresponse.status === "success") {
                        this.$swal.fire({
                            title: "OK",
                            text: this.$t("student.registeredinfo"),
                            icon: 'success',
                            timer: 3000,
                            showCancelButton: false,
                            didOpen: () => { this.$swal.showLoading(); },
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
            }
        },
        showCopyleft(){
            this.$swal.fire({
                title: "<span id='cpleft' class='active' style='display:inline-block; transform: scaleX(-1); vertical-align: middle; cursor: pointer;'>&copy;</span> <span style='font-size:0.8em'>Thomas Michael Weissel </span>",
                icon: 'info',
                html: `
                <a href="https://linux-bildung.at" target="_blank"><img style="width: 50px; opacity:0.7;" src="./osos.svg"></a> <br>
                <span style="font-size:0.8em"> <a href="https://next-exam.at/#kontakt" target="_blank">next-exam.at</a> </span><br><br>
                <span style="font-size:0.8em">Version: ${this.version} ${this.info}</span>
                `,
                didRender: () => {
                    document.getElementById('cpleft').onclick = () => this.easter();
                }
            })
        },
        easter(){
            if (this.biptest){
                this.biptest = false
                document.getElementById('cpleft').classList.toggle('active');
                document.getElementById('cpleft').classList.toggle('inactive');
            } 
            else { 
                this.biptest = true
                document.getElementById('cpleft').classList.toggle('active');
                document.getElementById('cpleft').classList.toggle('inactive');
            }
        },
        fetchBiPData(base64String){

            const tokens = this.decodeBase64AndExtractTokens(base64String);
            console.log(tokens); // Zeigt die extrahierten Tokens, falls vorhanden
            let token = tokens[1]
            
            let url = `https://www.bildung.gv.at/webservice/rest/server.php?wstoken=${token}&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`
            if (this.biptest){ url = `https://q.bildung.gv.at/webservice/rest/server.php?wstoken=${token}&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json` }
            

            fetch(url, { method: 'POST'})
            .then( res => res.json() )
            .then( response => {
                console.log(response)
                this.$swal.fire({
                        title: "BiP Response",
                        text: "Verbindung hergestellt",
                        icon: 'info',
                        showCancelButton: false,
                })
                if (response.fullname){
                    this.username = response.fullname
                    this.bipuserID = response.userid
                    document.querySelector("#biploginbuttonlabel").textContent = "verbunden";
                    document.querySelector("#biploginbutton").disabled = true;

                }
            })
            .catch(err => { console.warn(err) })
        },
        // Function to add fade-in effect
        fadeIn(element) {
            element.classList.add('fade-in');
            element.classList.remove('fade-out');
        },

        // Function to add fade-out effect
        fadeOut(element) {
            element.classList.add('fade-out');
            element.classList.remove('fade-in');
        },
    },
    mounted() {  
        document.querySelector("#statusdiv").style.visibility = "hidden";
     
        this.fetchInfo();

        this.fetchinterval = new SchedulerService(4000);
        this.fetchinterval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert
        this.fetchinterval.start();


        // add event listener to user input field to supress all special chars 
        document.getElementById("user").addEventListener("keypress", function(e) {
           // var lettersOnly = /^[a-zA-Z ]+$/;
            var lettersOnly = /^[a-zA-ZäöüÄÖÜß ]+$/;  //give some special chars for german a chance
            var key = e.key || String.fromCharCode(e.which);
            if (!lettersOnly.test(key)) { e.preventDefault(); }
        });

 


        ipcRenderer.on('bipToken', (event, token) => {  
            console.log("token received: ",token)
            this.bipToken = token
            this.fetchBiPData(token)
        });


    },
    beforeUnmount() {
        this.fetchinterval.removeEventListener('action', this.fetchInfo);
        this.fetchinterval.stop() 
    }
}
</script>

<style>
.active {
    filter: contrast(100%) grayscale(100%) brightness(80%) !important;
}
.inactive {
    filter: contrast(40%) grayscale(100%) brightness(130%) blur(0.6px) !important;
}

/**in order to override swal settings the css needs to be global not scoped*/
.swal2-popup{
    opacity: 0.9 !important; 
}

.swal2-container {
    backdrop-filter: blur(2px); 
} 


</style>

<style scoped>

.disabledexam {
    filter: contrast(100%) grayscale(100%) brightness(80%) blur(0.6px);
   pointer-events: none;
}
.disabledtext {
    filter: contrast(40%) grayscale(100%) brightness(130%) blur(0.6px);
   pointer-events: none;
} 

#content {
    background-color: whitesmoke;
    min-width: 680px;
}

.infobutton{
    width: 224px;
    min-width: 224px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    background-color: whitesmoke;
}

/* CSS classes for fade-in and fade-out */
.fade-in {
    animation: fadeInAnimation 2s;
}
.fade-out {
    animation: fadeOutAnimation 2s forwards; /* 'forwards' keeps the final state after the animation */
}
@keyframes fadeInAnimation {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes fadeOutAnimation {
    from { opacity: 1; }
    to { opacity: 0; visibility: hidden; }
}

</style>
