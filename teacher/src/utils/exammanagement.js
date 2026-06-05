import log from 'electron-log/renderer';
import examEventBus from './examEventBus.js'
import { buildExamLogSettingsSnapshot } from './examLogSettings.js'
import { countReachableStudents, isStudentReachable } from './studentPresence.js'



// enable exam mode 
async function startExam(){
 
    setTimeout(() => {
        this.getFiles('all'); //  trigger this one immediately to figure out if there are write problems on student pcs 
    }, 4000); 

    if (this.serverstatus.examSections[this.serverstatus.activeSection].examtype === 'microsoft365') {
        this.setStudentStatus({msofficeshare: false}, 'all');
    }

    const now = Date.now()
    const rawSection = Number(this.serverstatus.activeSection) || 1
    const sectionIndex = Math.min(Math.max(1, rawSection), 4)

    // LocalVM/QEMU hash is computed when selecting the disk (configureLocalVM) – if enabled.
    try {
        const examSection = this.serverstatus.examSections[sectionIndex]
        if (examSection?.examtype === 'localvm') {
            const hasGroups = !!examSection.groups
            const cfgA = examSection?.groupA?.examConfig?.localvm || {}
            const cfgB = examSection?.groupB?.examConfig?.localvm || {}
            const wantsHashA = cfgA.calculateSha256 === true
            const wantsHashB = cfgB.calculateSha256 === true
            if (!hasGroups) {
                if (cfgA.qcow2Name && wantsHashA && !cfgA.qcow2Sha256) {
                    this.status('LocalVM: Hash fehlt – bitte VM-Disk erneut wählen.')
                    return
                }
                if (cfgA.qcow2Name && !wantsHashA && !cfgA.qcow2SizeBytes) {
                    this.status('LocalVM: Dateigröße fehlt – bitte VM-Disk erneut wählen.')
                    return
                }
            } else {
                if (cfgA.qcow2Name && wantsHashA && !cfgA.qcow2Sha256) {
                    this.status('LocalVM: Hash fehlt (Gruppe A) – bitte VM-Disk erneut wählen.')
                    return
                }
                if (cfgB.qcow2Name && wantsHashB && !cfgB.qcow2Sha256) {
                    this.status('LocalVM: Hash fehlt (Gruppe B) – bitte VM-Disk erneut wählen.')
                    return
                }
                if (cfgA.qcow2Name && !wantsHashA && !cfgA.qcow2SizeBytes) {
                    this.status('LocalVM: Dateigröße fehlt (Gruppe A) – bitte VM-Disk erneut wählen.')
                    return
                }
                if (cfgB.qcow2Name && !wantsHashB && !cfgB.qcow2SizeBytes) {
                    this.status('LocalVM: Dateigröße fehlt (Gruppe B) – bitte VM-Disk erneut wählen.')
                    return
                }
            }
        }
    } catch (e) {
        log.error('exammanagement @ startExam: localvm hash missing check failed', e)
        this.status('LocalVM: Konfiguration ungültig.')
        return
    }

    this.serverstatus.examSections[sectionIndex].locked = true;   // starting exammode locks the current active section
    this.serverstatus.lockedSection = sectionIndex;
    this.serverstatus.examSections[sectionIndex].startTs = now
    
    // Set group assignments and notify students
    if (!this.serverstatus.examSections[sectionIndex].groups) {
        // No groups activated - all in group A
        this.serverstatus.examSections[sectionIndex].groupA.users = this.studentlist.map(student => student.clientname);
        this.setStudentStatus({group:"a"}, 'all');
    } else {
        // Groups activated - notify students according to stored assignment
        this.restoreGroupAssignments(true);
    }

    this.lockscreens(false, false, true); // deactivate lockscreen (bypass reachable gate; exam start must update server state)
    this.serverstatus.exammode = true;
    examEventBus.examStart = new Date().toLocaleString('de-DE')
    examEventBus._scheduleSave()
    log.info("exammanagment @ startExam: starting exammode")
    const settingsSnap = buildExamLogSettingsSnapshot(this.serverstatus, sectionIndex)
    examEventBus.push('examstart', {}, settingsSnap ? { settings: settingsSnap } : null)
    this.visualfeedback(this.$t("dashboard.startexam"))
    try {
        const resp = await this.setServerStatus()
        if (resp && resp.status === 'error') {
            log.error('exammanagement @ startExam: setServerStatus rejected', resp.message)
            this.status(resp.message || 'Serverstatus konnte nicht gespeichert werden.')
        }
    } catch (e) {
        log.error('exammanagement @ startExam: setServerStatus failed', e)
        this.status('Server nicht erreichbar (Serverstatus speichern).')
    }
}

function lockSectionForAll(sectionIndex){
    const now = Date.now()
    Object.values(this.serverstatus.examSections).forEach(section => { section.locked = false })
    this.serverstatus.examSections[sectionIndex].locked = true
    this.serverstatus.lockedSection = sectionIndex
    this.serverstatus.examSections[sectionIndex].startTs = now

    if (!this.serverstatus.examSections[sectionIndex].groups) {
        this.serverstatus.examSections[sectionIndex].groupA.users = this.studentlist.map(student => student.clientname)
        this.setStudentStatus({group:"a"}, 'all')
    } else {
        this.restoreGroupAssignments(true)
    }

    this.setStudentStatus({msofficeshare:false}, 'all')
    this.setServerStatus()
}


// disable exammode 
function endExam(){
    
    if (this.serverstatus.examSections[this.serverstatus.activeSection].examtype !== 'microsoft365'){
        this.getFiles('all', false, false, true);
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
            examEventBus.examEnd = new Date().toLocaleString('de-DE')
            examEventBus._scheduleSave()
            examEventBus.push('examend')
            this.lockscreens(false, false, true); // deactivate lockscreen (bypass reachable gate; exam end must update server state)
            this.setServerStatus()
        }
    });
}


/** 
 * Stop and Exit Exam Server Instance
 */
async function stopserver(){

    if (this.hostip){  this.getFiles('all', false, false, true) }      // fetch files from students before ending exam for everybody - this takes up to 8 seconds and may fail - so this is just a emergency backup and should be properly handled by the teacher
    let message = this.$t("dashboard.exitexam")
    if (!this.serverstatus.exammode) { message = this.$t("dashboard.exitexaminfo")}

    const now = Date.now()
    let freshSubmissions = Array.isArray(this.submissions) ? this.submissions : []
    const warnSubmissions = activeSectionUsesAbgabeSubmissionWarnings(this.serverstatus)
    if (warnSubmissions) {
        try {
            if (typeof window !== 'undefined' && window.ipcRenderer?.invoke) {
                freshSubmissions = await window.ipcRenderer.invoke('getSubmissions', this.servername, JSON.stringify(this.serverstatus))
                if (Array.isArray(freshSubmissions)) this.submissions = freshSubmissions
            }
        } catch (e) {
            log.error('exammanagement @ stopserver: getSubmissions failed', e)
        }
    }

    const showMissingSubmissionBanner = warnSubmissions && anyReachableStudentLacksSubmission(this.studentlist, freshSubmissions, now)
    const missingSubmissionBanner = showMissingSubmissionBanner ? `
        <div role="alert" style="margin:0 0 1rem 0;padding:0.85rem 1rem;border:3px solid #ffc107;background:transparent;color:inherit;font-weight:700;font-size:1.05em;line-height:1.35;border-radius:6px;text-align:left;">
            ${this.$t('dashboard.stopserverMissingSubmissionWarning')}
        </div>` : ''

    const bipCompletedHtml = this.serverstatus?.bip ? `
            <input class="form-check-input" style="margin-top: 0.1em;" type="checkbox" id="checkboxcompleted">
            <label class="form-check-label" for="checkboxcompleted"> ${this.$t("dashboard.exitbipcompleted")} </label>
        ` : '';

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
        html: `<div class="my-content">
            ${missingSubmissionBanner}
            <span> ${message} </span>
            <br><br>
            ${bipCompletedHtml}
        </div>`,
        icon: "error",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        preConfirm: () => {
            const checkbox = document.getElementById('checkboxcompleted');
            if (this.serverstatus?.bip && checkbox?.checked) {
                this.bipPhase = 'completed';
            }
        }
    })
    .then( async (result) => {
        if (result.isConfirmed) {

            if (this.serverstatus.bip) {
                console.log("exammanagement @ stopserver: updating server info")
                await this.updateBiPServerInfo("offline");
            }

            examEventBus.push('serverstop')
            await examEventBus._save()  // save synchronously before navigation
            examEventBus.clearMemory()
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

// Returns whether getSubmissions data shows at least one PDF in ABGABE for this student (any section).
function clientHasSubmissionOnDisk(submissions, clientname) {
    if (!Array.isArray(submissions) || !clientname) return false
    const row = submissions.find((s) => s.studentName === clientname)
    if (!row?.sections) return false
    for (let section = 1; section <= 4; section++) {
        if (row.sections[section]?.path) return true
    }
    return false
}

// Returns true if any heartbeat-reachable student has no PDF submission in the scan.
function anyReachableStudentLacksSubmission(studentlist, submissions, now) {
    if (!Array.isArray(studentlist) || studentlist.length === 0) return false
    return studentlist.some((s) => isStudentReachable(s, now) && !clientHasSubmissionOnDisk(submissions, s.clientname))
}

// True when active section is editor or activesheets (PDF ABGABE flow); submission kick/stop warnings apply only then.
function activeSectionUsesAbgabeSubmissionWarnings(serverstatus) {
    const t = serverstatus?.examSections?.[serverstatus?.activeSection]?.examtype
    return t === 'editor' || t === 'activesheets'
}


//remove student from exam
async function kick(studenttoken, studentip){
    if ( this.studentlist.length <= 0 ) { this.status(this.$t("dashboard.noclients")); return; }

    const studentRow = this.studentlist.find(student => student.token === studenttoken)
    if (!studentRow) { this.status(this.$t("dashboard.noclients")); return; }
    const studentname = studentRow.clientname

    let delfolderonexit = false;

    let freshSubmissions = Array.isArray(this.submissions) ? this.submissions : []
    const warnSubmissions = activeSectionUsesAbgabeSubmissionWarnings(this.serverstatus)
    if (warnSubmissions) {
        try {
            if (typeof window !== 'undefined' && window.ipcRenderer?.invoke) {
                freshSubmissions = await window.ipcRenderer.invoke('getSubmissions', this.servername, JSON.stringify(this.serverstatus))
                if (Array.isArray(freshSubmissions)) this.submissions = freshSubmissions
            }
        } catch (e) {
            log.error('exammanagement @ kick: getSubmissions failed', e)
        }
    }

    const hasSubmission = !warnSubmissions || clientHasSubmissionOnDisk(freshSubmissions, studentname)
    const noSubmissionBanner = hasSubmission ? '' : `
        <div role="alert" style="margin:0 0 1rem 0;padding:0.85rem 1rem;border:3px solid #ffc107;background:transparent;color:inherit;font-weight:700;font-size:1.05em;line-height:1.35;border-radius:6px;text-align:left;">
            ${this.$t('dashboard.kickNoSubmissionWarning')}
        </div>`

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
        ${noSubmissionBanner}
        <span style='font-weight:bold;'>${studentname}</span> ${this.$t("dashboard.reallykick")}
        <br><br>
        
            <input class="form-check-input" style="margin-top: 0.1em;" type="checkbox" id="checkboxdel">
            <label class="form-check-label" for="checkboxdel"> ${this.$t("dashboard.exitdeletesingle")} </label>
           
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
            const kickedStudent = this.studentlist.find(s => s.token === studenttoken)
            console.log('[examlog] kick:', kickedStudent?.clientname, 'events before:', examEventBus.events.length)
            if (kickedStudent) examEventBus.push('kick', kickedStudent)
            ipcRenderer.invoke('setStudentStatus', {
                servername: this.servername,
                studenttoken,
                delfolder: delfolderonexit,
                sendlog: true,
                kick: true,
            })
                .then((result) => { log.info('exammanagment @ kick:', result.message) })
        }
    });
}



//restore focus state for specific student -- we tell the client that his status is restored which will then (on the next update) update it's focus state on the server 
function restore(studenttoken){
    this.visualfeedback(this.$t("dashboard.restore"),2000)
    ipcRenderer.invoke('setStudentStatus', {
        servername: this.servername,
        studenttoken,
        restorefocusstate: true,
    })
        .then((data) => { log.info(`exammanagment @ restore:  ${data.message}`) })
        .catch((err) => { log.error(`exammanagment @ restore:  ${err}`) })
}



// get finished exams (ABGABE) from students
function getFiles(who='all', feedback=false, quiet=false, includeStudentLog=false){
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
        ipcRenderer.invoke('setStudentStatus', {
            servername: this.servername,
            studenttoken: who,
            sendexam: true,
            sendlog: includeStudentLog,
        })
            .then((data) => {
                if (data.status === 'error') {
                    throw new Error(data.message || 'setStudentStatus failed')
                }
                if (feedback) {
                    this.visualfeedback(data.message, 2000)
                } else if (!quiet) {
                    this.status(data.message)
                }
            })
            .catch((error) => {
                log.error(error)
            })
    }
}




// temporarily lock screens (bypassReachableGate: start/end exam must toggle flags even if heartbeats are stale)
function lockscreens(state, feedback=true, bypassReachableGate=false){
    const now = Date.now();
    if (bypassReachableGate) {
        if (this.studentlist.length === 0) { this.status(this.$t("dashboard.noclients")); return; }
    } else if (countReachableStudents(this.studentlist, now) === 0) {
        this.status(this.$t("dashboard.noclients")); return;
    }
    if (state === false) { this.serverstatus.screenslocked = false; if (feedback) { this.visualfeedback(this.$t("dashboard.unlock")); } }   // the feedback interferes with endexam screen
    else { this.serverstatus.screenslocked = true; this.visualfeedback(this.$t("dashboard.lock"))} 
    this.setServerStatus()
}




//upload files to all students
function sendFiles(who) {
    const now = Date.now();
    if (who === 'all') {
        if (countReachableStudents(this.studentlist, now) === 0) { this.status(this.$t("dashboard.noclients")); return; }
    } else {
        const st = this.studentlist.find((s) => s.token === who);
        if (!isStudentReachable(st, now)) { this.status(this.$t("dashboard.noclients")); return; }
    }
    let htmlcontent = `<div class="my-content"> 
        ${this.$t("dashboard.filesendtext")} <br>
        <span style="font-size:0.8em;">(.pdf, .docx, .odt, .htm, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
        </div>`

    if (this.serverstatus.examSections[this.serverstatus.activeSection].groups && who == "all"){ //wenn who != "all" sondern ein studenttoken ist dann soll die datei an eine einzelne person gesandt werden
        htmlcontent =  `<div class="my-content"> 
            ${this.$t("dashboard.filesendtext")} <br>
            <span style="font-size:0.8em;">(.pdf, .docx, .odt, .htm, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb)</span>
            <br>  <br> 
            Gruppe<br>
            <button id="fbtnA" class="swal2-button btn btn-cyan m-2" style="width: 42px; height: 42px;">A</button>
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
            accept: ".pdf, .docx, .odt, .htm, .ogg, .wav, .mp3, .jpg, .png, .gif, .ggb"
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
    .then(async (input) => {
        this.files = input.value
        if (!this.files) { this.status(this.$t("dashboard.nofiles")); return }
        this.status(this.$t("dashboard.uploadfiles"));

        const filesPayload = []
        for (const i of Object.keys(this.files)) {
            const f = this.files[i]
            const ab = await f.arrayBuffer()
            filesPayload.push({ name: f.name, data: new Uint8Array(ab) })
        }

        // group managment - send files to specific group
        let whoParam = who
        if (this.serverstatus.examSections[this.serverstatus.activeSection].groups && who == "all"){ whoParam = activeGroup}  //nur wenn who == all wurde der allgemeine filesend dialog aufgeruden. who kann auch ein student token sein

        window.ipcRenderer.invoke('uploadTeacherFiles', {
            servername: this.servername,
            servertoken: this.servertoken,
            who: whoParam,
            files: filesPayload,
        })
        .then( (data) => {log.info("exmmmanagment @ sendFiles:", data) })
        .catch( err =>{ log.error(`${err}`) })
    });    
}















        // show warning (widget calls delfolderquestion(token) so first arg is the token string, not a DOM event)
function delfolderquestion(event, token="all"){
    const effectiveToken = typeof event === 'string' ? event : token;
    const now = Date.now();
    if (effectiveToken === 'all') {
        if (countReachableStudents(this.studentlist, now) === 0) { this.status(this.$t("dashboard.noclients")); return; }
    } else {
        const st = this.studentlist.find((s) => s.token === effectiveToken);
        if (!isStudentReachable(st, now)) { this.status(this.$t("dashboard.noclients")); return; }
    }
    let text =  this.$t("dashboard.delsure")

    if (effectiveToken !== "all"){
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
            ipcRenderer.invoke('setStudentStatus', {
                servername: this.servername,
                studenttoken: effectiveToken,
                delfolder: true,
            })
                .then((result) => { log.info('exammanagment @ delfolderquestion:', result.message) })
        } 
    });  
}




/**
 * Spellcheck for specific student
 * workflow:  an api call to control.js sets studentstatus.allowspellcheck (object {spellchecklang, suggestions})
 * on the next update the student fetches the studentstatus and if allowspellcheck is true
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
            ipcRenderer.invoke('setStudentStatus', {
                servername: this.servername,
                studenttoken: token,
                activatePrivateSpellcheck: false,
            })
                .then((result) => { log.info('exammanagement @ activatespellcheckforstudent:', result.message); this.fetchInfo() })
        }
        else {

            // inform student that spellcheck can be activated
            ipcRenderer.invoke('setStudentStatus', {
                servername: this.servername,
                studenttoken: token,
                activatePrivateSpellcheck: true,
                activatePrivateSuggestions: suggestions,
            })
                .then((result) => { log.info('exammanagement @ activatespellcheckforstudent:', result.message); this.fetchInfo() })
        }
    })  
}




















export {activateSpellcheckForStudent, delfolderquestion, stopserver, sendFiles, lockscreens, getFiles, startExam, lockSectionForAll, endExam, kick, restore  }
