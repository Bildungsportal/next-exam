import { Buffer } from 'buffer';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';


// fetch file from disc - show preview
export async function loadPDF(file, base64 = false, zoom=100, submission=false){
    this.currentPDFZoom = zoom
    URL.revokeObjectURL(this.currentpreview);
    
    const pdfEmbed = document.querySelector("#pdfembed");
    pdfEmbed.style.backgroundImage = ``;  // clear a previous image preview
    
    if (base64){
        const response = await fetch(file.filecontent); // lade die Data-URL  //filecontent contains a url data:application/pdf;base64,b23d342dsn2....
        const blob = await response.blob(); // konvertiere in Blob
        this.currentpreview = URL.createObjectURL(blob); // erzeuge Object URL
        this.currentpreviewBase64 = file.filecontent.split(',')[1];  // we only need the base64 data not the complete url
    }
    else {   //fetch file from filesystem
        let data = await ipcRenderer.invoke('getpdfasync', file )
        let isvalid = isValidPdf(data)
        if (!isvalid){
            this.$swal.fire({
                title: this.$t("general.error"),
                text: this.$t("general.nopdf"),
                icon: "error",
                timer: 3000,
                showCancelButton: false,
                didOpen: () => { this.$swal.showLoading(); },
            })
            return
        }
        this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "application/pdf"})) 
        this.currentpreviewBase64 = Buffer.from(data).toString('base64');
    }

    if(!this.splitview){
        pdfEmbed.style.height = "95vh";
        pdfEmbed.style.width = "67vh";  
        pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0&zoom=${this.currentPDFZoom}`);
    }
    else {   // SPLITVIEW
        const zoomInButton = document.getElementById("zoomIn");
        const zoomOutButton = document.getElementById("zoomOut");
        const pdfZoom = document.getElementById("pdfZoom");  //zoombutton container
        pdfZoom.style.display = "block"
        // Entferne bestehende Event-Listener, bevor neue hinzugefügt werden
        zoomInButton.removeEventListener('click', this.zoomInHandler);
        zoomOutButton.removeEventListener('click', this.zoomOutHandler);
        // Definiere neue Event-Listener
        this.zoomInHandler = () => {
            this.currentPDFZoom += 10; // Erhöht den Zoom um 10%
            this.loadPDF(file, base64, this.currentPDFZoom)
        };
        this.zoomOutHandler = () => {
            this.currentPDFZoom = Math.max(10, this.currentPDFZoom - 10); // Verhindert, dass der Zoom unter 10% geht
            this.loadPDF(file, base64, this.currentPDFZoom)
        };
        // Füge die Event-Listener erneut hinzu
        zoomInButton.addEventListener('click', this.zoomInHandler);
        zoomOutButton.addEventListener('click', this.zoomOutHandler);
        // pdf anzeigen
        pdfEmbed.setAttribute("src", `${this.currentpreview}#toolbar=0&navpanes=0&scrollbar=0&zoom=${this.currentPDFZoom}`);
    }
    //hide/show some buttons
    document.querySelector("#preview").style.display = 'block';
    try {
         document.querySelector("#insert-button").style.display = 'none';
        

        if (submission){ 
            document.querySelector("#send-button").style.display = 'flex';
            document.querySelector("#print-button").style.display = 'flex';
         }
        else{ 
            document.querySelector("#send-button").style.display = 'none'; 
            document.querySelector("#print-button").style.display = 'none';
        
        }
    }
    catch(e){}
   
}

//checks if arraybuffer contains a valid pdf file
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


function parseHTMLString(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    doc.querySelectorAll('td').forEach(td => {
        if (!td.innerHTML.trim()) {
        td.innerHTML = '<p></p>'; // Ensure empty cells have a paragraph with a line break
        }
    });
    return doc.body;
}

function processNode(node) {           
    let nodestring = node.innerHTML
    let outernodestring = node.outerHTML
   
    if (nodestring.includes("data:image")){
        for (let childnode of node.childNodes){
            let childnodestring = childnode.outerHTML
            if (childnodestring.includes("data:image")){
                let childnodesource = childnode.src 
               
                this.editor.commands.insertContent(nodestring)
                this.editor.chain().focus().setImage({ src:  childnodesource }).run();
            }
        }
    }
    else if (nodestring.includes("tr")){
        console.log("found table")
        this.editor.commands.insertContent(outernodestring)
    }

    else {
       
        this.editor.commands.insertContent(outernodestring)
    }
}


// get file from local examdirectory and replace editor content with it
export async function loadHTML(file){
    this.LTdisable()
    this.$swal.fire({
        title: this.$t("editor.replace"),
        html:  `${this.$t("editor.replacecontent1")} <b>${file}</b> ${this.$t("editor.replacecontent2")}`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("editor.cancel"),
        reverseButtons: true
    })
    .then(async (result) => {
        if (result.isConfirmed) {
            let data = await ipcRenderer.invoke('getfilesasync', file )
            this.editor.commands.clearContent(true)
            this.editor.commands.insertContent(data)  
        } 
    }); 
}



// get file from local examdirectory and replace editor content with it
export async function loadDOCX(file, base64=false){
    let base64content;
    let filename = file
    if (base64){
        filename = file.filename
        base64content = file.filecontent.split(',')[1];
    }

    this.LTdisable()
    this.$swal.fire({
        title: this.$t("editor.replace"),
        html:  `${this.$t("editor.replacecontent1")} <b>${filename}</b> ${this.$t("editor.replacecontent2")}`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("editor.cancel"),
        reverseButtons: true
    })
    .then(async (result) => {
        if (result.isConfirmed) {
            
            if (base64){
                const response = await fetch(file.filecontent); // Data-URL abrufen
                const arrayBuffer = await response.arrayBuffer(); // ArrayBuffer erstellen

                mammoth.convertToHtml({ arrayBuffer }) // DOCX zu HTML konvertieren
                .then(result => {
                    const html = result.value; // HTML-Ergebnis erhalten
                    this.editor.commands.clearContent(true); // Editor-Inhalt leeren
                    this.editor.commands.insertContent(html); // HTML einfügen
                })
                .catch(error => console.error(error)); // Fehler ausgeben

            }
            else{
                let data = await ipcRenderer.invoke('getfilesasync', file, false, true )   //signal, filename, audiofile, docxfile // converts the file to html in case of docx with mammoth
                this.editor.commands.clearContent(true)
            
                const cleanHtml = DOMPurify.sanitize(data.value);
                const body = parseHTMLString(cleanHtml);
                
                this.editor.commands.insertContent(cleanHtml)
                // body.childNodes.forEach(node => {  processNode(node); });
            }
        
        
        } 
    }); 
}


// fetch file from disc - show preview
export async function loadImage(file, base64=false){
    URL.revokeObjectURL(this.currentpreview);

    
    if (base64){
        const response = await fetch(file.filecontent); // lade die Data-URL  //filecontent contains a url data:application/pdf;base64,b23d342dsn2....
        const blob = await response.blob(); // konvertiere in Blob
        this.currentpreview = URL.createObjectURL(blob); // erzeuge Object URL
        this.currentpreviewBase64 = file.filecontent.split(',')[1];  // we only need the base64 data not the complete url
    }
    else {
        let data = await ipcRenderer.invoke('getpdfasync', file )
        this.currentpreview =  URL.createObjectURL(new Blob([data], {type: "image/jpeg"})) 
        this.currentpreviewBase64 = Buffer.from(data).toString('base64');
    }


    const pdfEmbed = document.querySelector("#pdfembed");
    
    // Create an image element to determine the dimensions of the image
    // always resize the pdfembed div to the same aspect ratio of the given image
    const img = new window.Image();
    img.onload = function() {
        const width = img.width;
        const height = img.height;
        const aspectRatio = width / height;

        const containerWidth = window.innerWidth * 0.8;
        const containerHeight = window.innerHeight * 0.8;
        const containerAspectRatio = containerWidth / containerHeight;

        if(!this.splitview){
            if (aspectRatio > containerAspectRatio) {
                pdfEmbed.style.width = '80vw';
                pdfEmbed.style.height = `calc(80vw / ${aspectRatio})`;
            } else {
                pdfEmbed.style.height = '80vh';
                pdfEmbed.style.width = `calc(80vh * ${aspectRatio})`;
            }
        }
        pdfEmbed.style.backgroundImage = `url(${this.currentpreview})`;
    }.bind(this);
    img.src = this.currentpreview;

    // clear the pdf viewer
    pdfEmbed.setAttribute("src", "about:blank");
    try{
        document.querySelector("#insert-button").style.display = 'flex';
        document.querySelector("#print-button").style.display = 'none';
        document.querySelector("#pdfZoom").style.display = 'none';
        document.querySelector("#send-button").style.display = 'none';
    }
    catch(e){}
    
    document.querySelector("#preview").style.display = 'block'; 
}



/**
 * plays an audiofile
 * either shows dialog with limited amount of replays or player controls if unlimited
 * @param {*} file the name of the audiofile to be played
 */
export async function playAudio(file, base64=false) {
    let audioFile = this.audiofiles.find(obj => obj.name === file);  // search for file in this.audiofiles - get object
    this.LTdisable()  // close langugagetool

    if (!audioFile && base64){
        audioFile = {name: file.filename, playbacks: this.serverstatus.examSections[this.serverstatus.activeSection].audioRepeat}
        this.audiofiles.push(audioFile)
    }

    if (this.serverstatus.examSections[this.serverstatus.activeSection].audioRepeat > 0){
        this.$swal.fire({
            title: audioFile.name,
            text:  this.$t("editor.reallyplay"),
            icon: "question",
            showCancelButton: true,
            cancelButtonText: this.$t("editor.cancel"),
            reverseButtons: true,

            html: audioFile.playbacks > 0 ? `
                
                <span class="col-3" style="">${this.$t("editor.audioremaining")} ${audioFile.playbacks} </span> <br>
                <div id="soundtest" class="btn btn-info btn-sm m-2">Soundtest</div><br>
                <h6>${this.$t("editor.reallyplay")}</h6>
            ` : `
                    <div id="soundtest" class="btn btn-info btn-sm m-2">Soundtest</div><br>
                <span class="col-3" style="">${this.$t("editor.audionotallowed")}</span> 
            `,
            didRender: () => {
                document.getElementById('soundtest').onclick = () => soundtest();
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                if (audioFile.playbacks > 0){
                    try {
                        
                        const base64Data = !base64 ? await ipcRenderer.invoke('getfilesasync', file, true) : file.filecontent.split(',')[1];
                        
                        if (base64Data) {
                            this.audioSource = `data:audio/mp3;base64,${base64Data}`;
                            audioPlayer.load(); // Lädt die neue Quelle
                            audioPlayer.play().then(() => { 
                                console.log('Playback started');
                                audioFile.playbacks -= 1
                            }).catch(e => { console.error('Playback failed:', e); });
                        } else { console.error('Keine Daten empfangen'); }
                    } catch (error) { console.error('Fehler beim Empfangen der MP3-Datei:', error); }   
                }
            } 
        }); 
    }
    if (this.serverstatus.examSections[this.serverstatus.activeSection].audioRepeat == 0){
        document.querySelector("#aplayer").style.display = 'block';
        try {
            
            const base64Data = !base64 ? await ipcRenderer.invoke('getfilesasync', file, true) : file.filecontent.split(',')[1];
            

            if (base64Data) {
                this.audioSource = `data:audio/mpeg;base64,${base64Data}`;
                audioPlayer.load(); // Lädt die neue Quelle
            } else { console.error('Keine Daten empfangen'); }
        } catch (error) { console.error('Fehler beim Empfangen der MP3-Datei:', error); } 
    }
}

async function soundtest(){
    try {
        const base64Data = await ipcRenderer.invoke('getAudioFile', 'attention.wav', true);
        if (base64Data) {
            let soundtest = document.getElementById('soundtest')

            if (soundtest){
                soundtest.classList.add('btn-success')
                soundtest.classList.remove('btn-info')
            }
            
            this.audioSource = `data:audio/mp3;base64,${base64Data}`;
            audioPlayer.load(); // Lädt die neue Quelle
            audioPlayer.play().then(async () => { 
                await this.sleep(2000)
                if (soundtest){
                    soundtest.classList.remove('btn-success')
                    soundtest.classList.add('btn-info')
                }
            }).catch(e => { console.error('Playback failed:', e); });
        } else { console.error('Keine Daten empfangen'); }
    } catch (error) { console.error('Fehler beim Empfangen der MP3-Datei:', error); }   
}




// get file from local examdirectory and replace editor content with it
export async function loadGGB(file, base64=false){
    let filename = file
    if (base64){filename = file.filename}

    this.$swal.fire({
        title: this.$t("editor.replace"),
        html:  `${this.$t("editor.replacecontent1")} <b>${filename}</b> ${this.$t("editor.replacecontent2")}`,
        icon: "question",
        showCancelButton: true,
        cancelButtonText: this.$t("editor.cancel"),
        reverseButtons: true
    })
    .then(async (result) => {
        if (result.isConfirmed) {

            if (!base64){
                const result = await ipcRenderer.invoke('loadGGB', file);
                if (result.status === "success") {
                    const base64GgbFile = result.content;
                    const ggbIframe = document.getElementById('geogebraframe');
                    const ggbApplet = ggbIframe.contentWindow.ggbApplet;
                    ggbApplet.setBase64(base64GgbFile);
                } else {
                    console.error('Error loading file');
                }
            }
            else {
                const base64GgbFile = file.filecontent.split(',')[1];
                const ggbIframe = document.getElementById('geogebraframe');
                const ggbApplet = ggbIframe.contentWindow.ggbApplet;
                ggbApplet.setBase64(base64GgbFile);
            }
        } 
    }); 
}



/**
 * fetch exam materials in base64 from teacher
 */
export async function getExamMaterials(){
    let examMaterials = await ipcRenderer.invoke('getExamMaterials')
    console.log("editor @ getExamMaterials: received examMaterials")
    this.examMaterials = examMaterials.materials
}


