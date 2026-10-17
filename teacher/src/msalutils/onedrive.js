import log from 'electron-log/renderer';
// tokens of students with an upload/sharelink attempt already in flight (fetchInfo polls every 4s - never overlap uploads to the same file)
const uploadingStudents = new Set();

// One Graph call. On 401 refresh once and retry. Never clears the Microsoft session.
async function graphFetch(vm, url, options = {}) {
    const send = (token) => fetch(url, {
        method: options.method || 'GET',
        headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
        body: options.body,
    })
    let ensured = await ipcRenderer.invoke('ensureMsAccessToken')
    if (ensured?.accessToken) vm.config.accessToken = ensured.accessToken
    if (!vm.config.accessToken) {
        vm.msConnectionProblem = true
        return null
    }
    try {
        let response = await send(vm.config.accessToken)
        if (response.status === 401) {
            ensured = await ipcRenderer.invoke('ensureMsAccessToken', true)
            if (ensured?.ok && ensured.accessToken) {
                vm.config.accessToken = ensured.accessToken
                response = await send(ensured.accessToken)
            }
        }
        if (response.status === 401) vm.msConnectionProblem = true
        else if (response.ok) vm.msConnectionProblem = false
        return response
    } catch (err) {
        log.error(err)
        vm.msConnectionProblem = true
        return null
    }
}
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
        await this.onedriveUpload(input.value)
    });    
}


    /**
 * SETS student.status.msofficeshare for ALL STUDENTS
 * checks if the the file for every connected student already exists on oneDrive
 * otherwise it will trigger the upload for the specific students and tells the API to set the sharinglink for every student
 */
async function onedriveUpload(file){
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
    if (uploadingStudents.has(student.token)) return
    uploadingStudents.add(student.token)
    try {
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
            sharingLink = await this.createSharingLink(fileExists) //fileExists contains the FILE ID
        } else {
            sharingLink = await this.uploadAndShareFile(fileName, file);
            if (sharingLink) log.info(`onedrive @ onedriveUploadSingle: link created for ${student.clientname}`)
        }
        if (!sharingLink){
            log.warn(`onedrive @ onedriveUploadSingle: no sharing link for ${student.clientname}`)  // happens if file is opened for example
            return
        }

        // WRITE Share link to student info object so it can be retrieved on the next student update 
        // together with the new examtype microsoft365 and directly load and secure the sharinglink
        ipcRenderer.invoke('setStudentStatus', {
            servername: this.servername,
            studenttoken,
            msofficeshare: sharingLink,
        })
            .catch((err) => { log.error(err) })
    });
    } finally {
        uploadingStudents.delete(student.token)
    }
}

/**
 * UPLOADS the current 'msofficeFile' to OneDrive 
 * Returns a SHARE LINK
 * @param {*} targetfilename the filename is the username .xlsx or .docx
 */
async function uploadAndShareFile(targetfilename, file) {
    if (!file){return} //just to be sure

    // Upload the file to the app folder
    const uploadEndpoint = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.servername}/${targetfilename}:/content`;
    const fileUploadResponse = await graphFetch(this, uploadEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
    })
    if (!fileUploadResponse) return false
    const uploaded = await fileUploadResponse.json().catch(() => null)
    const fileId = uploaded?.id;
    if (!fileId) {
        log.warn(`uploadAndShareFile(): PUT failed for ${targetfilename} - ${uploaded?.error?.message ?? 'no file id'}`)
        return false;
    }
    const sharingLink = await this.createSharingLink(fileId)
    return sharingLink;
}


async function createSharingLink(fileId){
    const sharingEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/createLink`;
    const sharingData = {
        type: 'edit', // edit permissions
        scope: 'anonymous' // anyone with the link can edit
    };
    const sharingResponse = await graphFetch(this, sharingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sharingData)
    })
    if (!sharingResponse) return false
    const body = await sharingResponse.json().catch(() => null)
    if (!body?.link?.webUrl) {
        log.warn(`createSharingLink(): ${body?.error?.message ?? 'no link'}`)
        return false
    }
    return body.link.webUrl;
}


/**
 * checks if a given filename exists on onedrive
 * @param {*} fileName usually the username.xlsx  or username.docx
 */
async function fileExistsInAppFolder(fileName) {
    const folderResponse = await graphFetch(this, `https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$filter=name eq '${this.servername}'`)
    if (!folderResponse) return null
    const folderData = await folderResponse.json()
    let folderID = null
    if (folderData.value && folderData.value.length > 0) folderID = folderData.value[0].id
    else if (folderData.error) folderID = folderData.error.code
    else if (folderData.value) folderID = 'notFound'

    if (folderID === "accessDenied") { return 403}
    if (typeof folderID === 'string' && folderID.includes('InvalidAuthenticationToken')) {
        this.msConnectionProblem = true
        return null
    }
    if (folderID === "notFound" || folderID === "" || !folderID) return null

    const appFolderEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${folderID}/search(q='${encodeURIComponent(fileName)}')`;
    const fileResponse = await graphFetch(this, appFolderEndpoint)
    if (!fileResponse) return null
    const response = await fileResponse.json()
    if (response.error && response.error.code.includes("InvalidAuthenticationToken")) {
        log.error("token error")
        this.msConnectionProblem = true
        return null
    }
    if (!response.value) return null
    const hit = response.value.find(file => file.name === fileName);
    return hit ? hit.id : false
}



/**
 *  Fetch all Files from Exam Directory and store them in student folders 
 *  files are identified and distributen only via filename. equals student.clientname
 */

async function downloadFilesFromOneDrive(notify) {
    const folderResponse = await graphFetch(this, `https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$filter=name eq '${this.servername}'`)
    if (!folderResponse) {
        if (notify) this.$swal.fire({ title: this.$t('dashboard.microsoft365'), text: this.$t('dashboard.msConnectionLost'), icon: 'error' })
        return null
    }
    const folderData = await folderResponse.json()
    const folderID = folderData.value?.[0]?.id || null
    if (!folderID) {
        log.error('onedrive @ downloadFilesFromOneDrive: ExamFolder not found in OneDrive Appfolder')
        if (notify && folderData.error) this.$swal.fire({ title: this.$t('dashboard.microsoft365'), text: this.$t('dashboard.msConnectionLost'), icon: 'error' })
        return null
    }

    const listResponse = await graphFetch(this, `https://graph.microsoft.com/v1.0/me/drive/items/${folderID}/children`)
    if (!listResponse) {
        if (notify) this.$swal.fire({ title: this.$t('dashboard.microsoft365'), text: this.$t('dashboard.msConnectionLost'), icon: 'error' })
        return null
    }
    const data = await listResponse.json()
    const files = data.value || []
    for (let student of this.studentlist) {
        for (let file of files) {
            if (file.name === `${student.clientname}.xlsx` || file.name === `${student.clientname}.docx` ){
                ipcRenderer.send('storeOnedriveFiles', {studentName: student.clientname, fileName: file.name, fileID: file.id, accessToken: this.config.accessToken, servername: this.servername })
            }
        }
    }
  }








export {uploadselect, onedriveUpload, onedriveUploadSingle, uploadAndShareFile, createSharingLink, fileExistsInAppFolder, downloadFilesFromOneDrive}