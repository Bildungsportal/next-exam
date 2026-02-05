import axios from "axios"
import FormData from 'form-data'
import log from 'electron-log/renderer';



// enable exam mode 
function startExam(){
 
    setTimeout(() => {
        this.getFiles('all'); //  trigger this one immediately to figure out if there are write problems on student pcs 
    }, 4000); 

    if (this.serverstatus.examSections[this.serverstatus.activeSection].examtype === 'microsoft365') {
        this.setStudentStatus({msofficeshare: false}, 'all');
    }

    this.serverstatus.examSections[this.serverstatus.activeSection].locked = true;   // starting exammode locks the current active section
    this.serverstatus.lockedSection = this.serverstatus.activeSection;
    
    // Gruppenzuordnungen setzen und Schüler informieren
    if (!this.serverstatus.examSections[this.serverstatus.activeSection].groups) {
        // Keine Gruppen aktiviert - alle in Gruppe A
        this.serverstatus.examSections[this.serverstatus.activeSection].groupA.users = this.studentlist.map(student => student.clientname);
        this.setStudentStatus({group:"a"}, 'all');
    } else {
        // Gruppen aktiviert - Schüler gemäß gespeicherter Zuordnung informieren
        this.restoreGroupAssignments(true);
    }

    this.lockscreens(false, false); // deactivate lockscreen
    this.serverstatus.exammode = true;
    log.info("exammanagment @ startExam: starting exammode")
    this.visualfeedback(this.$t("dashboard.startexam"))
    this.setServerStatus()
}


// disable exammode 
function endExam(){
    
    if (this.serverstatus.examSections[this.serverstatus.activeSection].examtype !== 'microsoft365'){
        this.getFiles('all');
    }
    

    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.sure"),
        html: `<div class="my-content">
            <input class="form-check-input" style="margin-top: 0.1em;" type="checkbox" id="checkboxdel">
            <label class="form-check-label" for="checkboxdel"> ${this.$t("dashboard.exitdelete")} </label>
            <br><br>
            <span>${this.$t("dashboard.exitkiosk")}</span>
        </div>`,
        icon: "warning",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        preConfirm: () => {
            this.serverstatus.delfolderonexit = document.getElementById('checkboxdel').checked; 
        }
    })
    .then((result) => {
        if (result.isConfirmed) {
            Object.values(this.serverstatus.examSections).forEach(section => {   section.locked = false    })
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
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.exitexamsure"),
        html: `<div class="my-content" > ${message} <br> </div>`,
        icon: "error",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
    })
    .then( async (result) => {
        if (result.isConfirmed) {

            if (this.serverstatus.bip) {
                console.log("exammanagement @ stopserver: updating server info")
                await this.updateBiPServerInfo("offline");
            }

            await ipcRenderer.invoke("stopserver", this.servername)  // need to stop server first otherwise router.js won't route back

            this.$router.push({  // for some reason this doesn't work on mobile
                name: 'startserver', 
                params:{
                    bipToken: this.bipToken,
                    bipUsername: this.bipUsername,
                    bipuserID:this.bipuserID
                }
            })  
        } 
    });    
}



//remove student from exam
function kick(studenttoken, studentip){
    if ( this.studentlist.length <= 0 ) { this.status(this.$t("dashboard.noclients")); return; }
    
    //get student name
    //console.log("studentlist:", this.studentlist)
    const studentname = this.studentlist.find(student => student.token === studenttoken).clientname
    //console.log("studentname:", studentname)

    let delfolderonexit = false;

    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.sure"),
        html:  `<div class="my-content">
        <span style='font-weight:bold;'>${studentname}</span> ${this.$t("dashboard.reallykick")}
        <br><br>
        
            <input class="form-check-input" style="margin-top: 0.1em;" type="checkbox" id="checkboxdel">
            <label class="form-check-label" for="checkboxdel"> ${this.$t("dashboard.exitdelete")} </label>
           
        </div>
        `,
        icon: "error",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        preConfirm: () => {
            const checkbox = document.getElementById('checkboxdel');
            if (checkbox) {
                delfolderonexit = checkbox.checked;
            }
        }
    })
    .then(async (result) => {
        if (result.isConfirmed) {
 
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/setstudentstatus/${this.servername}/${this.servertoken}/${studenttoken}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify({ delfolder : delfolderonexit, kick : true } )
            })
            .then( res => res.json() )
            .then( result => { log.info("exammanagment @ kick:", result.message)});
        } 
    });  
}



//restore focus state for specific student -- we tell the client that his status is restored which will then (on the next update) update it's focus state on the server 
function restore(studenttoken){
    this.visualfeedback(this.$t("dashboard.restore"),2000)
    axios.get(`https://${this.serverip}:${this.serverApiPort}/server/control/restore/${this.servername}/${this.servertoken}/${studenttoken}`)
        .then( response => { log.info(`exammanagment @ restore:  ${response.data.message}`)  })
        .catch( err => {log.error(`exammanagment @ restore:  ${err}`)});
}



// get finished exams (ABGABE) from students
function getFiles(who='all', feedback=false, quiet=false){
    this.checkDiscspace()
    if ( this.studentlist.length <= 0 ) { this.status(this.$t("dashboard.noclients")); return; }

    if (this.serverstatus.examSections[this.serverstatus.activeSection].examtype === "microsoft365"){ //fetch files from onedrive
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
    let htmlcontent = `<div class="my-content"> 
        ${this.$t("dashboard.filesendtext")} <br>
        <span style="font-size:0.8em;">(.pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
        </div>`

    if (this.serverstatus.examSections[this.serverstatus.activeSection].groups && who == "all"){ //wenn who != "all" sondern ein studenttoken ist dann soll die datei an eine einzelne person gesandt werden
        htmlcontent =  `<div class="my-content"> 
            ${this.$t("dashboard.filesendtext")} <br>
            <span style="font-size:0.8em;">(.pdf, .docx, .bak, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
            <br>  <br> 
            Gruppe<br>
            <button id="fbtnA" class="swal2-button btn btn-info m-2" style="width: 42px; height: 42px;">A</button>
            <button id="fbtnB" class="swal2-button btn btn-warning m-2" style="width: 42px; height: 42px;filter: grayscale(90%);">B</button>
            <button id="fbtnC" class="swal2-button btn btn-warning m-2" style="padding:0px;width: 42px; height: 42px;filter: grayscale(90%); background: linear-gradient(-60deg, #0dcaf0 50%, #ffc107 50%);">AB</button>
        </div>`
    }
         
    let activeGroup = "a"

    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.filesend"),
        html: htmlcontent,
        icon: "info",
        input: 'file',
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        reverseButtons: false,
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
        if (this.serverstatus.examSections[this.serverstatus.activeSection].groups && who == "all"){ who = activeGroup}  //nur wenn who == all wurde der allgemeine filesend dialog aufgeruden. who kann auch ein student token sein

        //console.log(formData)
        axios({
            method: "post", 
            url: `https://${this.serverip}:${this.serverApiPort}/server/data/upload/${this.servername}/${this.servertoken}/${who}`, 
            data: formData, 
        })
        .then( (response) => {log.info("exmmmanagment @ sendFiles:", response.data) })
        .catch( err =>{ log.error(`${err}`) })
    });    
}















        // show warning
function delfolderquestion(event, token="all"){
    if (this.studentlist.length === 0) { this.status(this.$t("dashboard.noclients")); return;}
    let text =  this.$t("dashboard.delsure")

    if (token !== "all"){ 
        text = this.$t("dashboard.delsinglesure")
    }
    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.attention"),
        html:  `<div class="my-content">${text}</div>`,
        icon: "warning",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
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
            .then( result => { log.info("exammanagment @ delfolderquestion:", result.message)});
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
    //console.log(student.status)
    let savedSuggestions = false; // Store checkbox values before dialog closes (Electron 39 compatibility)
    let savedLanguagetool = false;

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
        },
        preConfirm: () => {
            // Save checkbox values before dialog closes (Electron 39 compatibility)
            const checkboxLTElement = document.getElementById('checkboxLT');
            const checkboxSuggestionsElement = document.getElementById('checkboxsuggestions');
            savedLanguagetool = checkboxLTElement ? checkboxLTElement.checked : false;
            savedSuggestions = checkboxSuggestionsElement ? checkboxSuggestionsElement.checked : false;
        }
    }).then(async (input) => {
        if (!input.isConfirmed) {return}

        let suggestions = savedSuggestions; // Use saved value instead of reading from DOM
        let languagetool = savedLanguagetool; // Use saved value instead of reading from DOM

        if (!languagetool){
            console.log(`de-activating spellcheck for user: ${clientname} `)
            // inform student that spellcheck can be activated
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/setstudentstatus/${this.servername}/${this.servertoken}/${token}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify({ activatePrivateSpellcheck : false } )
            })
            .then( res => res.json() )
            .then( result => { log.info("exammanagement @ activatespellcheckforstudent: " ,result.message); this.fetchInfo();});
        }
        else {

            // inform student that spellcheck can be activated
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/setstudentstatus/${this.servername}/${this.servertoken}/${token}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify({ activatePrivateSpellcheck : true, activatePrivateSuggestions: suggestions} )
            })
            .then( res => res.json() )
            .then( result => { log.info("exammanagement @ activatespellcheckforstudent: " ,result.message); this.fetchInfo();});
        }
    })  
}




















export {activateSpellcheckForStudent, delfolderquestion, stopserver, sendFiles, lockscreens, getFiles, startExam, endExam, kick, restore  }