import log from 'electron-log/renderer';
import { Buffer } from 'buffer';


// DASHBOARD EXPLORER

//delete file or folder
function fdelete(file){
    this.$swal.fire({
        title: this.$t("dashboard.sure"),
        text:  this.$t("dashboard.filedelete"),
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        reverseButtons: true
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
    document.querySelector("#preview").style.display = "block";
}



// fetch a file or folder (zip) and open download/save dialog
function downloadFile(file){
    if (file === "current"){   //we want to download the file thats currently displayed in preview
        let a = document.createElement("a");
            a.href = this.currentpreview
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
        title: this.$t("dashboard.choosestudent"),
        input: 'select',
        icon: 'success',
        showCancelButton: true,
        reverseButtons: true,
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

        const pdfEmbed = document.querySelector("#pdfembed");
        pdfEmbed.style.backgroundImage = '';

        pdfEmbed.style.height = "95vh";
        pdfEmbed.style.width = "67vh";

        document.querySelector("#pdfembed").setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0`);
        document.querySelector("#pdfpreview").style.display = 'block';

    }).catch(err => { log.error(err) });     
}

function isValidPdf(data) {
    const header = new Uint8Array(data, 0, 5); // Lese die ersten 5 Bytes für "%PDF-"
    // Umwandlung der Bytes in Hexadezimalwerte für den Vergleich
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D]; // "%PDF-" in Hex
    for (let i = 0; i < pdfHeader.length; i++) {
        if (header[i] !== pdfHeader[i]) {
            return false; // Früher Abbruch, wenn ein Byte nicht übereinstimmt
        }
    }
    return true; // Alle Bytes stimmen mit dem PDF-Header überein
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
            // wanted to save code here but images need to be presented in a different way than pdf.. so...
            const pdfEmbed = document.querySelector("#pdfembed");
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
            document.querySelector("#pdfpreview").style.display = 'block';  
        }).catch(err => { log.error(err)});     
}



// fetches latest files of all connected students in one combined pdf
async function getLatest(){
    this.visualfeedback(this.$t("dashboard.summarizepdf"))
    fetch(`https://${this.serverip}:${this.serverApiPort}/server/data/getlatest/${this.servername}/${this.servertoken}`, { 
        method: 'POST',
        headers: {'Content-Type': 'application/json' },
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

    if (this.directPrintAllowed){
        log.info(`filemanager @ managePrintrequest: direct print from ${student.clientname} accepted`)
        this.status(`Druckauftrag von ${student.clientname} verarbeitet`)
       
        this.printBase64(student.printrequest, 'pdf')
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
    log.info("filemanager @ managePrintrequest: print request accepted")
    

    this.$swal.fire({
        title: this.$t("dashboard.printrequest"),
        html:  `Von:<b> ${student.clientname}</b> <br>${this.$t("dashboard.printrequestshow")}`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("dashboard.cancel"),
        reverseButtons: true
    })
    .then((result) => {
        this.printrequest = false // allow new requests
        if (result.isConfirmed) {
         
            // show pdf preview
        
            this.currentpreviewBase64 = student.printrequest



            this.currentpreview = `data:application/pdf;base64,${this.currentpreviewBase64}`;
            this.currentpreviewname = `${student.clientname}.pdf`;  // Wird für die Vorschau-Buttons benötigt
            //this.currentpreviewPath = filepath;
            this.currentpreviewType = "pdf";
            
            // PDF in das Embed-Element laden
            const pdfEmbed = document.querySelector("#pdfembed");
            pdfEmbed.style.backgroundImage = '';
            pdfEmbed.style.height = "95vh";
            pdfEmbed.style.width = "67vh";
            
            pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0`);
            document.querySelector("#pdfpreview").style.display = 'block';



          
        }
        else {
            this.setStudentStatus({printdenied:true}, student.token)  //inform student that request was denied
        }
    }).catch(err => { log.error(err)});
}















function openLatestFolder(student){
    fetch(`https://${this.serverip}:${this.serverApiPort}/server/data/getLatestFromStudent/${this.servername}/${this.servertoken}/${student.clientname}/${student.token}`, { 
        method: 'POST',
        headers: {'Content-Type': 'application/json' },
    })
    .then( response => response.json() )
    .then( async(responseObj) => {
        log.info(responseObj.latestfolderPath)
        if (responseObj.latestfolderPath === ""){ 
            this.loadFilelist(this.workdirectory)
        }
        else {
            this.loadFilelist(responseObj.latestfolderPath)
        }
        this.showWorkfolder();

    }).catch(err => { log.error(err)});

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


//print pdf in focus - depends on system print dialog
async function print(){
    if (!this.defaultPrinter){
        this.showSetup()
        return
    }
    this.status(`Druckauftrag an Drucker übertragen`)
    ipcRenderer.invoke("printpdf", this.currentpreviewPath, this.defaultPrinter)  //default printer could be set upfront and students may print directly
}

async function printBase64(documentBase64 = this.currentpreviewBase64, type=this.currentpreviewType){   //use currentpreview or a given base64 document
    if (!this.defaultPrinter){
        this.showSetup()
        return
    }
    this.status(`Druckauftrag an Drucker übertragen`)
    ipcRenderer.invoke("printBase64", documentBase64, this.defaultPrinter, type) 
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
        filelist.sort()
        filelist.reverse()
        this.localfiles = filelist;
        this.currentdirectory = directory
        this.currentdirectoryparent = filelist[filelist.length-1].parentdirectory // the currentdirectory and parentdirectory properties are always on [0]
        if (directory === this.workdirectory) {this.showWorkfolder(); }
    }).catch(err => { log.error(err)});
}
 
export {loadFilelist, print, getLatest, processPrintrequest, loadImage, loadPDF, dashboardExplorerSendFile, downloadFile, showWorkfolder, fdelete, openLatestFolder, printBase64  }
