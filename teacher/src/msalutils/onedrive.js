import log from 'electron-log/renderer';



//upload file to authorized onedrive "next-exam" appfolder
async function uploadselect() {
    this.$swal.fire({
        title: this.$t("dashboard.officefilesend"),
        text: this.$t("dashboard.officefilesendtext"),
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
            accept: ".xlsx, .docx",
        },
        html: `<div>
            <input class="form-check-input" type="checkbox" id="replace" name="replace">
                <label class="form-check-label" for="checkboxsuggestions"> ${this.$t("dashboard.replace")} </label> <br>
            </div>`,
        preConfirm: () => {
            // Get checkbox value before dialog closes
            const replaceCheckbox = document.getElementById('replace');
            if (replaceCheckbox) {
                this.replaceMSOfile = replaceCheckbox.checked;
            } else {
                this.replaceMSOfile = false;
            }
        }
    })
    .then(async (input) => {
        if (!input.value) { this.status(this.$t("dashboard.nofiles")); return }
        
        //should we replace all files in the teachers onedrive folder for this exam name? (careful this could delete all of the students work - download it in addition to the lokal workfolder!
        // replaceMSOfile is already set in preConfirm before dialog closes 
        this.status(this.$t("dashboard.uploadfiles"));

        //check for allowed file extension again
        const fileExtension = input.value.name.split('.').pop().toLowerCase();
        if (fileExtension !== 'xlsx' && fileExtension !== 'docx') {
            this.$swal.fire({
            title: this.$t("dashboard.invalid_file"),
            text: this.$t("dashboard.invalid_file_text"),
            icon: 'error',
            });
            return;
        }

        this.visualfeedbackClosemanually(this.$t("dashboard.uploadfiles"))
        await this.onedriveUpload(input.value)  //this can take a while if 30 students are connected - set this.serverstatus.msOfficeFile only after it finished because it activates the "startexam" button
        //save valid file info for other students that connect later or reconnect (they all should get a file in onedrive and a sharing link if not 'none')
        this.serverstatus.examSections[this.serverstatus.activeSection].msOfficeFile = input.value   
        log.info(this.serverstatus.examSections[this.serverstatus.activeSection].msOfficeFile)
        log.info("upload to onedrive and sharelink setup finished")
    });    
}


    /**
 * SETS student.status.msofficeshare for ALL STUDENTS
 * checks if the the file for every connected student already exists on oneDrive
 * otherwise it will trigger the upload for the specific students and tells the API to set the sharinglink for every student
 */
async function onedriveUpload(file){
    if (this.studentlist.length == 0){ log.info("no students connected - upload delayed")}
   
    for (let student of this.studentlist){
        //reuse onedriveUploadSingle() here (but check replaceMSOfile)
        this.onedriveUploadSingle(student,file)
    }
}


/**
 * SETS student.status.msofficeshare for ONE STUDENT
 * checks if the the file for every connected student already exists on oneDrive
 * otherwise it will trigger the upload for the specific students and tells the API to set the sharinglink for every student
 */
async function onedriveUploadSingle(student,file){
    let studenttoken = student.token
    //log.info(file)
    let fileName = ""
    if (file.name.endsWith('.docx')){
        fileName =  `${student.clientname}.docx`
    }
    else if (file.name.endsWith('.xlsx')){
        fileName =  `${student.clientname}.xlsx`
    }
    else {
        this.$swal.fire({
            title: this.$t("dashboard.invalid_file"),
            text: this.$t("dashboard.invalid_file_text"),
            icon: 'error',
            });
        return;
    }
    
    await this.fileExistsInAppFolder(fileName).then(async fileExists => {
        let sharingLink = false

        // handle first onedrive api access problems when we try to access the appfolder
        if (fileExists == 403) { 
            log.warn("Access Denied! Contact your organizations Administrator to grant Access to Next-Exam" )
            this.$swal.fire({
                title: this.$t("dashboard.accessDenied"),
                text: this.$t("dashboard.accessDeniedtext"),
                icon: 'error',
                });
            document.getElementById('examtype2').checked = true; this.examtype = "math"; this.serverstatus.examSections[this.serverstatus.activeSection].examtype = "math"
            return   // it makes no sense to try other things. access was denied and needs to be granted in https://entra.microsoft.com/
        }

        if (fileExists && this.replaceMSOfile === false) {
            //we can set/get the sharing link from an existing file as often as neccessary - it will stay the same
            sharingLink = await this.createSharingLink(fileExists) //if file exists fileExists will contain the FILE ID
            log.info(`onedriveUpload(): File "${fileName}" exists`, sharingLink);
        } else {
            sharingLink = await this.uploadAndShareFile(fileName, file);
            log.info('onedriveUpload(): Link created:', sharingLink);
        }
        if (!sharingLink){
            log.warn("some students couldn't receive a sharing link")  // happens if file is opened for example
            return
        }

        // WRITE Share link to student info ojbect so it can be retrieved on the next student update 
        // together with the new examtype microsoft365 and directly load and secure the sharinglink
        fetch(`https://${this.serverip}:${this.serverApiPort}/server/control/sharelink/${this.servername}/${this.servertoken}/${studenttoken}`, { 
            method: 'POST',
            headers: {'Content-Type': 'application/json' },
            body: JSON.stringify({ sharelink: sharingLink  })
            })
        .then( res => res.json())
        .then( response => {log.info(response.message) })
        .catch(err => { log.error(err) })
    });
}

/**
 * UPLOADS the current 'msofficeFile' to OneDrive 
 * Returns a SHARE LINK
 * @param {*} targetfilename the filename is the username .xlsx or .docx
 */
async function uploadAndShareFile(targetfilename, file) {
    this.config = await ipcRenderer.invoke('getconfigasync')  // make sure we have an up2date config
    if (!file){return} //just to be sure

    // Upload the file to the app folder
    const uploadEndpoint = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.servername}/${targetfilename}:/content`;
    const fileUploadResponse = await fetch(uploadEndpoint, {
        method: 'PUT',
        headers: new Headers({
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': file.type // Use the file's content type
        }),
        body: file // Send the file directly as the request body
    })
    .then(response => response.json())
    .catch(error=>{log.error(error)});

    // Create a sharing link with edit permissions using the file ID
    const fileId = fileUploadResponse.id; // Retrieve the file ID of the uploaded file
    const sharingLink = await this.createSharingLink(fileId)
    return sharingLink;
}


/**
 * This Method takes a onedrive file ID and RETURNS a SHARE LINK
 * @param {*} fileId the id of a onedrive file which is needed to create a share link
 */
async function createSharingLink(fileId){
    const sharingEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/createLink`;
    const sharingData = {
        type: 'edit', // edit permissions
        scope: 'anonymous' // anyone with the link can edit
    };
    const sharingResponse = await fetch(sharingEndpoint, {
        method: 'POST',
        headers: new Headers({
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
        }),
        body: JSON.stringify(sharingData)
    })
    .then(response => response.json())
    .catch(error => { log.error(error) });
    

    //if (!sharingResponse.link && sharingResponse.link.webUrl) {return false}
    if (!sharingResponse.link) {
        log.warn(sharingResponse.error)
        this.$swal.fire({
            title: `Microsoft Onedrive API - ${sharingResponse.error.innerError.code}` ,
            text: `${sharingResponse.error.message} Contact your Administrator!`,
            icon: 'error',
            timer: 5000,
            showCancelButton: false,
            didOpen: () => { this.$swal.showLoading(); },
        })
        return false
    }
    const sharingLink = sharingResponse.link.webUrl;
    return sharingLink;
}


/**
 * checks if a given filename exists on onedrive
 * @param {*} fileName usually the username.xlsx  or username.docx
 */
async function fileExistsInAppFolder(fileName) {
    this.config = await ipcRenderer.invoke('getconfigasync')

    //get the specific exam subfolder ID
    const folderID = await fetch(`https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$filter=name eq '${this.servername}'`, {
        method: 'GET',
        headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then( data => { 
        if (data.value && data.value.length > 0) {  return data.value[0].id;  } 
        else {
           // log.info(data)
            if (data.error) { return data.error.code;}   // it's either "accessDenied" or "  " 
            if (data.value) { return "notFound"}  
        }
     })
    .catch(err => { 
        log.error(`Get AppRoot error: ${err}`)
    });

    //check if folderID was received correctly
    if (folderID === "accessDenied") { return 403}
    if (folderID === "notFound" || folderID === "")     { log.warn("appfolder does not exist"); return null}
   

 

    //search for file in specific exam subfolder
    const appFolderEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${folderID}/search(q='${encodeURIComponent(fileName)}')`;
    const fileExists = await fetch(appFolderEndpoint, {
        method: 'GET',
        headers: new Headers({'Authorization': `Bearer ${this.config.accessToken}`})
    })
    .then(response => response.json())
    .then( async (response) => {  
        if (response.error && response.error.code.includes("InvalidAuthenticationToken")  ){ // this is usually the first method that accesses onedrive api - thats why we test here
            log.error("token error - resetting token")  //reset token - something is off here!
            this.config = await ipcRenderer.invoke('resetToken')   //reset and update config
        }
        let res =  response.value.some(file => file.name === fileName);
        if (!res){return false}
        else {return response.value[0].id}
    })
    .catch(err => { 
        log.error(err)
        return null
    })
    return fileExists
}



/**
 *  Fetch all Files from Exam Directory and store them in student folders 
 *  files are identified and distributen only via filename. equals student.clientname
 */

async function downloadFilesFromOneDrive() {

    //get the specific exam subfolder ID
    const folderID = await fetch(`https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$filter=name eq '${this.servername}'`, {
        method: 'GET',
        headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then( data => { 
        if (data.value && data.value.length > 0) {  return data.value[0].id;  } 
        else { log.error('onedrive @ downloadFilesFromOneDrive: ExamFolder not found in OneDrive Appfolder'); return null; }
     })
    .catch( async (err) => { 
        log.error("onedrive @ downloadFilesFromOneDrive: ",err.message) 

        // this.$swal.fire({
        //     title: "Microsoft Onedrive Connection",
        //     text: "Verbindung unterbrochen",
        //     icon: 'error',
        //     timer: 3000,
        //     showCancelButton: false,
        //     didOpen: () => { this.$swal.showLoading(); },
        // })

        // // "Unauthorized" Error in der Regel.. microsoft halt.. einfach neu verbinden und gut is
        // this.config = await ipcRenderer.invoke('resetToken')   //reset and update config
        return null;
    });

    // check if folderID was received correctly
    if (folderID == null) { 
        this.$swal.fire({
            title: "Microsoft Onedrive Connection",
            text: "Onedrive Exam Ordner konnte nicht gefunden werden. Verbindung unterbrochen",
            icon: 'error',
            timer: 3000,
            showCancelButton: false,
            didOpen: () => { this.$swal.showLoading(); },
        })

        this.config = await ipcRenderer.invoke('resetToken')   //reset and update config
        return null; 
    }
   

    const appFolderEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${folderID}/children`
    // fetch all files from folder
    await fetch(appFolderEndpoint, {
        headers: {'Authorization': `Bearer ${this.config.accessToken}` },
    })
    .then(response => response.json())
    .then( async data => { 
        const files = data.value;
        //log.info(files)
        // save file for every student (this is done in the backend therefore we trigger an IPC)
        for (let student of this.studentlist) {
            for (let file of files) { // check if there is a file that equals the student name
                if (file.name === `${student.clientname}.xlsx` || file.name === `${student.clientname}.docx` ){  
                    ipcRenderer.send('storeOnedriveFiles', {studentName: student.clientname, fileName: file.name, fileID: file.id, accessToken: this.config.accessToken, servername: this.servername })
                }
            }
        }
        log.info('onedrive @ downloadFilesFromOneDrive: All files downloaded successfully');
    })
    .catch(err => { 
        log.error("onedrive @ downloadFilesFromOneDrive: ", err.message)
    });
  }








export {uploadselect, onedriveUpload, onedriveUploadSingle, uploadAndShareFile, createSharingLink, fileExistsInAppFolder, downloadFilesFromOneDrive}