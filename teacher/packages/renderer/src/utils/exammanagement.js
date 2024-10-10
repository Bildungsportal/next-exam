import axios from "axios"
import FormData from 'form-data'
import log from 'electron-log/renderer';


// enable exam mode 
function startExam(){
 
    setTimeout(() => {
        this.getFiles('all'); //  trigger this one immediately to figure out if there are write problems on student pcs 
    }, 4000); 

    this.lockscreens(false, false); // deactivate lockscreen
    this.serverstatus.exammode = true;
    log.info("exammanagment @ startExam: starting exammode")
    this.visualfeedback(this.$t("dashboard.startexam"))
    this.setServerStatus()
}


// disable exammode 
function endExam(){
    if (this.hostip){  this.getFiles('all') }  // fetch files from students before ending exam for everybody
    this.$swal.fire({
        title: this.$t("dashboard.sure"),
        html: `<div>
            <input class="form-check-input" type="checkbox" id="checkboxdel">
            <label class="form-check-label" for="checkboxdel"> ${this.$t("dashboard.exitdelete")} </label>
            <br><br>
            <span>${this.$t("dashboard.exitkiosk")}</span>
        </div>`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        reverseButtons: true,
        preConfirm: () => {
            this.serverstatus.delfolderonexit = document.getElementById('checkboxdel').checked; 
        }
    })
    .then((result) => {
        if (result.isConfirmed) {
            this.serverstatus.exammode = false;
            this.lockscreens(false, false); // deactivate lockscreen
            this.setServerStatus()
        } 
    }); 
}


/** 
 * Stop and Exit Exam Server Instance
 */
function stopserver(){

    if (this.hostip){  this.getFiles('all') }      // fetch files from students before ending exam for everybody - this takes up to 8 seconds and may fail - so this is just a emergency backup and should be properly handled by the teacher
    let message = this.$t("dashboard.exitexam")
    if (!this.serverstatus.exammode) { message = this.$t("dashboard.exitexaminfo")}

    this.$swal.fire({
        title: this.$t("dashboard.exitexamsure"),
        html: `<div> ${message} <br> </div>`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        reverseButtons: true,
    })
    .then( async (result) => {
        if (result.isConfirmed) {
            if (!this.hostip){   // somehow the teacher disconnected - stop everything without network address
                await ipcRenderer.invoke("stopserver", this.servername)  // need to stop server first otherwise router.js won't route back
                this.$router.push({ path: '/startserver' });  // route back to startserver view
                return;  
            }
            axios.get(`https://${this.serverip}:${this.serverApiPort}/server/control/stopserver/${this.servername}/${this.servertoken}`)
            .then( async (response) => {
                this.status(response.data.message);
                //log.info(response.data);
                await this.sleep(2000);
                this.$router.push({ path: '/startserver' });  // route back to startserver view
            }).catch( err => {log.error(err)});
        } 
    });    
}



//remove student from exam
function kick(studenttoken, studentip){
    if ( this.studentlist.length <= 0 ) { this.status(this.$t("dashboard.noclients")); return; }
    
    this.$swal.fire({
        title: this.$t("dashboard.sure"),
        text:  this.$t("dashboard.reallykick"),
        icon: "warning",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        reverseButtons: true
    })
    .then((result) => {
        if (result.isConfirmed) {
                //unregister locally
            axios.get(`https://${this.serverip}:${this.serverApiPort}/server/control/kick/${this.servername}/${this.servertoken}/${studenttoken}`)
            .then( response => {
                log.info(response.data);
                this.status(response.data.message);
            }).catch(error => {log.error(error)});
        } 
    });  
}



//restore focus state for specific student -- we tell the client that his status is restored which will then (on the next update) update it's focus state on the server 
function restore(studenttoken){
    this.visualfeedback(this.$t("dashboard.restore"),2000)
    axios.get(`https://${this.serverip}:${this.serverApiPort}/server/control/restore/${this.servername}/${this.servertoken}/${studenttoken}`)
        .then( response => { log.info(response.data)  })
        .catch( err => {log.error(err)});
}



function setAbgabeInterval(){
    if (!this.autoabgabe) {
        this.$swal.fire({
            title: this.$t("dashboard.abgabeauto"),
            icon: 'question',
            input: 'range',
            html: `${this.$t("dashboard.abgabeautoquestion")} <br>  ${this.$t("dashboard.abgabeautohint")}`,
            inputAttributes: {
                min: 1,
                max: 20,
                step: 1
            },
            inputValue: this.abgabeintervalPause
        }).then((result) => {
            const inputInteger = parseInt(result.value, 10); // Convert to integer
            this.abgabeintervalPause = inputInteger
            if (!this.abgabeintervalPause || !Number.isInteger(this.abgabeintervalPause) ){  // make sure it is set otherwise we well fetch the exams X times per second
                log.warn("exammanagment @ setAbgabeInterval: something wrong with interval frequency - setting to default")
                this.abgabeintervalPause = 5
            }   

            this.abgabeinterval.stop();
            log.info("exammanagment @ setAbgabeInterval: starting submission intervall", this.abgabeintervalPause)
            this.abgabeinterval.interval = 60000 * this.abgabeintervalPause
            this.abgabeinterval.start();
            this.setServerStatus()
        })
    }
    else {
        log.info("exammanagment @ setAbgabeInterval: stopping submission interval")
        this.abgabeinterval.stop();
        this.setServerStatus()
    }
}


// get finished exams (ABGABE) from students
function getFiles(who='all', feedback=false, quiet=false){
    this.checkDiscspace()
    if ( this.studentlist.length <= 0 ) { this.status(this.$t("dashboard.noclients")); return; }

    if (this.serverstatus.examtype === "microsoft365"){ //fetch files from onedrive
        this.downloadFilesFromOneDrive()
        if (feedback){ this.visualfeedback(this.$t("dashboard.examrequest"), 2000) }
        else { 
            if (quiet) {return}  //completely quiet
            this.status(this.$t("dashboard.examrequest")); 
        }
    }
    else { 
        log.info(`exammanagment @ getFiles: requesting files from ${who}`)
        // fetch files from clients - this basically just sets studentstatus (we have setstudentstatus/ for that now) to inform the client(s) to send their exam
        fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/fetch/${this.servername}/${this.servertoken}/${who}`)  // who is either all or token
        .then(response => {
            if (!response.ok) {  throw new Error('Network response was not ok');  }
            return response.json(); 
        })
        .then(data => {
            
            if (feedback) { this.visualfeedback(data.message, 2000);  } // Visuelles Feedback, wenn erwünscht
            else {
                if (!quiet) {this.status(data.message);   }// Statusnachricht anzeigen, wenn nicht im "quiet"-Modus
            }
        })
        .catch(error => {  log.error(error);   });



    }
}




 //sets a new screenshot update interval - the value is sent to the students and then used to update the screenshots
 function setScreenshotInterval(){
    this.$swal.fire({
        title: this.$t("dashboard.screenshottitle"),
        icon: 'question',
        input: 'range',
        html: `${this.$t("dashboard.screenshotquestion")} <br>  ${this.$t("dashboard.screenshothint")}
        <br><br>
        <input class="form-check-input" type="checkbox" id="screenshotocr">
        <label class="form-check-label" for="screenshotocer"> ${this.$t("dashboard.ocr")} </label> <br>
        `,
        inputAttributes: {
            min: 0,
            max: 60,
            step: 2
        },
        inputValue: this.serverstatus.screenshotinterval,
        didOpen: () => {
            document.getElementById('screenshotocr').checked =  this.serverstatus.screenshotocr
        },
    }).then((result) => {
        const inputInteger = parseInt(result.value, 10); // Convert to integer
        this.serverstatus.screenshotinterval = inputInteger
        this.serverstatus.screenshotocr = document.getElementById('screenshotocr').checked;

        if (!this.serverstatus.screenshotinterval || !Number.isInteger(this.serverstatus.screenshotinterval)){
            console.log("deactivating screenshots");
            this.serverstatus.screenshotinterval = 0
            this.serverstatus.screenshotocr = false
        }

        if (this.serverstatus.screenshotinterval == 0) { document.getElementById("screenshotinterval").checked = false }
        else { document.getElementById("screenshotinterval").checked = true}

        // WRITE screenshotinterval serverstatus ojbect so it can be retrieved on the next student update 
        this.setServerStatus()
    })  
}


// temporarily lock screens
function lockscreens(state, feedback=true){
    if (this.studentlist.length === 0) { this.status(this.$t("dashboard.noclients")); return;}
    if (state === false) { this.serverstatus.screenslocked = false; if (feedback) { this.visualfeedback(this.$t("dashboard.unlock")); } }   // the feedback interferes with endexam screen
    else { this.serverstatus.screenslocked = true; this.visualfeedback(this.$t("dashboard.lock"))} 
    this.setServerStatus()
}




//upload files to all students
function sendFiles(who) {
    if (this.studentlist.length === 0) { this.status(this.$t("dashboard.noclients")); return;}
    let htmlcontent = `
        ${this.$t("dashboard.filesendtext")} <br>
        <span style="font-size:0.8em;">(.pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>`

    if (this.serverstatus.groups && who == "all"){ //wenn who != "all" sondern ein studenttoken ist dann soll die datei an eine einzelne person gesandt werden
        htmlcontent =  `
            ${this.$t("dashboard.filesendtext")} <br>
            <span style="font-size:0.8em;">(.pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
            <br>  <br> 
            Gruppe<br>
            <button id="fbtnA" class="swal2-button btn btn-info m-2" style="width: 42px; height: 42px;">A</button>
            <button id="fbtnB" class="swal2-button btn btn-warning m-2" style="width: 42px; height: 42px;filter: grayscale(90%);">B</button>
            <button id="fbtnC" class="swal2-button btn btn-warning m-2" style="padding:0px;width: 42px; height: 42px;filter: grayscale(90%); background: linear-gradient(-60deg, #0dcaf0 50%, #ffc107 50%);">AB</button>
        `
    }
         
    let activeGroup = "a"

    this.$swal.fire({
        title: this.$t("dashboard.filesend"),
        html: htmlcontent,
        icon: "info",
        input: 'file',
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        reverseButtons: true,
        inputAttributes: {
            type: "file",
            name:"files",
            id: "swalFile",
            class:"form-control",
            multiple:"multiple",
            accept: ".pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb"
        },
        didRender: () => {
            const btnA = document.getElementById('fbtnA');
            const btnB = document.getElementById('fbtnB');
            const btnC = document.getElementById('fbtnC');
            if (btnA && !btnA.dataset.listenerAdded) {
                btnA.addEventListener('click', () => {
                    btnA.style.filter = "grayscale(0%)"
                    btnB.style.filter = "grayscale(90%)"
                    btnC.style.filter = "grayscale(90%)"
                    activeGroup = "a"
                });
                btnA.dataset.listenerAdded = 'true';
            }
            if (btnB && !btnB.dataset.listenerAdded) {
                btnB.addEventListener('click', () => {
                    btnA.style.filter = "grayscale(90%)"
                    btnB.style.filter = "grayscale(0%)"
                    btnC.style.filter = "grayscale(90%)"
                    activeGroup = "b"
                });
                btnB.dataset.listenerAdded = 'true';
            }
            if (btnC && !btnC.dataset.listenerAdded) {
                btnC.addEventListener('click', () => {
                    btnA.style.filter = "grayscale(90%)"
                    btnB.style.filter = "grayscale(90%)"
                    btnC.style.filter = "grayscale(0%)"
                    activeGroup = "all"
                });
                btnC.dataset.listenerAdded = 'true';
            }
        }
    })
    .then((input) => {
        this.files = input.value
        if (!this.files) { this.status(this.$t("dashboard.nofiles")); return }
        this.status(this.$t("dashboard.uploadfiles"));

        //create a new form
        const formData = new FormData()
        formData.append('servertoken', this.servertoken);
        formData.append('servername', this.servername);

        for (const i of Object.keys(this.files)) {
            let filename = encodeURIComponent(this.files[i].name) // we need to encode the filename because sending formdata encodes non-ASCII characters in a not reversable way
            formData.append('files', this.files[i], filename)  // single file is sent as object.. multiple files as array..
        }
        
        // group managment - send files to specific group
        if (this.serverstatus.groups && who == "all"){ who = activeGroup}  //nur wenn who == all wurde der allgemeine filesend dialog aufgeruden. who kann auch ein student token sein

        axios({
            method: "post", 
            url: `https://${this.serverip}:${this.serverApiPort}/server/data/upload/${this.servername}/${this.servertoken}/${who}`, 
            data: formData, 
        })
        .then( (response) => {log.info("exmmmanagment @ sendFiles:", response.data) })
        .catch( err =>{ log.error(`${err}`) })
    });    
}


//this just keeps the state of the toggle
function toggleScreenshot(){
    if (this.screenshotinterval == 0) { document.getElementById("screenshotinterval").checked = false }
    else { document.getElementById("screenshotinterval").checked = true}
}






        // show warning
function delfolderquestion(token="all"){
    if (this.studentlist.length === 0) { this.status(this.$t("dashboard.noclients")); return;}
    let text =  this.$t("dashboard.delsure")
    if (token !== "all"){ 
        text = this.$t("dashboard.delsinglesure")
    }
    this.$swal.fire({
        title: this.$t("dashboard.attention"),
        text:  text,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        reverseButtons: true,
    })
    .then((result) => {
        if (result.isConfirmed) {
                // inform student that folder needs to be deleted
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/setstudentstatus/${this.servername}/${this.servertoken}/${token}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify({ delfolder : true } )
            })
            .then( res => res.json() )
            .then( result => { log.info(result)});
        } 
    });  
}




/**
 * Spellcheck for specific student
 * workflow:  es wird durch einen api call an control.js der studentstatus.allowspellcheck gesetzt (object {spellchecklang, suggestions})
 * beim nächsten update holt sich der student den studentstatus und sollte allowspellcheck true sein wird
 * clientinfo.allowspellcheck (communicationhandler.js) gesetzt,  clientinfo holt sich das frontend alle 4 sek.
 * der editor (frontend) sieht dann allowspellcheck und aktiviert mittels IPC invoke (ipchandler.js) dann nodehun() und macht den spellcheckbutton sichtbar
 */
async function activateSpellcheckForStudent(token, clientname){
    const student = this.studentlist.find(obj => obj.token === token);  //get specific student (status)
    console.log(student.status)
    await this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            actions: 'my-swal2-actions'
        },
        title: " ",
        html: `
        <div style="padding: 4px; font-size: 0.9em; text-align: left;">
            <h5>${this.$t("dashboard.allowspellcheck")}</h5>
            <br>
            <input class="form-check-input" type="checkbox" id="checkboxLT">
            <label class="form-check-label" for="checkboxLT"> LanguageTool ${this.$t("dashboard.activate")} </label> <br>
            <input class="form-check-input" type="checkbox" id="checkboxsuggestions">
            <label class="form-check-label" for="checkboxsuggestions"> ${this.$t("dashboard.suggest")} </label>
        </div>`,
        focusConfirm: false,
        didOpen: () => {
            if (student.status.activatePrivateSpellcheck == true){
                document.getElementById('checkboxLT').checked = student.status.activatePrivateSpellcheck
                document.getElementById('checkboxsuggestions').checked = student.status.activatePrivateSuggestions
            }
            else {
                document.getElementById('checkboxLT').checked = false
                document.getElementById('checkboxsuggestions').checked = false
            }   
        }
    }).then(async (input) => {
        if (!input.isConfirmed) {return}

        let suggestions = document.getElementById('checkboxsuggestions').checked;
        let languagetool = document.getElementById('checkboxLT').checked;

        if (!languagetool){
            console.log(`de-activating spellcheck for user: ${clientname} `)
            // inform student that spellcheck can be activated
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/setstudentstatus/${this.servername}/${this.servertoken}/${token}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify({ activatePrivateSpellcheck : false } )
            })
            .then( res => res.json() )
            .then( result => { log.info(result); this.fetchInfo();});
        }
        else {
            console.log(`activating spellcheck for user: ${clientname} `)
    
            let response = await ipcRenderer.invoke("startLanguageTool")        //start languagetool server api
            if (response){
                // this.$swal.fire({
                //     text: "LanguageTool started!",
                //     timer: 1000,
                //     timerProgressBar: true,
                //     didOpen: () => { this.$swal.showLoading() }
                // });
            }
            else {
                this.$swal.fire({
                    text: "LanguageTool Error!",
                    timer: 1000,
                    timerProgressBar: true,
                    didOpen: () => { this.$swal.showLoading() }
                });
            }
            // inform student that spellcheck can be activated
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/setstudentstatus/${this.servername}/${this.servertoken}/${token}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify({ activatePrivateSpellcheck : true, activatePrivateSuggestions: suggestions} )
            })
            .then( res => res.json() )
            .then( result => { log.info(result); this.fetchInfo();});
        }
    })  
}




















export {activateSpellcheckForStudent, delfolderquestion, stopserver, toggleScreenshot, sendFiles, lockscreens, setScreenshotInterval, getFiles, startExam, endExam, kick, restore, setAbgabeInterval  }