<template>

<!-- Header START -->
<div class="w-100 p-3 text-white bg-dark text-right" style="height: 66px; z-index: 10000;">
    <span class="text-white m-1">
        <img src='/src/assets/img/svg/speedometer.svg' class="white me-2  " width="32" height="32" >
        <span class="fs-4 align-middle me-4" @click="handleClick">Next-Exam</span>
    </span>

    <span class="fs-4 align-middle  ms-3" style="float: right">Student</span>
    <div v-if="token && !localLockdown" id="adv" class="btn btn-success btn-sm m-0  mt-1 " style="cursor: unset; float: right">{{ $t("student.connected") }}</div>
    <button v-if="clientinfo.groups && clientinfo.group == 'a' && token && !localLockdown" type="button" class="btn btn-info btn-sm  m-1 mt-1" style="cursor: unset; width: 32px; float: right"> A  </button>
    <button v-if="clientinfo.groups && clientinfo.group == 'b' && token && !localLockdown" type="button" class="btn btn-warning btn-sm m-1 mt-1" style="cursor: unset; width: 32px; float: right"> B  </button>               
    <div v-if="!hostip" id="adv" class="btn btn-danger btn-sm m-0  mt-1 " style="cursor: unset; float: right">{{ $t("student.offline") }}</div>
    <div v-if="networkerror" id="adv" class="btn btn-danger btn-sm m-0  mt-1 " style="cursor: unset; float: right">{{ $t("student.noapi") }}</div>
</div>
<!-- Header END -->

<div id="wrapper" class="w-100 h-100 d-flex" >

    <!-- SIDEBAR START -->
    <div class="p-3 text-white bg-dark h-100" style="width: 240px; min-width: 240px;">
        <div class="btn btn-light ms-1 text-start infobutton nobutton">
            <img src='/src/assets/img/svg/server.svg' class="me-2"  width="16" height="16" > {{$t('student.exams')}} 
        </div><br>
    

        <div :class="(token)? 'disabledexam':''" class="form-check form-switch m-1 mb-2 mt-2">
            <input id="manualsearch" type="checkbox"  v-model="advanced" class="form-check-input" @change="toggleAdvanced">
            <label for="manualsearch" class="form-check-label">{{$t('student.manualsearch')}}</label>
        </div>


    
      

        <!-- BIP Section START -->
        <div v-if="config.bipIntegration" class="mt-4">
            <span class="small m-1 me-0">{{$t("student.bildungsportal")}}</span> <span v-if="bipToken" class="small m-1 me-0 text-secondary">(verbunden)</span> 
            <div v-if="bipToken" title="logout" id="biploginbutton" @click="logoutBiP()" class="btn btn-success m-1 " :class="(token)? 'disabledexam':''" style="padding:0;">
                <img id="biplogo" style="filter: hue-rotate(140deg);  width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
                <span v-if="bipUsername" id="biploginbuttonlabel">{{bipUsername}}</span><span v-else id="biploginbuttonlabel">Login</span>
            </div> 
            <div v-else id="biploginbutton" title="login" @click="loginBiP()" class="btn btn-info m-1 " style="padding:0;" :class="(token)? 'disabledexam':''">
                <img id="biplogo" style="width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
                <span v-if="bipUsername" id="biploginbuttonlabel">{{bipUsername}}</span><span v-else id="biploginbuttonlabel">Login</span>
            </div> 
        </div>
        <!-- BIP Section END -->

        
        <div @click="setupLocalLockdown()" class="btn btn-sm btn-outline-secondary ms-1 mt-3 mb-4"  :class="(token)? 'disabledexam':''" style="font-size:0.9em"> {{ $t("student.localLockdown") }} </div>




        <div > <br><div id="statusdiv" class="btn btn-warning m-1"></div>  </div> <br>

        <button class="btn btn-outline-secondary btn-sm ms-1 mt-3 mb-2" style="position: absolute; bottom:32px;"  @click="toggleLocale">{{ inactivelocale }}</button>

        <span @click="showCopyleft()" style="position: absolute; bottom:2px; left: 6px; font-size:0.8em;cursor: pointer;">
            <span style=" display:inline-block; transform: scaleX(-1);font-size:1.2em; ">&copy; </span> 
            <span style="vertical-align: text-bottom;">&nbsp;{{version}} {{ info }}</span>
        </span>
    </div>
    <!-- SIDEBAR END  -->



    <!-- CONTENT START -->
    <div id="content" class="fadeinfast p-3">



        <div class="col-8 mb-2" :class="(token)? 'disabledtext':''">
            <div v-if="!bipToken" class="input-group  mb-1">
                <span class="input-group-text col-3" style="width:135px;" id="inputGroup-sizing-lg">{{ $t("student.name") }}</span>
                <input v-model="username" type="text" required="required" maxlength="25" class="form-control" id="user" placeholder="" style="width:200px;max-width:200px;min-width:135px;">
            </div> 
            <div v-if="bipToken" class="input-group  mb-1">
                <span class="input-group-text col-3" style="width:135px;" id="inputGroup-sizing-lg">{{ $t("student.name") }}</span>
                <span v-if="username" class="input-group-text col-3" style="width:200px;" id="inputGroup-sizing-lg"> {{ username  }} </span>
                <span v-else class="input-group-text col-3 " style="width:200px;" id="inputGroup-sizing-lg">  </span>
            </div> 
            <div class="input-group  mb-1"> 
                <span class="input-group-text col-3" style="width:135px;" id="inputGroup-sizing-lg">{{ $t("student.pin") }}</span>
                <input  v-model="pincode" type="number" min="0" oninput="validity.valid||(value='')" class="form-control" id="pin" placeholder="" style="width:135px;max-width:135px;min-width:135px;">
            </div>
            <div v-if="advanced" class="input-group  mb-1"> 
                <span class="input-group-text col-3" style="width:135px;" id="inputGroup-sizing-lg">{{ $t("student.ip") }}</span>
                <input :class="{'form-control': validip, 'form-control is-invalid': !validip}" v-model="serverip" class="form-control" id="serverip" placeholder="" style="width:135px;max-width:135px;min-width:135px;">
            </div>
        </div>
  
  
       
        <div style="position: absolute; top: 205px !important;">
            <h4 class="mt-3 ms-1">{{ $t("student.exams") }}</h4>
            <div id="list" class="" style="overflow-y:auto; height: 369px; display:flex; flex-wrap: wrap; flex-direction: row;">
                
                <div v-for="server in serverlist" class="row p-3 m-0 mb-2 border bg-light" style="border-radius: 4px; margin-right: 10px !important; min-height:100px; max-height:100px;  min-width:234px; max-width: 234px;">
                    
                    <div style="display:flex; flex-direction: row; justify-content: space-between; padding:0px;">
                        <div style="width:130px; display:inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"> {{server.servername}}  </div>  
                        
                        <div v-if="server.bip" class="badge btn-teal" style="width:70px; height:20px; vertical-align: text-bottom; margin-top: 2px; display: inline;"> BiP Exam</div>
                        <div v-else  style="width:70px; height:20px; vertical-align: text-bottom; margin-top: 2px; display: inline;"> </div>
                    </div>
                  
  
                    <div style="display:flex; flex-direction: row; justify-content: space-between; padding:0px; margin:0px;">
                        <img v-if="!server.reachable" src="/src/assets/img/svg/emblem-warning.svg" :title="$t('student.unreachable')"   style="width:20px;height:20px;vertical-align:top;cursor: help;position: absolute; margin-top:8px; margin-left:8px; ">
                       
                   
                         <div v-if="!token" style="margin-top:2px; padding:0px; ">
                            <!-- nicht angemeldet, kein bip server -->   <input v-if="!server.bip" style="width:200px;" :id="server.servername" type="button" name="register" class="btn btn-sm btn-info" :value="$t('student.register')" @click="registerClient(server.serverip,server.servername)"> 
                            <!-- nicht angemeldet, bip server      -->   <input v-if="server.bip"  style="width:200px;" :id="server.servername" type="button" name="register" class="btn btn-sm" :value="server.examStatus ? server.examStatus : 'restricted'" :class="{'btn-teal': server.examStatus == 'open', 'btn-warning': server.examStatus == 'closed' || !server.examStatus, 'btn-secondary': server.examStatus == 'offline' }"/>
                         </div>
                         <div v-if="token" style="margin-top:2px; padding:0px;">
                            <!-- angemeldet, nicht auf diesem server --> <input v-if="clientinfo.servername !== server.servername && !server.bip" style="width:200px;" :id="server.servername" disabled type="button" name="register" class="btn btn-sm btn-secondary" :value="server.examStatus ? server.examStatus : $t('student.register')" />
                            <!-- angemeldet, nicht auf diesem server, bip server, restricted --> <input v-if="clientinfo.servername !== server.servername && server.bip && !server.examStatus" style="width:200px;" :id="server.servername" disabled type="button" name="register" class="btn btn-sm btn-secondary" value="restricted" />
                            <!-- angemeldet, nicht auf diesem server, bip server  --> <input v-if="clientinfo.servername !== server.servername && server.bip && server.examStatus" style="width:200px;" :id="server.servername" disabled type="button" name="register" class="btn btn-sm btn-secondary" :value="server.examStatus" />
                            <!-- angemeldet, auf diesem server       --> <input v-if="clientinfo.servername === server.servername" style="width:200px;" :id="server.servername" disabled type="button" name="register" class="btn btn-sm btn-success" :value="$t('student.registered')" />
                        </div>
                    
                    </div>
                  
                </div>
                <div v-if="serverlist.length === 0"><h6 class="text-muted ms-1">{{$t('student.noexams')}}</h6> </div>
            </div>
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
            autoUpdateInterval: null,
            serverApiPort: this.$route.params.serverApiPort,
            clientApiPort: this.$route.params.clientApiPort,
            electron: this.$route.params.electron,
            config: this.$route.params.config,
            startExamEvent: null,
            advanced: false,
            serverip: "",
            servername: "",
            hostip: config.hostip,
            clickCount: 0,
            networkerror: false,
            localLockdown: false,
          
            biptest:false,
            bipToken:false,
            bipUsername:false,
            bipuserID: false,
            servertimeout: false,
            bipData: null,
            onlineExams: [],
      
        };
    },
    computed: {
        inactivelocale() { // Zeigt aktuellen Sprachcode
             return this.$i18n.locale === 'de' ? 'en' : 'de';
        }
    },


    methods: {
        toggleLocale() {
        // Umschalte zwischen 'de' und 'en'
         this.$i18n.locale = this.$i18n.locale === 'de' ? 'en' : 'de';
        },
        async loginBiP(){
            if (this.config.bipDemo){   // skip bip logon and fake bip info
                this.bipUsername = "Robert Schrenk"
                this.bipuserID = 123456
                this.bipToken = "4hedh443gc34lm34wb43moeinlz0082droeib45beio"
                this.username = this.bipUsername

                await this.fetchBipExams()
                this.bipAutoconnect()
                return  //skip real login
            }

            let IPCresponse = ipcRenderer.sendSync('loginBiP', this.biptest)
            console.log(IPCresponse)
        },

        logoutBiP(){
            this.$swal({
                title: this.$t("student.bildungsportal"),
                text:  this.$t("student.logoutBiP"),
                showCancelButton: true,
                confirmButtonText: 'Ok',
                cancelButtonText: this.$t("editor.cancel"),
                focusConfirm: false,
                icon: 'question',
            }).then((result) => {
                if (result.isConfirmed) {
                    this.bipToken = false
                    this.bipUsername = false
                    this.bipuserID = false
                    this.username = ""
                    this.pincode = ""
                    this.bipData = null
                    this.onlineExams = []
                } 
            });
        },

        /**
         * überprüft ob es online exams gibt und versucht diese zu verbinden
         */ 
        bipAutoconnect(){
            if (this.onlineExams.length > 0){
                this.onlineExams.forEach( exam => {
                    if (exam.examStatus == "open"){
                        exam.examTeachers.forEach( teacher => {
                            if (teacher.teacherIP){
                                //console.log(exam)
                                this.serverip = teacher.teacherIP
                                this.username = this.bipUsername
                                this.pincode = parseInt(exam.examPin)     // set the pin to the exam pin for auto connect
                                console.log(`connecting to exam: ${exam.examName} with teacher: ${teacher.teacherID} and pin: ${exam.examPin}`)
                                this.registerClient(teacher.teacherIP, exam.examName)
                            }
                        })
                    }
                })
            }
        },

        handleClick() {
            this.clickCount++;
            if (this.clickCount > 6) {
                this.clickCount = 0
                ipcRenderer.send('reload-url');
            }
        },

        /**
         * lädt vorkonfigurierte exams vom bildungsportal via bip/api
         */
         async fetchBipExams(){
            if (!this.bipToken) return;  // cannot fetch from bip api without valid token

            // if (this.config.development){
                let url= "http://10.0.0.100:3000/student"

                await fetch(url, {
                    method: "GET",
                    headers: {"Content-Type": "application/json" }
                })
                .then(response => { return response.json(); } )                  
                .then(data => {
                   // console.log("Daten von der API:", data);
                    this.bipData = data   // store all of the information in data
                    this.onlineExams = data.exams
                    return
                })
                .catch(error => { console.error("Fehler beim API-Aufruf:", error);});
                return
            // }
            // else {
                // Do actual BIP API Call
                // let url= "https://www.bildung.gv.at/webservice/rest/next-exam/teacher"
                // fetch(url, {
                //     method: "GET",
                //     headers: {"Content-Type": "application/json" }
                // })
                // .then(response => { return response.json(); } )                  
                // .then(data => {
                //     console.log("Daten von der API:", data);
                //     this.bipData = data   // store all of the information in data
                //     data.exams.forEach( exam => {
                //   this.onlineExams = this.data.exams    
                //     })
                // })
                // .catch(error => { console.error("Fehler beim API-Aufruf:", error);});
            // }
        },


        fetchBiPData(base64String){
            const tokens = this.decodeBase64AndExtractTokens(base64String);
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
                }
            })
            .catch(err => { console.warn(err) })
        },


    


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
                            <input class="form-control" type=password id=localpassword placehoder='Passwort'>
                        </div>
                    </div>`,
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

            if (this.servertimeout > 2){ this.advanced = true }

            // advanced search for exams in local network
            if ( this.advanced && !this.token) {
                if (this.serverip !== ""){
                    if (validator.isIP(this.serverip) || validator.isFQDN(this.serverip)){
                        this.validip = true
                        //give some userfeedback here
                        if (this.serverlistAdvanced.length == 0){ this.status("Suche Prüfungen...")  }
                        fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/serverlist`)
                        .then(response => response.json()) // Parse JSON response
                        .then(data => {
                            if (data && data.status === "success") {
                                this.serverlistAdvanced = data.serverlist;
                                this.networkerror = false;
                            }
                        }).catch(err => { log.error(`student.vue @ fetchInfo (advanced): ${err.message}`); this.networkerror = true; });
                    } 
                    else { this.validip = false}
                }
                else { this.networkerror = false; this.validip = true}
            }
            else { this.networkerror = false; this.validip = true}






            //vereine serverlist und serverlistAdvanced (advanced sucht direkt über eine angegebne ip adresse)
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
            else {  // (no servers incoming via multicast) es gibt keine serverliste - nutze die advanced liste wenn in dieser server vorhanden sind
                if (this.serverlistAdvanced.length !== 0){ this.serverlist = this.serverlistAdvanced }  // one server coming via direct ip polling
                else { this.serverlist = []; this.servertimeout++ }  // no servers found
            }



            // add bip servers to serverlist
            if (this.onlineExams.length > 0){
                this.onlineExams.forEach(exam => {
                    // nur examen die auch für den schüler erstellt wurden werden über die api aktualisiert und deren exam status wird gesetzt - andere examen die zwar auch bip-exams sind haben daher keinen exam status
                    const existingServer = this.serverlist.find(server => server.servername === exam.examName );// Check if server already exists in serverlist
                    if (existingServer) { 
                        existingServer.examStatus = exam.examStatus
                    } 
                    else {
                        // Create new server entry in serverlist format
                        const newServer = {
                            id: exam.id,
                            servername: exam.examName,
                            reachable: true,
                            serverport: this.serverApiPort,
                            timestamp: Date.now(),
                            bip: true,
                            examStatus: exam.examStatus
                        };
                        this.serverlist.push(newServer);
                    }
                })
            }





    
            // check im networkconnection is still alive - otherwise exit here
            this.hostip = await ipcRenderer.invoke('checkhostip')
            if (!this.hostip) return;  
            if (this.clientinfo.token) return;   // stop spamming the api if already connected
        



            // CHECK if Servers are still alive otherwise mark with attention sign
            for (let server of this.serverlist){  
                if (!server.serverip) continue;

                const signal = AbortSignal.timeout(2000); // 2000 Millisekunden = 2 Sekunden
                fetch(`https://${server.serverip}:${this.serverApiPort}/server/control/pong`, { method: 'GET', signal })
                .then(response => {
                    if (!response.ok) throw new Error('Response not OK');
                    server.reachable = true; // Markieren als erreichbar, wenn erfolgreich
                })
                .catch(err => {
                    if (err.name === 'AbortError') {   console.warn('student.vue @ fetchinfo (ping): Fetch request was aborted due to timeout'); } 
                    else {  console.warn(`student.vue @ fetchinfo: ${err.message} - Server unavailable ` );  }
                    server.reachable = false; // Markieren als nicht erreichbar bei Fehlern
                });
            }
        },  
        
        toggleAdvanced(){
            if (!this.advanced){
                this.servertimeout = 0
                this.serverip = ""
            }
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

                const charMap = {
                    'ć': 'c',
                    'č': 'c',
                    'š': 's',
                    'ž': 'z',
                    'đ': 'd',
                    // Add more mappings as needed
                };


                //check username - remove leading and trailing spaces
                this.username = this.username
                    .replace(/^\s+|\s+$/g, '')
                    .replace(/[^\x00-\x7F]/g, char => charMap[char] || char); // Replace using the map


                //  console.log({clientname:this.username, servername:servername, serverip, serverip, pin:this.pincode, bipuserID:this.bipuserID })
               
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
                title: "<span id='cpleft' class='active' style='display:inline-block; transform: scaleX(-1); vertical-align: middle; cursor: pointer;'>&copy;</span> <span style='font-size:0.7em'>Thomas Michael Weissel </span>",
                icon: 'info',
                html: `
                <a href="https://www.bmb.gv.at/Themen/schule/zrp/dibi/foss.html" target="_blank"><img style="width: 230px; opacity:1;" src="./BMB_Logo_srgb.png"></a>
                <br>
                <br>
                <a href="https://linux-bildung.at" target="_blank"><img style="width: 50px; opacity:0.7;" src="./osos.svg"></a>   <br>
                <span style="font-size:0.8em"> <a href="https://next-exam.at/#kontakt" target="_blank">next-exam.at</a> </span> <br>
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


        async bipAutoUpdate(){
            if (this.bipToken){ 
                this.username = this.bipUsername
                await this.fetchBipExams()    
                if (!this.token){
                    this.bipAutoconnect()
                }
            }
            else {
                this.onlineExams = []
            }
        }

    },
    mounted() {  
        document.querySelector("#statusdiv").style.visibility = "hidden";

        this.fetchInfo();

        this.fetchinterval = new SchedulerService(4000);
        this.fetchinterval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert
        this.fetchinterval.start();

        this.autoUpdateInterval = new SchedulerService(10000);
        this.autoUpdateInterval.addEventListener('action',  this.bipAutoUpdate);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert
        this.autoUpdateInterval.start();    

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


        // set locale to system locale or fallback to 'en'
        const systemLocale = navigator.language.split('-')[0] // z.B. "de" aus "de-DE"
        const locale = ['de', 'en'].includes(systemLocale) ? systemLocale : 'en' // Fallback zu 'en'
        this.$i18n.locale = locale

    },
    beforeUnmount() {
        this.fetchinterval.removeEventListener('action', this.fetchInfo);
        this.fetchinterval.stop() 

        this.autoUpdateInterval.removeEventListener('action', this.bipAutoUpdate);
        this.autoUpdateInterval.stop() 
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




.nobutton {
   pointer-events: none;
}



.disabledbutton {
    pointer-events: none; /* Deaktiviert Klicks */
}

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



#statusdiv {
    display: block !important;
    width: 200px  ;
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
