
/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * 
 * This program is free software: you can redistribute it and/or modify it 
 * under the terms of the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or any later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 * 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>
 */

import { Router } from 'express'
const router = Router()
import path  from 'path'
import config from '../../../../main/config.js'
import fs from 'fs' 
import extract from 'extract-zip'
import i18n from '../../../../../src/locales/locales.js'
const { t } = i18n.global
import archiver from 'archiver'
import { PDFDocument, rgb } from 'pdf-lib/dist/pdf-lib.js'  // we import the complied version otherwise we get 1000 sourcemap warnings
import log from 'electron-log';
import moment from 'moment';
import pdf from '@bingsjs/pdf-parse';
import {
    decryptBufferIfNeeded,
    decryptNxe1FilesUnderDir,
} from '../../../../main/scripts/examFileCryptoContext.js';


/**
 * GET a FILE-LIST from workdirectory
 */ 
 router.post('/getfiles/:servername/:token', async function (req, res, next) {
    const token = req.params.token
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const dir =req.body.dir
    
    if ( token !== mcServer.serverinfo.servertoken ) { return res.json({ status: t("data.tokennotvalid") }) }
   
    let folders = []
    folders.push( {currentdirectory: dir, parentdirectory: path.dirname(dir)}) // so this information is always on filelist[0] >> not the most robust idea but used in fileexplorer - be careful
    
    const omitExtensions = ['.json'];   // these filetypes are not part of the filelist sent to the frontend (used to display the user directories in the fileexplorer part of the dashboard)
    

    try {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
            const filepath = path.join(dir, file);
            let ext = path.extname(file).toLowerCase();
            
            try {
                const stats = await fs.promises.stat(filepath);
                if (stats.isDirectory()) {
                    folders.push({ path: filepath, name: file, type: "dir", ext: "", parent: dir });
                }
                else if (stats.isFile() && !omitExtensions.includes(ext)) {
                    folders.push({ path: filepath, name: file, type: "file", ext: ext, parent: dir }); // Fixed `parent: ''` to `parent: dir` for consistency
                }
            } catch (innerErr) {
                // Handle errors thrown by fs.promises.stat
                console.error("data @ getfiles: Error accessing file or directory: ", innerErr);
            }
        }
    } catch (err) {
        // Behandeln Sie Fehler, die von fs.promises.readdir geworfen werden
        console.error("data @ getfiles: Fehler beim Lesen des Verzeichnisses: ", err);
        return res.status(500).json({ status: "error", message: t("data.fileerror") });
    }
    return res.send( folders )
})





/**
 * CREATE COMBINED PDF START >>>>>>>>>>>>>>>>>>
 */

// Copy exam-root artifact into backupdirectory/<servername>/ when backup path is set.
async function mirrorExamRootFileToBackup(servername, basename, data) {
    if (!config.backupdirectory) return
    const backupExamDir = path.join(config.backupdirectory, servername)
    try {
        await fs.promises.mkdir(backupExamDir, { recursive: true })
        await fs.promises.writeFile(path.join(backupExamDir, basename), data)
    } catch (err) {
        log.error(`data @ mirrorExamRootFileToBackup: ${basename}`, err)
    }
}

/**
 * GET a latest work from all students
 * This API Route creates a list of the latest pdf filepaths of all connected students
 * and concats each of the pdfs to one
 */ 
 router.post('/getlatest/:servername/:token', async function (req, res, next) {
    const token = req.params.token
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const submissions = req.body.submissions
    let warning = false

    // check if this is a legit call from the teacher frontend
    if ( token !== mcServer.serverinfo.servertoken ) { return res.json({ status: t("data.tokennotvalid") }) }


       

    //create array that contains only filepaths
    // we iterate over the submissions array and get the latest filepaths for each section
    let latestFiles = []
    for (let student of submissions) {
        for (let section = 1; section <= 4; section++) {
            if (student.sections[section].path){
                latestFiles.push(student.sections[section].path)
            }
        }
    }
    console.log("data @ getlatest: latestFiles", latestFiles)

    // now create one merged pdf out of all files
    if (latestFiles.length === 0) {
        return res.json({warning: warning, pdfBuffer: null})
    }
    else {
        let indexPDFdata = await createIndexPDF(submissions, servername, mcServer)   //contains the index table pdf as uint8array
        let indexPDFpath = path.join(config.workdirectory, mcServer.serverinfo.servername,"index.pdf")
        try {
            await fs.promises.writeFile(indexPDFpath, indexPDFdata);
            log.info('data @ getlatest: Index PDF saved successfully!');
            await mirrorExamRootFileToBackup(mcServer.serverinfo.servername, 'index.pdf', indexPDFdata)
        }
        catch(err){log.error("data @ getlatest:",err)}
        latestFiles.unshift(indexPDFpath)


        // now concat the pdfs of all sections to one combined pdf
        let PDF = await concatPages(mcServer, latestFiles)
        let pdfBuffer = Buffer.from(PDF) 
        let pdfPath = path.join(config.workdirectory, mcServer.serverinfo.servername,"combined.pdf")
        try {
            await fs.promises.writeFile(pdfPath, pdfBuffer);
            log.info('data @ getlatest: PDF saved successfully!');
            await mirrorExamRootFileToBackup(mcServer.serverinfo.servername, 'combined.pdf', pdfBuffer)
        }
        catch(err){log.error("data @ getlatest:",err)}
        return res.json({warning: warning, pdfBuffer:pdfBuffer, pdfPath:pdfPath });
    }
})










function isValidPdf(data) {
    const header = new Uint8Array(data, 0, 5); // read the first 5 bytes for "%PDF-"
    // Convert bytes to hex values for comparison
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D]; // "%PDF-" in Hex
    for (let i = 0; i < pdfHeader.length; i++) {
        if (header[i] !== pdfHeader[i]) {
            log.warn('data @ isValidPdf: invalid PDF processed')
            return false; // early exit if a byte does not match
        }
    }
    return true; // all bytes match the PDF header
}

async function countCharsOfPDF(mcServer, pdfPath, studentname, servername){
    const raw = await fs.promises.readFile(pdfPath);// Read the PDF file
    const dataBuffer = mcServer ? decryptBufferIfNeeded(raw, mcServer, 'data @ countCharsOfPDF') : raw;
    let chars = 0 

    if (isValidPdf(dataBuffer)){
        chars = await pdf(dataBuffer).then( data => {    // Parse the PDF  // data.text contains all the text extracted from the PDF
            if (data && data.text && studentname) {   
                let numberOfCharacters = data.text.length;
                //console.log(`Number of characters in the PDF: ${numberOfCharacters}`, studentname, servername);

                let header = ` ${servername} | 10.10.24, 10:10 `
                let footer = ` Zeichen: 10 | Wörter: 10  1/1 `   //approximately

                numberOfCharacters = numberOfCharacters // - header.length - studentname.length - footer.length // -5 for average name length  // for msword option - there is no header here


                //we try to filter out the important part of the document that shows the actual number of chars
                let regex = /Zeichen: (\d+)/;
                let matches = data.text.match(regex);
                let zeichenAnzahl = matches ? matches[1] : "notfound";
               
                if (zeichenAnzahl !== "notfound"){   //we found it !
                    return zeichenAnzahl
                }
                else {
                    regex = /Zeichen:(\d+)/;  //try slightly different regex because some pdfs (probably from mac) remove spaces when read
                    matches = data.text.match(regex);
                    zeichenAnzahl = matches ? matches[1] : "notfound";
                    if (zeichenAnzahl !== "notfound"){  // now we found it
                        return zeichenAnzahl
                    }
                    else {
                        console.log(data.text)
                        return numberOfCharacters >= 0 ? `~ ${numberOfCharacters}` : '~ 0';
                    }
                }
            }
            else {
                return 0
            }
    
        })
        .catch(err => {log.error(`data @ countCharsOfPDF: ${err}`); return 0  });
    }
    else {
        chars = "no pdf"
    }
 
    return chars 
}







async function createIndexPDF(submissions, servername, mcServer){
    let tabledata = [["Name", "Abschnitt", "Datum", "Zeichen", "Dateiname"]]
    for (const student of submissions){
        let hasSubmission = false // track if student has at least one submission
        const trimmedName = student.studentName.length > 20 ? student.studentName.slice(0, 20) + "..." : student.studentName
        for (let section = 1; section <= 4; section++) {
            let name = "-"
            let sectionName = "-"
            let time = "-"
            let chars = "0"
            let filename = "-"

            if (student.sections[section].path){
                name = trimmedName;
                sectionName = student.sections[section].sectionname || `Abschnitt ${section}`
                sectionName = sectionName.length > 20 ? sectionName.slice(0, 20) + "..." : sectionName;
                time = moment(student.sections[section].date).format('DD.MM.YYYY HH:mm')
                chars = await countCharsOfPDF(mcServer, student.sections[section].path, student.studentName, servername)
                filename = student.sections[section].filename.length > 25 ? student.sections[section].filename.slice(0, 25) + "..." : student.sections[section].filename ;
                tabledata.push([ name, sectionName, time, chars, filename ])
                hasSubmission = true
            }
        }
        if (!hasSubmission) {
            tabledata.push([ trimmedName, "", "", "", "" ])
        }
    }
    
    const pdfDoc = await PDFDocument.create();// Create a new PDFDocument
    const page = pdfDoc.addPage(); // Add a page to the document

    // Set up table dimensions and styles
    const startX = 50; // X-coordinate where the table starts
    const startY = page.getHeight() - 50; // Y-coordinate where the table starts (from top)
    const rowHeight = 15; // Height of each row (reduced for smaller font size)
    const columnWidths = [110, 130, 80, 40, 140]; // Width of each column: Name, Abschnitt, Datum, Zeichen, Dateiname

    // Function to draw a cell
    const drawCell = (x, y, width, height) => { page.drawRectangle({ x, y, width, height, borderColor: rgb(0, 0, 0),  borderWidth: 1,  });  };
    // Function to add text to a cell
    const addText = (text, x, y) => {  text = String(text);    page.drawText(text, { x, y, size: 9, color: rgb(0, 0, 0),  });  };

    tabledata.forEach((row, rowIndex) => {
        const yPos = startY - rowIndex * rowHeight; // Calculate Y position for the current row
        row.forEach((cellText, columnIndex) => {
            const xPos = startX + columnWidths.slice(0, columnIndex).reduce((acc, val) => acc + val, 0); // Calculate X position for the current cell
            drawCell(xPos, yPos - rowHeight, columnWidths[columnIndex], rowHeight);
            addText(cellText, xPos + 3, yPos - rowHeight + 4); // Adjust text position within the cell (reduced padding for smaller row height)
        });
    });
    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();
    return pdfBytes 
}


/**
 * CREATE COMBINED PDF END >>>>>>>>>>>>>>>>>>
 */


























async function concatPages(mcServer, pdfsToMerge) {
    // Create a new PDFDocument
    const tempPDF = await PDFDocument.create();
    for (const pdfpath of pdfsToMerge) { 
        const raw = await fs.promises.readFile(pdfpath);
        let pdfBytes = mcServer ? decryptBufferIfNeeded(raw, mcServer, 'data @ concatPages') : raw;
        //check if this actually is a pdf
        if (isValidPdf(pdfBytes)){
            const pdf = await PDFDocument.load(pdfBytes); 
            const copiedPages = await tempPDF.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => {
                tempPDF.addPage(page); 
            }); 
        }
       
    } 
    // Serialize the PDFDocument to bytes (a Uint8Array)
    const finalPDF = await tempPDF.save()
    return finalPDF
}











/**
 * DELETE File from EXAM directory
 */ 
 router.post('/delete/:servername/:token', async function (req, res, next) {
    const token = req.params.token
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    if ( token !== mcServer.serverinfo.servertoken ) { return res.json({ status: t("data.tokennotvalid") }) }

  
    const filepath = req.body.filepath
    if (filepath) { //return specific file
        try {
            const stats = await fs.promises.stat(filepath);
            if (stats.isDirectory()){
                await fs.promises.rm(filepath, { recursive: true, force: true });
            }
            else {
                await fs.promises.unlink(filepath);
            }
            res.json({ status:"success", sender: "server", message:t("data.fdeleted"),  })
        } catch (err) {
            log.error("data @ delete:", err);
            res.status(500).json({ status:"error", sender: "server", message:t("data.fileerror") })
        }
    }
})





/**
 * GET PDF from EXAM directory
 * @param filename if set the content of the file is returned
 */ 

router.post('/getpdf/:servername/:token', function (req, res, next) {
    const { token, servername } = req.params;
    const mcServer = config.examServerList[servername];

    // Check whether mcServer exists and the token matches
    if (!mcServer || token !== mcServer.serverinfo?.servertoken) {
        return res.json({ status: t("data.tokennotvalid") });
    }

    const { filename } = req.body;
    if (filename) {
        fs.readFile(filename, (err, data) => {
            if (err) {
                log.error(err);
                return res.status(404).json({ status: t("data.fileerror") });
            }
            const out = decryptBufferIfNeeded(data, mcServer, 'data @ getpdf');
            const ext = path.extname(filename).toLowerCase();
            if (ext === '.pdf') res.setHeader('Content-Type', 'application/pdf');
            res.send(out);
        });
    } else {
        // Antwort, falls kein Dateiname angegeben wurde
        res.status(400).json({ status: t("data.fileerror") });
    }
});






/**
 * GET ANY File/Folder from EXAM directory - download !
 * Can be triggered by TEACHER (dashboard explorer) or STUDENT (filerequest)
 * @param filename if set the content of the file is returned
 */ 
 router.post('/download/:servername/:token', async (req, res, next) => {
    const token = req.params.token
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const type = req.body.type  // file, dir, studentfilerequest
    const filename = req.body.filename
    const filepath = req.body.path
    const files = req.body.files  // in case of studentfilerequest 'files' is an array of fileobjects [ {name:file.name, path:file.path }, {name:file.name, path:file.path } ] 

    if ( token !== mcServer.serverinfo.servertoken && !checkToken(token, mcServer )) { return res.json({ status: t("data.tokennotvalid") }) }
   

   
    if (type === "studentfilerequest") {
        // if this request came from a student reset studentstatus
        let student = mcServer.studentList.find(element => element.token === token) // get student from token
        if (student) {  
            student.status['fetchfiles'] = false  //reset filerequest status for student // it is theoretically possible that the client sends a second file request and fetches the file twice before this setting is reset but i guess this doen't really matter
            student.status['files'] = []          // therer is no control system in place to re-check if the file was actually received
            res.zip({files: files});  
        } 
    }  
    else if (type === "file") {
            res.setHeader('Content-disposition', 'attachment; filename=' + filename);
            if (token === mcServer.serverinfo.servertoken) {
                fs.promises.readFile(filepath).then((data) => {
                    const out = decryptBufferIfNeeded(data, mcServer, 'data @ download');
                    res.send(out);
                }).catch((err) => {
                    log.error('data @ download', err);
                    res.status(404).json({ status: t("data.fileerror") });
                });
            } else {
                res.download(filepath);
            }
    }
    else if (type === "dir") {
        //zip folder and then send
        let zipfilename = filename.concat('.zip')
        let zipfilepath = path.join(config.tempdirectory, zipfilename);
        await zipDirectory(filepath, zipfilepath)
        res.setHeader('Content-disposition', 'attachment; filename=' + filename);
        res.download(zipfilepath,filename); 
    }
 
})

/**
 * Download a QEMU qcow2 disk from teacher workdir/QEMU (student only).
 * URL is used by students to fetch missing LocalVM disk.
 */
router.get('/qemu/:servername/:token/:filename', async (req, res) => {
    const token = req.params.token
    const servername = req.params.servername
    const filenameRaw = req.params.filename
    const mcServer = config.examServerList[servername]
    if (!mcServer) { return res.status(404).json({ status: "error", sender: "server", message: "server not found" }) }
    if (token !== mcServer.serverinfo.servertoken && !checkToken(token, mcServer)) { return res.status(403).json({ status: t("data.tokennotvalid") }) }

    const filename = path.basename(String(filenameRaw || ''))
    if (!filename || filename !== String(filenameRaw || '')) {
        return res.status(400).json({ status: "error", sender: "server", message: "invalid filename" })
    }
    if (!filename.toLowerCase().endsWith('.qcow2')) {
        return res.status(400).json({ status: "error", sender: "server", message: "invalid file type" })
    }

    const qemuDir = path.join(config.workdirectory, 'QEMU')
    const resolvedDir = path.resolve(qemuDir)
    const filePath = path.resolve(path.join(qemuDir, filename))
    if (!filePath.startsWith(resolvedDir + path.sep)) {
        return res.status(400).json({ status: "error", sender: "server", message: "invalid path" })
    }

    try {
        await fs.promises.access(filePath, fs.constants.R_OK)
    } catch (e) {
        return res.status(404).json({ status: "error", sender: "server", message: "file not found" })
    }

    res.setHeader('Content-disposition', 'attachment; filename=' + filename)
    return res.download(filePath)
})





router.post('/getexammaterials/:servername/:token', async (req, res, next) => {
    const token = req.params.token
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const group = req.body.group
    const clientLockedSection = req.body.lockedSection

    if ( token !== mcServer.serverinfo.servertoken && !checkToken(token, mcServer )) { return res.json({ status: t("data.tokennotvalid") }) }
   

    let student = mcServer.studentList.find(element => element.token === token) // get student from token
    if (student) {  

        let serverstatus = mcServer.serverstatus
        const sectionIndex = serverstatus.allowSectionSwitch && clientLockedSection != null ? clientLockedSection : serverstatus.activeSection
        let examSection = serverstatus.examSections[sectionIndex]
        let groupA = examSection.groupA
        let groupB = examSection.groupB
    
        let materials = []
        let allowedUrls = []
        if (group === "a") {
            materials = groupA.examInstructionFiles
            allowedUrls = groupA.allowedUrls
        }
        else if (group === "b") {
            materials = groupB.examInstructionFiles
            allowedUrls = groupB.allowedUrls
        }


        res.json({ status:"success", sender: "server", materials: materials, allowedUrls: allowedUrls  })
    } 
    else {
        res.json({ status:"error", sender: "server", message:t("data.tokennotvalid")  })
    }
    

 
})










/**
 * Stores file(s) to the workdirectory (files coming FROM CLIENTS (BACKUPS) )
 * @param studenttoken the students token - this has to be valid (coming from a registered user) 
 * @param servername the server-exam instance the students token belongs to
 * in order to process the request - DO NOT STORE FILES COMING from anywhere.. always check if token belongs to a registered student (or server)
 */
 router.post('/receive/:servername/:studenttoken', async (req, res, next) => {  
    const studenttoken = req.params.studenttoken
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const { file, filename, lastExamWriteSaveReason } = req.body;
    const fileContent = Buffer.from(file, 'base64');
    const zipSaveTag = typeof lastExamWriteSaveReason === 'string' ? lastExamWriteSaveReason : 'n/a';

    if ( !checkToken(studenttoken, mcServer ) ) { res.json({ status: t("data.tokennotvalid") }) }
    else {
        let errors = 0
        const now = new Date();
        let time = now.toLocaleTimeString('de-DE');  //convert to locale string otherwise the foldernames will be created in UTC
        let timestring = String(time).replace(/:/g, "_");
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Monate: 0-11, daher +1
        const day = String(now.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;
        
        let tstring = `${dateString}_${timestring}`;
        
        let student = mcServer.studentList.find(element => element.token === studenttoken) // get student from token
        let absoluteFilepath = path.join(config.workdirectory, mcServer.serverinfo.servername, student.clientname, filename);
        let studentdirectory =  path.join(config.workdirectory, mcServer.serverinfo.servername, student.clientname)
        
        let studentarchivedir = path.join(studentdirectory, tstring)
        try {
            await fs.promises.mkdir(studentdirectory, { recursive: true });
            await fs.promises.mkdir(studentarchivedir, { recursive: true });
        }
        catch (err) {
            log.error("data @ receive: ", err)
        }

        if (file){

            if (filename.includes(".zip")){
                log.info("data @ receive: Received ZIP File from user:", student.clientname, "lastExamWriteSaveReason=", zipSaveTag)
                let success = await archiveAndExtractZip(absoluteFilepath, studentarchivedir, fileContent, mcServer)
                
                if (config.backupdirectory && success){     // copy to backup directory - do not unzip a second time - this is already done in archiveAndExtractZip
                    
                    let backupdir =  path.join(config.backupdirectory, mcServer.serverinfo.servername, student.clientname, tstring) // same concept as in studentarchivedir
                    log.info(`data @ receive: Copying to backup directory: ${studentarchivedir} ->   ${backupdir} `)
                    try {
                        await fs.promises.mkdir(backupdir, { recursive: true });
                        await fs.promises.cp(studentarchivedir, backupdir, { recursive: true })
                    }
                    catch (err) {
                        log.error("data @ receive: ", err)
                    }
                }
                res.json({ status:"success", sender: "server", message:"Files received", errors: errors  })
            }
            else {
                log.error("data @ receive: No ZIP file received")
                res.json({ status:"error",  sender: "server", message:"No files received", errors: errors })
            }
        }
        else {
            res.json({ status:"error",  sender: "server", message:"No files received", errors: errors })
        }
    }
})


/**
 * POST next-exam-student.log from client into workdir/<server>/<client>/logfiles/ and mirror to backupdirectory when set
 */
router.post('/studentlog/:servername/:studenttoken', async (req, res, next) => {
    const studenttoken = req.params.studenttoken
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]
    const { file, clientname } = req.body || {}

    if (!mcServer) {
        return res.json({ status: t("data.tokennotvalid"), sender: "server" })
    }
    if (!checkToken(studenttoken, mcServer)) {
        return res.json({ status: t("data.tokennotvalid"), sender: "server" })
    }
    const student = mcServer.studentList.find((s) => s.token === studenttoken)
    if (!student) {
        return res.json({ status: t("data.tokennotvalid"), sender: "server" })
    }
    if (clientname && clientname !== student.clientname) {
        log.warn(`data @ studentlog: clientname mismatch token=${studenttoken}`)
        return res.json({ status: "error", sender: "server", message: "clientname mismatch" })
    }
    if (!file) {
        return res.json({ status: "error", sender: "server", message: "No log file received" })
    }
    let fileContent
    try {
        fileContent = Buffer.from(file, 'base64')
    } catch (e) {
        log.error("data @ studentlog: invalid base64", e)
        return res.json({ status: "error", sender: "server", message: "Invalid file payload" })
    }
    const studentdirectory = path.join(config.workdirectory, mcServer.serverinfo.servername, student.clientname)
    const logdir = path.join(studentdirectory, 'logfiles')
    const destPath = path.join(logdir, 'next-exam-student.log')
    try {
        await fs.promises.mkdir(logdir, { recursive: true })
        await fs.promises.writeFile(destPath, fileContent)
        // Mirror student log to backupdirectory when configured (same relative layout as workdir).
        if (config.backupdirectory) {
            const backupLogdir = path.join(config.backupdirectory, mcServer.serverinfo.servername, student.clientname, 'logfiles')
            const backupDestPath = path.join(backupLogdir, 'next-exam-student.log')
            try {
                await fs.promises.mkdir(backupLogdir, { recursive: true })
                await fs.promises.writeFile(backupDestPath, fileContent)
            } catch (backupErr) {
                log.error("data @ studentlog: backup mirror failed", backupErr)
            }
        }
        log.info(`data @ studentlog: stored log for ${student.clientname}`)
        return res.json({ status: "success", sender: "server", message: "Log received" })
    } catch (err) {
        log.error("data @ studentlog: ", err)
        return res.json({ status: "error", sender: "server", message: String(err && err.message ? err.message : err) })
    }
})


/**
 * UPLOADS Files from the Teacher Frontend and 
 * stores the files into the workdirectory
 * then updates student.status.fetchfiles in order to trigger a filerequest from the student(s) 
 */

router.post('/upload/:servername/:servertoken/:studenttoken', async (req, res, next) => {  
    const servertoken = req.params.servertoken
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const studenttoken = req.params.studenttoken

    if ( servertoken !== mcServer.serverinfo.servertoken ) { return res.json({ status: t("data.tokennotvalid") }) }

    // create uploads directory
    let uploaddirectory =  path.join(config.workdirectory, mcServer.serverinfo.servername, 'UPLOADS')
    try {
        await fs.promises.mkdir(uploaddirectory, { recursive: true });
    } catch (err) {
        // Directory might already exist, that's ok
    }


    if (req.files){

        let filesArray = []  // depending on the number of files this comes as array of objects or object
        if (!Array.isArray(req.files.files)){ filesArray.push(req.files.files)}
        else {filesArray = req.files.files}

        let files = []        
    
        for await (let file of  filesArray) {
            let filename = decodeURIComponent(file.name)  //encode to prevent non-ascii chars weirdness
            let absoluteFilepath = path.join(uploaddirectory, filename);
            await file.mv(absoluteFilepath, (err) => {  
                if (err) { log.error( "Could not store file" ) }
            });
            files.push({ name:filename , path:absoluteFilepath });
        }

        // inform students about this send-file request so that they trigger a download request for the given files
        if (studenttoken === "all"){
            for (let student of mcServer.studentList){ 
                student.status['fetchfiles'] = true  
                student.status['files'] =  files
            }
        }
        else if (studenttoken == "a" || studenttoken == "b"){
            let groupArray = []
            if (studenttoken == "a"){groupArray = mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupA.users }
            if (studenttoken == "b"){groupArray = mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupB.users }

            if (groupArray.length > 0) {
                for (let name of groupArray){
                    let student = mcServer.studentList.find(element => element.clientname === name)
                    if (student) {  
                        student.status['fetchfiles']= true 
                        student.status['files'] = files
                    }   
                }
            }
            else {
                return res.json({ status:"error",  sender: "server", message:"No students found" })
            }
         
        }
        else {
            let student = mcServer.studentList.find(element => element.token === studenttoken)
            if (student) {  
                student.status['fetchfiles']= true 
                student.status['files'] = files
            }   
        }
        res.json({ status:"success", sender: "server", message:"Files uploaded"  })
    }
    else {
        res.json({ status:"error",  sender: "server", message:"No files uploaded" })
    }
    
})



















export default router

// Simple concurrency limiter for ZIP extraction
const MAX_PARALLEL_EXTRACTS = 4; // limit simultaneous extractions to stabilize latency
let runningExtracts = 0;
const extractQueue = [];

function runNextExtract() {
    if (runningExtracts >= MAX_PARALLEL_EXTRACTS) return;
    const job = extractQueue.shift();
    if (!job) return;

    runningExtracts++;
    // const startedAt = Date.now();

    job()
        .catch(() => {})
        .finally(() => {
            // const ms = Date.now() - startedAt;
            // log.info(`data @ extract: finished in ${ms}ms (running=${runningExtracts-1}, queued=${extractQueue.length})`);
            runningExtracts--;
            setImmediate(runNextExtract);
        });
}

async function archiveAndExtractZip(absoluteFilepath, studentarchivedir, fileContent, mcServer){
    // log.info(`data @ receive: Storing Zipfile to ${absoluteFilepath}`)

    return new Promise((resolve) => {
        const exec = async () => {
            try {
                await fs.promises.writeFile(absoluteFilepath, fileContent);

                // log.info(`data @ receive: Extracting Zipfile to ${studentarchivedir}`);
                await extract(absoluteFilepath, {
                    dir: studentarchivedir,
                    onEntry: (entry, zipfile) => {
                        const target = path.normalize(path.join(studentarchivedir, entry.fileName));
                        if (!target.startsWith(path.normalize(studentarchivedir + path.sep))) {
                            zipfile.close();
                            throw new Error('Blocked path traversal: ' + entry.fileName);
                        }
                    }
                });

                try { await fs.promises.unlink(absoluteFilepath); } catch (e) { /* ignore */ }
                log.info(`data @ receive: Successfully extracted ZIP file to ${studentarchivedir}`);
                if (mcServer) {
                    await decryptNxe1FilesUnderDir(studentarchivedir, mcServer, 'data @ receive');
                }
                resolve(true);
            } catch (err) {
                log.error("data @ receive (extract): ", err);
                try { await fs.promises.unlink(absoluteFilepath); } catch (e) { /* ignore */ }
                resolve(false);
            }
        };

        extractQueue.push(exec);
        if (runningExtracts < MAX_PARALLEL_EXTRACTS) setImmediate(runNextExtract);
    });
}

/**
 * Checks if the token is valid in order to process api request
 * Attention: no all api requests check tokens atm!
 */
function checkToken(token, mcserver){
    let tokenexists = false
    // log.info("data @ checkToken: checking if student is registered on this server")
    try {
        mcserver.studentList.forEach( (student) => {
            if (token === student.token) {
                tokenexists = true
            }
        });
    }
    catch(err){
        log.error(`data: ${err}`)
    }

    return tokenexists
}

/**
 * @param {String} sourceDir: /some/folder/to/compress
 * @param {String} outPath: /path/to/created.zip
 * @returns {Promise}
 */
function zipDirectory(sourceDir, outPath) {
    const archive = archiver('zip', { zlib: { level: 9 }});
    const stream = fs.createWriteStream(outPath);
    return new Promise((resolve, reject) => {
      archive
        .directory(sourceDir, false)
        .on('error', err => reject(err))
        .pipe(stream)
      ;
      stream.on('close', () => resolve());
      archive.finalize();
    });
}