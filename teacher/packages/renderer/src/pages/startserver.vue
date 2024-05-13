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
    
        <div v-if="!advanced" id="adv"  class="btn btn-sm btn-outline-secondary mt-2" @click="toggleAdvanced();"> {{ $t("startserver.advanced") }}</div>
        <div v-if="advanced" id="adv"  class="btn btn-sm btn-outline-secondary mt-2" @click="toggleAdvanced();"> {{ $t("startserver.simple") }}</div> 
        <div v-if="freeDiscspace < 0.1" class="warning">  {{ $t("startserver.freespacewarning") }}   </div>
        
        <div id="previous" class="mt-4" v-if="previousExams && previousExams.length > 0">
            <span class="small">{{$t("startserver.previousexams")}}</span>
            <div v-for="exam of previousExams">
                <div class="input-group">
                    <div class="btn btn-sm btn-warning mt-1" @click="delPreviousExam(exam)">x</div>
                    <div class="btn btn-sm btn-secondary mt-1" :id="exam" @click="setPreviousExam(exam)">{{exam}}</div>
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
            <div class="input-group  mb-1">
                <span class="input-group-text col-2"  id="inputGroup-sizing-lg" style="width:150px;max-width:150px;min-width:150px;">{{$t("startserver.examname")}}</span>
                <input v-model="servername" maxlength="20" type="text" class="form-control" id="servername" placeholder="Mathe-5a" style="width:200px;max-width:200px;min-width:135px;">
    
            </div>   
            <div class="input-group  mb-3" :class="(electron) ? 'hidden':''"> <!-- we do not need to display the password in electron standalone version because no other exams are ever listed and you can not leave the exam without ending the server -->
                <input v-model="password" type="text" class="form-control " id="password" placeholder="password" style="width:135px;max-width:135px;min-width:135px;">
                <span class="input-group-text col-4" style="width:135px;" id="inputGroup-sizing-lg">{{$t("startserver.pwd")}}</span>
            </div>
     
            <button @click="startServer()" :class="(!hostip) ? 'disabled':''" id="examstart" class="mb-5 btn btn-success" value="start exam" style="width:150px;max-width:150px;min-width:120px;">{{$t("startserver.start")}}</button>
            
        </div>

        
        <div v-if="advanced" id="list" class="">
            <div class="input-group input-group-sm" style="max-width: fit-content">  
                <button @click="setWorkdir()" id="examstart" class="btn btn-sm btn-info" value="start exam" style="width:195px;">{{$t("startserver.select")}}</button>
                <span class="form-control " style="font-family: monospace; white-space: pre; font-size:0.8em; padding-top: 5px;">{{ workdir }}</span>
            </div>
        </div>

    </div>
</div>
</template>



<script>
import log from 'electron-log/renderer';


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
            title: document.title,
            servername : this.$route.params.config.development ? "Mathe5A":"",
            password: this.$route.params.config.development ? "password": Math.floor(1000 + Math.random() * 9000),   //we could use this password to allow students to manually leave exam mode 
            prod : false,
            serverApiPort: this.$route.params.serverApiPort,
            electron: this.$route.params.electron,
            hostname: window.location.hostname,
            hostip: this.$route.params.config.hostip,
            advanced: false,
            workdir: this.$route.params.config.workdirectory,
            freeDiscspace: 100,
            previousExams: []
        };
    },
    components: {},
    methods: {
        async checkDiscspace(){   // achtung: custom workdir spreizt sich mit der idee die teacher instanz als reine webversion laufen zulassen - wontfix?
           this.freeDiscspace = await ipcRenderer.invoke('checkDiscspace')
        },

        async getPreviousExams(){
            this.previousExams = await ipcRenderer.invoke('scanWorkdir')
            //console.log(this.previousExams)
            this.config = await ipcRenderer.invoke('getconfigasync') 
            this.workdir = this.config.workdirectory   // just in case this is already altered in the backend make sure to display current settings
        },

        setPreviousExam(name){
            document.getElementById('servername').value = name
            this.servername = name
            this.checkExistingExam()
        },

        checkExistingExam(){
            if (this.previousExams.includes(this.servername)){
                document.getElementById('examstart').innerHTML = this.$t("startserver.resume")
            }
            else {
                document.getElementById('examstart').innerHTML = this.$t("startserver.start")
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
                                    passwd: this.password
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
                title: "<span style='display:inline-block; transform: scaleX(-1); vertical-align: middle; cursor: pointer;'>&copy;</span>",
                icon: 'info',
                html: `
                Thomas Michael Weissel <br>
                <span style="font-size:0.8em">
                  <a href="https://next-exam.at/#kontakt" target="_blank">next-exam.at</a>
                </span><br><br>
                <span style="font-size:0.8em">Version: ${this.version} ${this.info}</span>
                `,
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
        if (this.electron){
            this.hostname = "localhost"
            this.checkDiscspace()
            this.getPreviousExams()
        }

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


<style scoped>

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
