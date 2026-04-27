import log from 'electron-log/renderer';
import { Buffer } from 'buffer';
import { swalQueued } from './swalQueue.js'


// DASHBOARD EXPLORER

//delete file or folder
function fdelete(file){
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
        html:  `<div class="my-content">${this.$t("dashboard.filedelete")}</div>`,
        icon: "warning",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
    })
    .then((result) => {
        if (result.isConfirmed) {
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/data/delete/${this.servername}/${this.servertoken}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath:file.path })
            })
            .then( res => res.json() )
            .then( result => { 
                log.info(result)
                this.loadFilelist(this.currentdirectory)
            }).catch(err => { log.error(err)});
        }
    })
    .catch(err => { log.error(err)});;
}



// show workfloder  TODO:  the whole workfolder thing is getting to complex.. this should be a standalone vue.js component thats embedded here
function showWorkfolder(){
    this.showExplorer = true;
}



// fetch a file or folder (zip) and open download/save dialog
function downloadFile(file){
    if (file === "current"){   //we want to download the file thats currently displayed in preview
        let a = document.createElement("a");
        // If currentpreview is a blob URL, we need to handle it differently
        if (this.currentpreview.startsWith('blob:')) {
            a.href = this.currentpreview;
        } else {
            // For base64 data URLs, use the original base64 content
            a.href = `data:application/pdf;base64,${this.currentpreviewBase64}`;
        }
        a.setAttribute("download", this.currentpreviewname);
        a.click();
        return
    }
    log.info("requesting file for downlod ")
    fetch(`https://${this.serverip}:${this.serverApiPort}/server/data/download/${this.servername}/${this.servertoken}`, { 
        method: 'POST',
        headers: {'Content-Type': 'application/json' },
        body: JSON.stringify({ filename : file.name, path: file.path, type: file.type})
    })
    .then( res => res.blob() )
    .then( blob => {
            //this is a trick to trigger the download dialog
            let a = document.createElement("a");
            a.href = window.URL.createObjectURL(blob);
            a.setAttribute("download", file.name);
            a.click();
    })
    .catch(err => { log.error(err)});
}







// send a file from dashboard explorer to specific student
function dashboardExplorerSendFile(file){
    const inputOptions = new Promise((resolve) => {  // prepare input options for radio buttons
        let connectedStudents = {}
        this.studentlist.forEach( (student) => { connectedStudents[student.token]=student.clientname });
        resolve(connectedStudents)
    })
    this.$swal.fire({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions'
        },
        title: this.$t("dashboard.choosestudent"),
        input: 'select',
        icon: 'success',
        showCancelButton: true,
        inputOptions: inputOptions,
        inputValidator: (value) => { if (!value) { return this.$t("dashboard.chooserequire") } },
    })
    .then((input) => {
        if (input.isConfirmed) {
            let student = this.studentlist.find(element => element.token === input.value)  // fetch cerrect student that belongs to the token
            fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/sendtoclient/${this.servername}/${this.servertoken}/${student.token}`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                body: JSON.stringify({ files:[ {name:file.name, path:file.path } ] })
            })
            .then( res => res.json() )
            .then( result => { log.info(result)})
            .catch(err => { log.error(err)});
        }
    }).catch(err => { log.error(err)});
}



// fetch file from disc - show preview
function loadPDF(filepath, filename){
    const form = new FormData()
    form.append("filename", filepath)
    //console.log(filepath)
    fetch(`https://${this.serverip}:${this.serverApiPort}/server/data/getpdf/${this.servername}/${this.servertoken}`, { method: 'POST', body: form })
    .then( response => response.arrayBuffer())
    .then( data => {
        URL.revokeObjectURL(this.currentpreview);  //speicher freigeben
     
        let isvalid = isValidPdf(data)
        log.info("filemanager @ loadPDF: pdf is valid: ", isvalid)

        this.currentpreviewBase64 = Buffer.from(data).toString('base64');
        this.currentpreview = URL.createObjectURL(new Blob([data], {type: "application/pdf"}))
        this.currentpreviewname = filename   //needed for preview buttons
        this.currentpreviewPath = filepath
        this.currentpreviewType = "pdf"

        this.activesheetsPreviewPdf = null;
        this.webviewVisible = false;
        document.querySelector("#pdfpreview").style.display = 'block';

    }).catch(err => { log.error(err) });     
}

function isValidPdf(data) {
    const header = new Uint8Array(data, 0, 5); // read the first 5 bytes for "%PDF-"
    // Convert bytes to hex values for comparison
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D]; // "%PDF-" in Hex
    for (let i = 0; i < pdfHeader.length; i++) {
        if (header[i] !== pdfHeader[i]) {
            return false; // early exit if a byte does not match
        }
    }
    return true; // all bytes match the PDF header
}





// fetch file from disc - show preview
function loadImage(file){
    const form = new FormData()
    form.append("filename", file)
    fetch(`https://${this.serverip}:${this.serverApiPort}/server/data/getpdf/${this.servername}/${this.servertoken}`, { method: 'POST', body: form })
        .then( response => response.arrayBuffer())
        .then( data => {
            this.currentpreviewPath = file
            this.currentpreviewname = file.split('/').pop(); //needed for preview buttons
  
            

            this.currentpreviewBase64 = Buffer.from(data).toString('base64');
            this.currentpreviewType = "image"
            this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "image/jpeg"}))
            this.activesheetsPreviewPdf = null;
            this.webviewVisible = false;
            document.querySelector("#pdfpreview").style.display = 'block';
        }).catch(err => { log.error(err)});     
}



// fetches latest files of all connected students in one combined pdf
async function getLatest(){

    let submissions = await ipcRenderer.invoke('getSubmissions', this.servername, JSON.stringify(this.serverstatus))


    this.visualfeedback(this.$t("dashboard.summarizepdf"))
    fetch(`https://${this.serverip}:${this.serverApiPort}/server/data/getlatest/${this.servername}/${this.servertoken}`, { 
        method: 'POST',
        headers: {'Content-Type': 'application/json' },
        body: JSON.stringify({ submissions: submissions })
    })
    .then( response => response.json() )
    .then( async(responseObj) => {
        if (!responseObj.pdfBuffer ){
            log.info("filemanager @ getLatest: latest work not found")
            this.visualfeedback(this.$t("dashboard.nopdf"))
            return
        }
        const warning = responseObj.warning;
        if (warning){
            this.$swal.close();
            this.visualfeedback(this.$t("dashboard.oldpdfwarning",2000))
            await sleep(2000)
        }
        // show pdf
        this.loadPDF(responseObj.pdfPath, "combined.pdf")
        
    }).catch(err => { log.error(err)});
}















/** 
 *  PRINT REQUEST
 *  show info (who sent the request) and wait for confirmation // handle multiple print requests (send "printrequest denied" if there is already an ongoing request)
 *  introduce printlock variable that blocks additional popups
 */
async function processPrintrequest(student){

    if (this.serverstatus?.directPrintAllowed){
        log.info(`filemanager @ managePrintrequest: direct print from ${student.clientname} accepted`)
        this.status(`Druckauftrag von ${student.clientname} verarbeitet`)
       
        this.printBase64(student.printrequest, 'pdf', `${student.clientname}.pdf`)
        return                   //if direct print is allowed this task ends here
    }

    // If there already is an ongoing printrequest - deny and delete printrequest
    if (this.printrequest){  // inform student that request was denied
        log.info("filemanager @ managePrintrequest: decline ")
        this.setStudentStatus({printdenied:true}, student.token)
        return                    //print denied because the teacher is already reviewing another one
    }




    //print allowed block others for now
    this.printrequest = student.clientname // we allow it and block others for the time beeing (we store student name to compare in dashboard)
    log.info(`filemanager @ managePrintrequest: print request from ${student.clientname} accepted`)
    

    swalQueued({
        customClass: {
            popup: 'my-popup',
            title: 'my-title',
            content: 'my-content',
            input: 'my-custom-input',
            inputLabel: 'my-input-label',
            actions: 'my-swal2-actions',
            htmlContainer: 'my-html-container'
        },
        title: this.$t("dashboard.printrequest"),
        html:  `<div class="my-content">Von:<b> ${student.clientname}</b> <br><br>${this.$t("dashboard.printrequestshow")}</div>`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        confirmButtonColor: '#0aa2c0',
    })
    .then((result) => {
        this.printrequest = false // allow new requests
        if (result.isConfirmed) {
         
            // show pdf preview
        
            this.currentpreviewBase64 = student.printrequest
            this.currentpreview = `data:application/pdf;base64,${this.currentpreviewBase64}`;
            this.currentpreviewname = `${student.clientname}.pdf`;  // needed for the preview buttons
            this.currentpreviewType = "pdf";
            
            this.activesheetsPreviewPdf = null;
            this.webviewVisible = false;
            document.querySelector("#pdfpreview").style.display = 'block';
        }
        else {
            this.setStudentStatus({printdenied:true}, student.token)  //inform student that request was denied
        }
    }).catch(err => { log.error(err)});
}





// show base64 encoded pdf in preview panel
function showBase64FilePreview(base64, filename){

    this.urlForWebview = null;
    this.webviewVisible = false;

    this.currentpreviewBase64 = base64
    this.currentpreviewType = "pdf";
    this.currentpreviewname = filename

    // Convert base64 to blob URL
    try {
        // Remove data URL prefix if present
        let cleanBase64 = base64;
        if (base64.includes(',')) {
            cleanBase64 = base64.split(',')[1];
        }
        
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        this.currentpreview = blobUrl;
    } catch (error) {
        console.error('Error converting base64 to blob:', error);
        // Fallback: use the original base64 string
        this.currentpreview = base64;
    }

    this.activesheetsPreviewPdf = null;
    document.querySelector("#pdfpreview").style.display = 'block';
}



// show base64 encoded PDF in PdfRenderer component
function showBase64PdfInRenderer(base64, filename, group){
    if (group) {
        this.activesheetsPreviewGroup = group;
        const section = this.serverstatus.examSections[this.serverstatus.activeSection];
        const fileObj = group === 'B' ? section.groupB?.examConfig?.activeSheets : section.groupA?.examConfig?.activeSheets;
        this.activesheetsPreviewCustomFields = fileObj?.customFields ? JSON.parse(JSON.stringify(fileObj.customFields)) : [];
        this.activesheetsPreviewBlacklist = fileObj?.blacklist ? [...fileObj.blacklist] : [];
    }

    this.activesheetsPreviewFilename = filename;
    this.activesheetsPreviewPdf = base64;
    this.currentpreview = null;
    this.webviewVisible = false;
    document.querySelector("#pdfpreview").style.display = 'block';
}

// show base64 encoded image in preview panel
function showBase64ImagePreview(base64, filename){

    this.urlForWebview = null;
    this.webviewVisible = false;

    this.currentpreviewBase64 = base64
    this.currentpreview = `${this.currentpreviewBase64}`;
    this.currentpreviewType = "image";
    this.currentpreviewname = filename
    
    this.activesheetsPreviewPdf = null;
    document.querySelector("#pdfpreview").style.display = 'block';
}







async function openLatestFolder(student){
    const response = await ipcRenderer.invoke("getLatestBakFile", this.servername, student.clientname)
    if (response.latestBackupDirectoryPath){
        this.loadFilelist(response.latestBackupDirectoryPath)
        this.showWorkfolder()
    }       
    else {
        this.loadFilelist(this.workdirectory)
        this.showWorkfolder()
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}




//print pdf in focus - uses window.print()
async function printBase64(documentBase64 = this.currentpreviewBase64, type = this.currentpreviewType, jobTitle) {
    if (!this.defaultPrinter){
        this.showSetup()
        return
    }
    const title = (jobTitle != null && String(jobTitle).trim() !== '')
        ? String(jobTitle).trim()
        : (this.currentpreviewname && String(this.currentpreviewname).trim()) || 'Next-Exam'
    this.visualfeedback(this.$t('dashboard.printJobSent'))
    try {
        await ipcRenderer.invoke('printBase64', documentBase64, this.defaultPrinter, type, title)
    } catch (e) {
        log.error(`filemanager @ printBase64: ${e.message}`)
    }
}


function loadFilelist(directory){
    fetch(`https://${this.serverip}:${this.serverApiPort}/server/data/getfiles/${this.servername}/${this.servertoken}`, { 
        method: 'POST',
        headers: {'Content-Type': 'application/json' },
        body: JSON.stringify({ dir : directory})
    })
    .then( response => response.json() )
    .then( filelist => {
        //log.error(filelist)
        const pinnedDirs = ['ABGABE', 'screenshots'];
        filelist.sort((a, b) => {
            const aPin = a.type === 'dir' && pinnedDirs.includes(a.name) ? 0 : (a.type === 'dir' ? 1 : 2);
            const bPin = b.type === 'dir' && pinnedDirs.includes(b.name) ? 0 : (b.type === 'dir' ? 1 : 2);
            if (aPin !== bPin) return aPin - bPin;
            return a.name.localeCompare(b.name);
        })
        this.localfiles = filelist;
        this.currentdirectory = directory
        this.currentdirectoryparent = filelist[filelist.length-1].parentdirectory // the currentdirectory and parentdirectory properties are always on [0]
        if (directory === this.workdirectory) {this.showWorkfolder(); }
    }).catch(err => { log.error(err)});
}
 
export {loadFilelist, getLatest, processPrintrequest, loadImage, loadPDF, dashboardExplorerSendFile, downloadFile, showWorkfolder, fdelete, openLatestFolder, printBase64, showBase64FilePreview, showBase64ImagePreview, showBase64PdfInRenderer}