<template>


<div class="w-100 p-3 text-white bg-dark shadow text-right">
    <router-link v-if="!electron" to="/" class="text-white m-1">
        <img src="/src/assets/img/svg/shield-lock-fill.svg" class="white me-2  " width="32" height="32" >
        <span class="fs-4 align-middle me-1 ">Next-Exam</span>
    </router-link>
    <span v-if="electron" class="text-white m-1">
        <img src="/src/assets/img/svg/shield-lock-fill.svg" class="white me-2  " width="32" height="32" >
        <span class="fs-4 align-middle me-1 ">Next-Exam</span>
    </span>
    <span class="fs-4 align-middle ms-3" style="float: right">Teacher</span>
    <div v-if="!hostip" id="adv" class="btn btn-danger btn-sm m-0  mt-1 " style="cursor: unset; float: right">{{ $t("general.offline") }}</div>
</div>
 


<div id="wrapper" class="w-100 h-100 d-flex" >

    <!-- sidebar -->
    <div class="p-3 text-white bg-dark h-100 " style="width: 240px; min-width: 240px;">
        <div class="btn btn-light m-0 text-start infobutton">
            <img src='/src/assets/img/svg/server.svg' class="me-2"  width="16" height="16" > 
            {{$t("general.startserver")}}
        </div><br>
        <router-link v-if="!electron" to="serverlist" id="serverlist" class="nav-link">
            <img src="/src/assets/img/svg/person-lines-fill.svg" class="white me-2"  width="16" height="16" >
            {{$t("general.slist")}}
        </router-link> 
    
       
        <div v-if="freeDiscspace < 0.1" class="warning">  {{ $t("startserver.freespacewarning") }}   </div>
        
        <div id="previous" class="mt-4" v-if="previousExams && previousExams.length > 0">
            <span class="small">{{$t("startserver.previousexams")}}</span>
            <div v-for="exam of previousExams">
                <div class="input-group" style="display:inline;">
                    <div class="btn btn-sm btn-warning mt-1" @click="delPreviousExam(exam.dirname)">x</div>
                    
                    <div v-if="servername === exam.dirname" class="btn btn-sm btn-info mt-1" :id="exam.dirname" @click="setPreviousExam(exam.dirname)">{{exam.dirname}}</div>  
                    
                    <div v-else-if="servername !== exam.dirname && exam.serverstatus.bip" class="btn btn-sm btn-teal mt-1" :id="exam.dirname" @click="setPreviousExam(exam.dirname)">{{exam.dirname}}</div>  
                    <div v-else class="btn btn-sm btn-secondary mt-1" :id="exam.dirname" @click="setPreviousExam(exam.dirname)">{{exam.dirname}}</div>

                </div>
                <img v-if="servername === exam.dirname" src="/src/assets/img/svg/games-solve.svg" class="printercheck" width="22" height="22" >
                
            </div>
        </div>

       
        <div v-if="config.bipIntegration">
            <br> <br>
            <span class="small">{{$t("dashboard.bildungsportal")}}</span>

            <div id="biploginbutton" @click="loginBiP()" class="btn btn-info mb-1 me-0 mt-1" style="padding:0;">
                <img id="biplogo" style="width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
                <span id="biploginbuttonlabel">Login</span>
            </div> 
        
           





            <div id="onlineexams" class="mt-4" v-if="onlineExams && onlineExams.length > 0">
                <span class="small">{{$t("startserver.onlineexams")}}</span>
                <div v-for="exam of onlineExams">
                    <div class="input-group" style="display:inline;">
                        <div v-if="servername !== exam" class="btn btn-sm btn-teal mt-1" :id="exam" @click="setOnlineExam(exam)">{{exam}}</div>
                        <div v-if="servername === exam" class="btn btn-sm btn-info mt-1" :id="exam" @click="setOnlineExam(exam)">{{exam}}</div>  
                    </div>
                    <img v-if="servername === exam" src="/src/assets/img/svg/games-solve.svg" class="printercheck" width="22" height="22" >
                </div>
            </div>







        </div>
        


        <br> <br>
        <div id="statusdiv" class="btn btn-warning">{{$t("startserver.connected")}}</div>
        <br>
       
        <span @click="showCopyleft()" style="position: absolute; bottom:2px; left: 6px; font-size:0.8em;cursor: pointer;">
            <span style=" display:inline-block; transform: scaleX(-1);font-size:1.2em; ">&copy; </span> 
            <span style="vertical-align: text-bottom;">&nbsp;{{version}} {{ info }}</span>
        </span>
    </div>

    <!-- maincontent -->
    <div id="content" class="fadeinslow p-3">
        <div class="col8">
            <div class="input-group  mb-1 mt-0">
                <span class="input-group-text col-2 grayback" id="inputGroup-sizing-lg" style="width:160px;max-width:160px;min-width:160px;">{{$t("startserver.examname")}}</span>
                <input v-model="servername" maxlength="20" type="text" class="form-control" id="servername" placeholder="Mathe-5a" style="width:200px;max-width:200px;min-width:135px;">
    
            </div>   
            <div class="input-group mb-3" style="max-width: fit-content">  
                <span id="workdir" class="input-group-text col-2 grayback"  style="width:160px;">{{$t("startserver.workfolder")}}</span>
                <span class="form-control " style="font-family: monospace; font-size: 0.9em; padding-top: 8px; white-space: pre;">{{ workdir }}</span>
                <button @click="setWorkdir()" id="workdir" class="btn btn-info p-0" style="width:40px;" :title="$t('startserver.select')">
                   
                    <img src="/src/assets/img/svg/settings.svg" style="vertical-align: sub;" class="" width="18" height="18" >
                </button>
            </div>



            
            <!-- 
                we do not need to display the password in electron standalone version because no other exams are ever listed and you can not leave the exam without ending the server 
                could be used to set an ESCAPE PASSWORD for students to make it harder to leave on connection loss
            -->
            <div class="input-group  mb-3" :class="(electron) ? 'hidden':''"> 
                <input v-model="password" type="text" class="form-control " id="password" placeholder="password" style="width:135px;max-width:135px;min-width:135px;">
                <span class="input-group-text col-4" style="width:135px;" id="inputGroup-sizing-lg">{{$t("startserver.pwd")}}</span>
            </div>

            <button @click="startServer()" :class="(!hostip) ? 'disabled':''" id="examstart" class="mb-5 btn btn-success" value="start exam" style="width:150px;max-width:150px;min-width:120px;">{{$t("startserver.start")}}</button>
            
        </div>

        


    </div>
</div>
</template>



<script>
import log from 'electron-log/renderer';
import {SchedulerService} from '../utils/schedulerservice.js'


// Erfassen von unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  log.error('Unhandled promise rejection:', event.reason); // Loggen des Fehlers
});

Object.assign(console, log.functions);





export default {
    data() {
        return {
            version: this.$route.params.version,
            info: config.info,
            config: config,
            title: document.title,
            servername : this.$route.params.config.development ? "5A-Mathematik":"",
            password: this.$route.params.config.development ? "password": Math.floor(1000 + Math.random() * 9000),   //we could use this password to allow students to manually leave exam mode 
            prod : false,
            serverApiPort: this.$route.params.serverApiPort,
            electron: this.$route.params.electron,
            hostname: window.location.hostname,
            hostip: this.$route.params.config.hostip,
            advanced: false,
            workdir: this.$route.params.config.workdirectory,
            freeDiscspace: 100,
            previousExams: [],
            onlineExams: [],
            biptest:false,   //switches between production and q

            bipToken:false,
            bipuserID: false,
            bipUsername: false
        };
    },
    components: {},
    methods: {


        loginBiP(){
            if (this.config.development){   // skip bip logon and fake bip info
               
                this.bipUsername = "Weissel Thomas"
                this.bipuserID = 92136
                this.bipToken = "aoeiaioeaoei"
                
                document.querySelector("#biploginbuttonlabel").textContent = this.bipUsername
                document.querySelector("#biploginbutton").classList.remove('btn-info')
                document.querySelector("#biploginbutton").classList.add('btn-success')
                document.querySelector("#biplogo").style.filter = "hue-rotate(140deg)"
                document.getElementById("biploginbutton").classList.add("disabledbutton");

                this.fetchBipExams()

                return
            }


            let IPCresponse = ipcRenderer.sendSync('loginBiP', this.biptest)
            console.log(IPCresponse)
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
 
                if (response.fullname){
                    this.$swal.fire({
                        title: "BiP Response",
                        text: "Verbindung hergestellt",
                        icon: 'info',
                        showCancelButton: false,
                    })

                    this.bipUsername = response.fullname
                    this.bipuserID = response.userid

                    document.querySelector("#biploginbuttonlabel").textContent = this.bipUsername;
                    document.querySelector("#biploginbutton").classList.remove('btn-info')
                    document.querySelector("#biploginbutton").classList.add('btn-success')
                    document.querySelector("#biplogo").style.filter = "hue-rotate(140deg)"
                    document.getElementById("biploginbutton").classList.add("disabledbutton");


                    this.fetchBipExams()
                }
                else {
                    this.$swal.fire({
                        title: "BiP Response",
                        text: "Verbindung konnte nicht hergestellt werden",
                        icon: 'info',
                        showCancelButton: false,
                    })

                }
            })
            .catch(err => { console.warn(err) })
        },


        fetchBipExams(){
            if (this.config.development){
                let url= "http://localhost:3000/teacher"

                fetch(url, {
                    method: "GET",
                    headers: {"Content-Type": "application/json" }
                })
                .then(response => { return response.json(); } )                  
                .then(data => {
                    console.log("Daten von der API:", data);
                    this.bipData = data   // store all of the information in data

                    data.exams.forEach( exam => {
                        this.onlineExams.push(exam.examName)
                    })

                })
                .catch(error => { console.error("Fehler beim API-Aufruf:", error);});
            }
            else {
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
                //         this.onlineExams.push(exam.examName)
                //     })

                // })
                // .catch(error => { console.error("Fehler beim API-Aufruf:", error);});

            }
        },


        setOnlineExam(name){
            document.getElementById('servername').value = name
            this.servername = name

            // save the selected exam information to local serverstatus.json / create local exam folder
            this.bipData.exams.forEach(exam =>{
                if (exam.examName === name){
                    ipcRenderer.invoke('createBipExamdirectory', exam)
                }
            }) 
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
            console.log("biptest:", this.biptest)
        },



        async fetchInfo() {
            this.hostip = ipcRenderer.sendSync('checkhostip')
            if (!this.hostip) return; 

        },

        async checkDiscspace(){   // achtung: custom workdir spreizt sich mit der idee die teacher instanz als reine webversion laufen zulassen - wontfix?
           this.freeDiscspace = await ipcRenderer.invoke('checkDiscspace')
        },

        async getPreviousExams(){
            this.previousExams = await ipcRenderer.invoke('scanWorkdir')
            //console.log(this.previousExams)
            this.config = await ipcRenderer.invoke('getconfigasync') 
            this.workdir = this.config.workdirectory   // just in case this is already altered in the backend make sure to display current settings
        },


        /**  setzt das feld prüfungsname auf den namen des angeklickten prüfungsverzeichnisses */
        setPreviousExam(name){
            document.getElementById('servername').value = name
            this.servername = name
            this.checkExistingExam()
        },


        /** sucht unter den gesicherten verzeichnissen und ändert den text am startbutton */
        checkExistingExam(){
            for (let i = 0; i < this.previousExams.length; i++) {
                const previousExam = this.previousExams[i] // current exam object
                if (previousExam.dirname === this.servername) {
                    document.getElementById('examstart').innerHTML = this.$t("startserver.resume")
                    break
                } else {
                    document.getElementById('examstart').innerHTML = this.$t("startserver.start")
                }
            }        
        },

        delPreviousExam(name){
            // ASK for confirmation!
            this.$swal.fire({
                title: this.$t("startserver.previousexams"),
                text: this.$t("startserver.folderdelete"),
                icon: "warning",
                showCancelButton: true,
                cancelButtonText: this.$t("dashboard.cancel"),
                reverseButtons: true
            })
            .then(async (result) => {
                if (result.isConfirmed) { 
                    let response = await ipcRenderer.invoke('delPrevious', name)
                    console.log(response)
                    this.getPreviousExams()
                } 
            });  
        },
        async setWorkdir(){   // achtung: custom workdir spreizt sich mit der idee die teacher instanz als reine webversion laufen zulassen - wontfix?
            let response = await ipcRenderer.invoke('setworkdir')
            this.workdir = response.workdir
            if (response.message == "error"){
                this.status(this.$t("startserver.directoryerror"))
            }
            this.checkDiscspace()
            this.getPreviousExams()
        },

        toggleAdvanced(){
            if (this.advanced) {this.advanced = false} else {this.advanced = true}
        },

        async startServer(){
            if (this.servername === "" ){
                this.status(this.$t("startserver.emptyname")); 
            }
            else if (this.password === ""){
                this.status(this.$t("startserver.emptypw")); 
            }
            else {
                fetch(`https://${this.hostname}:${this.serverApiPort}/server/control/start/${this.servername}/${this.password}`, { 
                    method: 'POST',
                    headers: {'Content-Type': 'application/json' },
                    body: JSON.stringify({ workdir: this.workdir  })
                })
                .then( res => res.json())
                .then( async response => { 
                   
                    if (response.status === "success") {  //directly log in
                        this.status(response.message);
                        await this.sleep(1000);
                        if (this.electron){
                        
                            this.$router.push({  // for some reason this doesn't work on mobile
                                name: 'dashboard', 
                                params:{
                                    servername: this.servername, 
                                    passwd: this.password,
                                    bipToken: this.bipToken,
                                    bipUsername: this.bipUsername,
                                    bipuserID:this.bipuserID
                                }
                            })
                        }
                        else {window.location.href = `#/dashboard/${this.servername}/${this.password}`}
                    }
                    else { 
                        this.status(response.message); 
                    }
                })
                .catch(err => { this.status(err); console.warn(err) })
            } 
        },
        showCopyleft(){
            this.$swal.fire({
                title: "<span id='cpleft' class='active' style='display:inline-block; transform: scaleX(-1); vertical-align: middle;cursor: pointer;'>&copy;</span> <span style='font-size:0.8em'>Thomas Michael Weissel </span>",
                icon: 'info',
                html: `
                <a href="https://www.bmbwf.gv.at/Themen/schule/zrp/dibi/foss.html" target="_blank"><img style="width: 230px; opacity:1;" src="./BMBWF_Logo_srgb.png"></a>
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
        handleKeyupEvent(e) {
            this.servername = document.getElementById('servername').value;
            this.checkExistingExam();
        },
        validateInput(e) {
            var lettersOnly = /^[a-zA-Z0-9-_]+$/;
            var key = e.key || String.fromCharCode(e.which);
            if (!lettersOnly.test(key)) {
                e.preventDefault();
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
        }


    },
    mounted() {  // when ready
        log.info('startserver @ mounted: next-exam ready!');
        document.querySelector("#statusdiv").style.visibility = "hidden";  //do not show on first mount of ui
        
        if (this.prod) {  //clear input fields in production mode
            document.querySelector("#servername").value = "";
            document.querySelector("#pin").value = "";
            document.querySelector("#password").value = "";
        }
      
        this.hostname = "localhost"
        this.checkDiscspace()
        this.getPreviousExams()
      

        ipcRenderer.on('bipToken', (event, token) => {  
            console.log("token received: ",token)
            this.bipToken = token
            this.fetchBiPData(token)
        });



        // intervalle nicht mit setInterval() da dies sämtliche objekte der callbacks inklusive fetch() antworten im speicher behält bis das interval gestoppt wird
        this.fetchinterval = new SchedulerService(4000);
        this.fetchinterval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
        this.fetchinterval.start(); 

        // add event listener to exam input field to supress all special chars 
        document.getElementById("servername").addEventListener("keypress", this.validateInput);
        document.getElementById("servername").addEventListener("keyup",  this.handleKeyupEvent);
    },
    beforeUnmount() {
        document.getElementById("servername").removeEventListener("keyup",  this.handleKeyupEvent);  // sollte eigentlich nicht notwendig sein, aber bei singlepage apps vielleicht besser und sauberer so
        document.getElementById("servername").removeEventListener("keypress",  this.validateInput);
    },
}
</script>



<style>
.active {
    filter: contrast(100%) grayscale(100%) brightness(80%) !important;
}
.inactive {
    filter: contrast(40%) grayscale(100%) brightness(130%) blur(0.6px) !important;
}

</style>



<style scoped>

.disabledbutton {
    pointer-events: none; /* Deaktiviert Klicks */
}

#statusdiv {
    display: block !important;
    width: 200px  ;
}

#content {
    background-color: whitesmoke;
    min-width: 680px;
}

.infobutton{
    width: 240px;
    min-width: 240px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    background-color: whitesmoke;
}

.warning {
    margin-top: 10px;
    border-radius: 3px;
    padding: 2px;
    text-align: center;
    font-size: 0.8em;
    color: #fff;
    background-color:  #dc3545c7;
}

#previous .printercheck {
    margin-left:4px;
    margin-top: 4px;
    filter: saturate(100%) hue-rotate(90deg) ;
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
