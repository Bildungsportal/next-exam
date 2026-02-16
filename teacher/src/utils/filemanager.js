import log from 'electron-log/renderer';
import { Buffer } from 'buffer';


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
    document.querySelector("#preview").style.display = "block";
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

        const pdfEmbed = document.querySelector("#pdfembed");
        pdfEmbed.style.backgroundImage = '';
        pdfEmbed.style.height = "85vh";
        pdfEmbed.style.width = "60vw";
        pdfEmbed.style.display = 'block';
        
        this.webviewVisible = false;

        document.querySelector("#pdfembed").setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0&zoom=160`);
        document.querySelector("#pdfpreview").style.display = 'block';
        document.querySelector("#openPDF").style.display = 'block';
        document.querySelector("#downloadPDF").style.display = 'block';
        document.querySelector("#printPDF").style.display = 'block';
        document.querySelector("#closePDF").style.display = 'block';
        document.querySelector("#pdfrenderer").style.display = 'none';

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
            
            // clear the pdf viewer
            pdfEmbed.setAttribute("src", "about:blank");
            
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
            
            pdfEmbed.style.display = 'block';
            this.webviewVisible = false;
        
            document.querySelector("#pdfpreview").style.display = 'block'; 
            document.querySelector("#openPDF").style.display = 'block';
            document.querySelector("#downloadPDF").style.display = 'block';
            document.querySelector("#printPDF").style.display = 'block'; 
            document.querySelector("#closePDF").style.display = 'block';
            document.querySelector("#pdfrenderer").style.display = 'none';
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
    log.info(`filemanager @ managePrintrequest: print request from ${student.clientname} accepted`)
    

    this.$swal.fire({
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
    })
    .then((result) => {
        this.printrequest = false // allow new requests
        if (result.isConfirmed) {
         
            // show pdf preview
        
            this.currentpreviewBase64 = student.printrequest
            this.currentpreview = `data:application/pdf;base64,${this.currentpreviewBase64}`;
            this.currentpreviewname = `${student.clientname}.pdf`;  // Wird für die Vorschau-Buttons benötigt
            this.currentpreviewType = "pdf";
            
            // PDF in das Embed-Element laden
            const pdfEmbed = document.querySelector("#pdfembed");
            pdfEmbed.style.backgroundImage = '';
            pdfEmbed.style.height = "95vh";
            pdfEmbed.style.width = "60vw";
            pdfEmbed.style.display = 'block';
            
            this.webviewVisible = false;

            pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0&zoom=160`);
            document.querySelector("#pdfpreview").style.display = 'block';
            document.querySelector("#openPDF").style.display = 'none';
            document.querySelector("#downloadPDF").style.display = 'block';
            document.querySelector("#printPDF").style.display = 'block';
            document.querySelector("#closePDF").style.display = 'block';
            document.querySelector("#pdfrenderer").style.display = 'none';
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

    const pdfEmbed = document.querySelector("#pdfembed");
    pdfEmbed.style.backgroundImage = '';
    pdfEmbed.style.height = "85vh";
    pdfEmbed.style.width = "60vw";
    
    pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0&zoom=160`);
    document.querySelector("#pdfpreview").style.display = 'block';
    document.querySelector("#openPDF").style.display = 'none';
    document.querySelector("#downloadPDF").style.display = 'none';
    document.querySelector("#pdfembed").style.display = 'block';
    document.querySelector("#printPDF").style.display = 'none';
    document.querySelector("#pdfrenderer").style.display = 'none';
    document.querySelector("#closePDF").style.display = 'block';
}



// show base64 encoded PDF in PdfRenderer component
function showBase64PdfInRenderer(base64, filename){
    // Set the preview PDF data for PdfRenderer component
    this.activesheetsPreviewPdf = base64;
    this.activesheetsPreviewFilename = filename;
    
    // Find the file in examInstructionFiles and load customFields
    const section = this.serverstatus.examSections[this.serverstatus.activeSection];
    let fileObj = null;
    let group = null;
    let fileIndex = -1;
    
    // Search in groupA
    if (section.groupA && section.groupA.examInstructionFiles) {
        const index = section.groupA.examInstructionFiles.findIndex(f => f.filename === filename);
        if (index !== -1) {
            fileObj = section.groupA.examInstructionFiles[index];
            group = 'A';
            fileIndex = index;
        }
    }
    
    // Search in groupB if not found in groupA
    if (!fileObj && section.groupB && section.groupB.examInstructionFiles) {
        const index = section.groupB.examInstructionFiles.findIndex(f => f.filename === filename);
        if (index !== -1) {
            fileObj = section.groupB.examInstructionFiles[index];
            group = 'B';
            fileIndex = index;
        }
    }
    
    // Load customFields from file or set empty array
    this.activesheetsPreviewCustomFields = fileObj && fileObj.customFields ? JSON.parse(JSON.stringify(fileObj.customFields)) : [];
    this.activesheetsPreviewGroup = group;
    this.activesheetsPreviewFileIndex = fileIndex;
    
    // Hide other preview components
    this.webviewVisible = false;
    const pdfEmbed = document.querySelector("#pdfembed");
    if (pdfEmbed) {
        pdfEmbed.setAttribute("src", "about:blank");
        pdfEmbed.style.display = 'none';
    }
    
    // Hide other preview buttons
    const openPDF = document.querySelector("#openPDF");
    const downloadPDF = document.querySelector("#downloadPDF");
    const printPDF = document.querySelector("#printPDF");
    const closePDF = document.querySelector("#closePDF");
    const pdfRenderer = document.querySelector("#pdfrenderer");
    if (pdfRenderer) {
        pdfRenderer.style.display = 'flex';
    }


    if (openPDF) openPDF.style.display = 'none';
    if (downloadPDF) downloadPDF.style.display = 'none';
    if (printPDF) printPDF.style.display = 'none';
    if (closePDF) closePDF.style.display = 'none';
    
    // Show the PDF preview pane (PdfRenderer will be shown if activesheetsPreviewPdf is set)
    const pdfPreview = document.querySelector("#pdfpreview");
    if (pdfPreview) {
        pdfPreview.style.display = 'block';
    }
}

// show base64 encoded image in preview panel
function showBase64ImagePreview(base64, filename){

    this.urlForWebview = null;
    this.webviewVisible = false;

    const pdfEmbed = document.querySelector("#pdfembed");
    pdfEmbed.setAttribute("src", "about:blank"); // clear the pdf viewer

    this.currentpreviewBase64 = base64
    this.currentpreview = `${this.currentpreviewBase64}`;
    this.currentpreviewType = "image";
    this.currentpreviewname = filename

    // create demo image object to calculate width and height
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
    
    //hide show some buttons
    document.querySelector("#pdfembed").style.display = 'block';
    document.querySelector("#pdfpreview").style.display = 'block';
    document.querySelector("#openPDF").style.display = 'none';
    document.querySelector("#downloadPDF").style.display = 'none';
    document.querySelector("#printPDF").style.display = 'none';
    document.querySelector("#closePDF").style.display = 'block';
    document.querySelector("#pdfrenderer").style.display = 'none';
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
async function printBase64(documentBase64 = this.currentpreviewBase64, type=this.currentpreviewType){   //use currentpreview or a given base64 document
    if (!this.defaultPrinter){
        this.showSetup()
        return
    }
    this.visualfeedback(`Druckauftrag an Drucker übertragen`)
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
 
export {loadFilelist, getLatest, processPrintrequest, loadImage, loadPDF, dashboardExplorerSendFile, downloadFile, showWorkfolder, fdelete, openLatestFolder, printBase64, showBase64FilePreview, showBase64ImagePreview, showBase64PdfInRenderer}