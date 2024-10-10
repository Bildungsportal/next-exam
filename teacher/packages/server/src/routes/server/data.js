
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
import i18n from '../../../../renderer/src/locales/locales.js'
const { t } = i18n.global
import archiver from 'archiver'
import { PDFDocument, rgb } from 'pdf-lib/dist/pdf-lib.js'  // we import the complied version otherwise we get 1000 sourcemap warnings
import log from 'electron-log';
import moment from 'moment';
import pdf from 'pdf-parse';


/**
 * GET a FILE-LIST from workdirectory
 */ 
 router.post('/getfiles/:servername/:token', function (req, res, next) {
    const token = req.params.token
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const dir =req.body.dir
    
    if ( token !== mcServer.serverinfo.servertoken ) { return res.json({ status: t("data.tokennotvalid") }) }
   
    let folders = []
    folders.push( {currentdirectory: dir, parentdirectory: path.dirname(dir)}) // so this information is always on filelist[0] >> not the most robust idea but used in fileexplorer - be careful
    
    const omitExtensions = ['.json'];   // these filetypes are not part of the filelist sent to the frontend (used to display the user directories in the fileexplorer part of the dashboard)
    

    try {
        fs.readdirSync(dir).reduce(function (list, file) {
            const filepath = path.join(dir, file);
            let ext = path.extname(file).toLowerCase();
            
            try {
                if (fs.statSync(filepath).isDirectory()) {
                    folders.push({ path: filepath, name: file, type: "dir", ext: "", parent: dir });
                }
                else if (fs.statSync(filepath).isFile() && !omitExtensions.includes(ext)) {
                    folders.push({ path: filepath, name: file, type: "file", ext: ext, parent: dir }); // Korrigiert `parent: ''` zu `parent: dir` für Konsistenz
                }
            } catch (innerErr) {
                // Behandeln Sie Fehler, die von fs.statSync geworfen werden
                console.error("data @ getfiles: Fehler beim Zugriff auf Datei oder Verzeichnis: ", innerErr);
            }
            
        }, []);
    } catch (err) {
        // Behandeln Sie Fehler, die von fs.readdirSync geworfen werden
        console.error("data @ getfiles: Fehler beim Lesen des Verzeichnisses: ", err);
    }
    return res.send( folders )
})





/**
 * CREATE COMBINED PDF START >>>>>>>>>>>>>>>>>>
 */



/**
 * GET a latest work from all students
 * This API Route creates a list of the latest pdf filepaths of all connected students
 * and concats each of the pdfs to one
 */ 
 router.post('/getlatest/:servername/:token', async function (req, res, next) {
    const token = req.params.token
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    let warning = false

    if ( token !== mcServer.serverinfo.servertoken ) { return res.json({ status: t("data.tokennotvalid") }) }
    let dir =  path.join( config.workdirectory, mcServer.serverinfo.servername);
    // get all studentdirectories from workdirectory
    let studentFolders = []
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        console.error('Der angegebene Pfad existiert nicht oder ist kein Verzeichnis.');
    } 
    else {
        const items = fs.readdirSync(dir, { withFileTypes: true });    // Lese den Inhalt des Hauptordners
        items.forEach(item => {
            if (item.isDirectory() && item.name.toUpperCase() !== 'UPLOADS') {  // Unterordner, außer 'UPLOADS'
                studentFolders.push({ path: path.join(dir, item.name), studentName: item.name });  //foldername == studentname
            }
        });
    }

    // get latest directory of every student 
    for (let studentDir of studentFolders) {
        const items = fs.readdirSync(studentDir.path, { withFileTypes: true });
        let latestModTime = 0;
        let latestFolder = null;
        items.forEach(item => {
            if (item.isDirectory() && item.name.toUpperCase() !== 'FOCUSLOST') {  // Überprüfe, ob das Element ein Verzeichnis ist und nicht 'focuslost' heißt
                const itemPath = path.join(studentDir.path, item.name);
                const stats = fs.statSync(itemPath);
                
               // if (stats.mtimeMs > latestModTime) {   // Überprüfe, ob das aktuelle Verzeichnis das neueste ist //falls modtime ident (copy) check name
                if (stats.mtimeMs > latestModTime || (stats.mtimeMs === latestModTime && item.name > (latestFolder ? latestFolder.name : ''))) {
                    latestModTime = stats.mtimeMs;
                    latestFolder = {
                        path: itemPath,
                        name: item.name,
                        time: latestModTime
                    };
                }
            }
        });
        if (latestFolder) { 
            studentDir.latestFolder = latestFolder;  
            //check if the newest directory is older than 5 minutes.. set warning = true this will show a warning to the teacher!
            const now = Date.now(); // Current time in milliseconds since the UNIX epoch
            const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
            if (now - latestFolder.time > fiveMinutes) {
                warning = true
                log.info(`data @ getlatest: The file is older than 5 minutes: ${latestFolder.path}`);
            } 
        } 
        else { console.error('Keinen gültigen Unterordner gefunden für:', studentDir.studentName); }
    }


    // get PDFs from latest directories 
    for (let studentDir of studentFolders) {
        let latestPDFpath = null
        let selectedFile = '';
        if (studentDir.latestFolder && studentDir.latestFolder.path ){
            try {
                const files = fs.readdirSync(studentDir.latestFolder.path);
               
            
                const csrfFiles = files.filter(file => file.includes('aux') && file.endsWith('.pdf')); // aux is in the name of the file if the original name is locked for some reason 
                const docxFiles = files.filter(file => file.includes('docx') && file.endsWith('.pdf'));
                const xlsxFiles = files.filter(file => file.includes('xlsx') && file.endsWith('.pdf'));
                const exactMatchFile = files.find(file => file === `${studentDir.studentName}.pdf`);  //filename same as folder name.. this would be the "main" pdf
            
                if (csrfFiles.length > 0)      { selectedFile = csrfFiles[0];   } 
                else if (docxFiles.length > 0) { selectedFile = docxFiles[0];   } 
                else if (xlsxFiles.length > 0) { selectedFile = xlsxFiles[0];   } 
                else if (exactMatchFile)       { selectedFile = exactMatchFile; }
            
                latestPDFpath = selectedFile ? path.join(studentDir.latestFolder.path, selectedFile) : null;
                //log.info('data @ getlatestfromstudent: Neueste Datei gefunden: ', latestPDFpath);
            } 
            catch (error) {
                log.error('data @ getlatestfromstudent: Fehler beim Lesen des Verzeichnisses:', error);
                latestPDFpath = null; 
            }
        }
      
        if (fs.existsSync(latestPDFpath)) { 
            studentDir.latestFilePath = latestPDFpath; 
            studentDir.latestFileName = selectedFile  
        }
        else {
            studentDir.latestFilePath = null; 
            studentDir.latestFileName = null  
        }
    }

    //create array that contains only filepaths
    let latestFiles = []
    for (let studentDir of studentFolders) {
        if (studentDir.latestFilePath ){
            latestFiles.push(studentDir.latestFilePath)
        }
    }




    // now create one merged pdf out of all files
    if (latestFiles.length === 0) {
        return res.json({warning: warning, pdfBuffer: null})
    }
    else {
        let indexPDFdata = await createIndexPDF(studentFolders, servername)   //contains the index table pdf as uint8array
        let indexPDFpath = path.join(dir,"index.pdf")
        try {
            fs.writeFileSync(indexPDFpath, indexPDFdata, (err) => {
                if (err) throw err;
                log.info('data @ getlatest: Index PDF saved successfully!');
            });
        }
        catch(err){log.error("data @ getlatest:",err)}
        latestFiles.unshift(indexPDFpath)
        let PDF = await concatPages(latestFiles)
        let pdfBuffer = Buffer.from(PDF) 
        let pdfPath = path.join(dir,"combined.pdf")
        try {
            fs.writeFile(pdfPath, pdfBuffer, (err) => {
                if (err) throw err;
                log.info('data @ getlatest: PDF saved successfully!');
            });
        }
        catch(err){log.error("data @ getlatest:",err)}
        return res.json({warning: warning, pdfBuffer:pdfBuffer, pdfPath:pdfPath });
    }
})






function isValidPdf(data) {
    const header = new Uint8Array(data, 0, 5); // Lese die ersten 5 Bytes für "%PDF-"
    // Umwandlung der Bytes in Hexadezimalwerte für den Vergleich
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D]; // "%PDF-" in Hex
    for (let i = 0; i < pdfHeader.length; i++) {
        if (header[i] !== pdfHeader[i]) {
            log.warn('data @ isValidPdf: invalid PDF processed')
            return false; // Früher Abbruch, wenn ein Byte nicht übereinstimmt
        }
    }
    return true; // Alle Bytes stimmen mit dem PDF-Header überein
}

async function countCharsOfPDF(pdfPath, studentname, servername){
    const dataBuffer = fs.readFileSync(pdfPath);// Read the PDF file
    let chars = 0 

    if (isValidPdf(dataBuffer)){
        chars = await pdf(dataBuffer).then( data => {    // Parse the PDF  // data.text contains all the text extracted from the PDF
            if (data && data.text && studentname) {   
                let numberOfCharacters = data.text.length;
                //console.log(`Number of characters in the PDF: ${numberOfCharacters}`, studentname, servername);

                let header = ` ${servername} | 10.10.24, 10:10 `
                let footer = ` Zeichen: 10 | Wörter: 10  1/1 `   //approximately

                numberOfCharacters = numberOfCharacters // - header.length - studentname.length - footer.length // -5 for average name length  // für msword option - hier gibts keinen header


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







async function createIndexPDF(dataArray, servername){
    let tabledata = [["Name", "Datum", "Zeichen", "Dateiname"]]
    for (const item of dataArray){
        let name = item.studentName.length > 20 ? item.studentName.slice(0, 20) + "..." : item.studentName;
        let time = "-"
        let chars = "0"
        let filename = "-"
        if (item.latestFolder && item.latestFolder.time ) {
            time = moment(item.latestFolder.time).format('DD.MM.YYYY HH:mm')
        }
        if (item.latestFilePath ) {  // if pdf filepath exists get time from filetime and count chars of pdf
            const stats = fs.statSync(item.latestFilePath);
            time = moment(stats.mtimeMs).format('DD.MM.YYYY HH:mm')
            chars = await countCharsOfPDF(item.latestFilePath, item.studentName, servername)
        }
        else {
            chars = "no pdf"
        }

        if (item.latestFolder && item.latestFolder.path && item.latestFileName) {
            filename =  item.latestFileName.length > 25 ? item.latestFileName .slice(0, 25) + "..." : item.latestFileName ;
        }

        tabledata.push([ name, time, chars, filename ])
    }
    
    const pdfDoc = await PDFDocument.create();// Create a new PDFDocument
    const page = pdfDoc.addPage(); // Add a page to the document

    // Set up table dimensions and styles
    const startX = 50; // X-coordinate where the table starts
    const startY = page.getHeight() - 50; // Y-coordinate where the table starts (from top)
    const rowHeight = 20; // Height of each row
    const columnWidths = [140, 120, 64, 170]; // Width of each column

    // Function to draw a cell
    const drawCell = (x, y, width, height) => { page.drawRectangle({ x, y, width, height, borderColor: rgb(0, 0, 0),  borderWidth: 1,  });  };
    // Function to add text to a cell
    const addText = (text, x, y) => {  text = String(text);    page.drawText(text, { x, y, size: 12, color: rgb(0, 0, 0),  });  };

    tabledata.forEach((row, rowIndex) => {
        const yPos = startY - rowIndex * rowHeight; // Calculate Y position for the current row
        row.forEach((cellText, columnIndex) => {
            const xPos = startX + columnWidths.slice(0, columnIndex).reduce((acc, val) => acc + val, 0); // Calculate X position for the current cell
            drawCell(xPos, yPos - rowHeight, columnWidths[columnIndex], rowHeight);
            addText(cellText, xPos + 5, yPos - rowHeight + 5); // Adjust text position within the cell
        });
    });
    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();
    return pdfBytes 
}


/**
 * CREATE COMBINED PDF END >>>>>>>>>>>>>>>>>>
 */













/**
 * GET a latest work from specific Student
 */ 
 router.post('/getLatestFromStudent/:servername/:token/:studentname/:studenttoken', async function (req, res, next) {
    const token = req.params.token
    const servername = req.params.servername
    const studentname = req.params.studentname
    const studenttoken = req.params.studenttoken
    const mcServer = config.examServerList[servername] // get the multicastserver object
    let warning = false
    let latestfolder = ""
    let latestfolderPath = ""

    if ( token !== mcServer.serverinfo.servertoken ) { return res.json({ status: t("data.tokennotvalid") }) }

    // get latest directory of student 
    let directoryPath =  path.join( config.workdirectory, mcServer.serverinfo.servername, studentname);

    if (!fs.existsSync(directoryPath)){ fs.mkdirSync(directoryPath, { recursive: true });  }


    fs.readdir(directoryPath, { withFileTypes: true }, async (err, files) => {
        if (err) throw err;
        const directories = files.filter(file => file.isDirectory());  // Nur Ordner filtern
        directories.sort((a, b) => {  // Sortieren der Ordner nach Änderungsdatum
            const statA = fs.statSync(path.join(directoryPath, a.name));
            const statB = fs.statSync(path.join(directoryPath, b.name));
            return statB.mtime.getTime() - statA.mtime.getTime();
        });

        if (directories.length > 0) {  // Neuesten Ordner anzeigen (erstes Element nach Sortierung)
            latestfolder = directories[0].name
            latestfolderPath = path.join(directoryPath, directories[0].name);

            //check if the newest directory is older than 5 minutes..  warn the teacher!
            const now = Date.now(); // Current time in milliseconds since the UNIX epoch
            const minute =  60 * 1000; // 1 minute in milliseconds
            const folderStats = fs.statSync(latestfolderPath)
            if (now - folderStats.mtime.getTime() > minute) { warning = true;} 


            let latestPDFpath = null

           
            try {
                const files = fs.readdirSync(latestfolderPath);
                let selectedFile = '';
            
                const csrfFiles = files.filter(file => file.includes('aux') && file.endsWith('.pdf'));
                const docxFiles = files.filter(file => file.includes('docx') && file.endsWith('.pdf'));
                const xlsxFiles = files.filter(file => file.includes('xlsx') && file.endsWith('.pdf'));
                const exactMatchFile = files.find(file => file === `${studentname}.pdf`);
            
                if (csrfFiles.length > 0)      { selectedFile = csrfFiles[0];   } 
                else if (docxFiles.length > 0) { selectedFile = docxFiles[0];   } 
                else if (xlsxFiles.length > 0) { selectedFile = xlsxFiles[0];   } 
                else if (exactMatchFile)       { selectedFile = exactMatchFile; }
            
                latestPDFpath = selectedFile ? path.join(latestfolderPath, selectedFile) : null;
                log.info('data @ getlatestfromstudent: Neueste Datei gefunden: ', latestPDFpath);
            } 
            catch (error) {
                log.error('data @ getlatestfromstudent: Fehler beim Lesen des Verzeichnisses:', error);
                latestPDFpath = null; 
            }



            if (fs.existsSync(latestPDFpath)) {
                let PDF = await concatPages([latestPDFpath])
                let pdfBuffer = Buffer.from(PDF) 
                return res.json({warning: warning, pdfBuffer:pdfBuffer, latestfolderPath:latestfolderPath, pdfPath:latestPDFpath });
            }
            else {
                return res.json({warning: warning, pdfBuffer:false, latestfolderPath:latestfolderPath});  // we return latestfolderpath because "openLatestFolder" just needs this to work
            }
        } else {
            log.info('data @ getlatestfromstudent: Keine Ordner gefunden.'); 
            return res.json({warning: warning, pdfBuffer:false, latestfolderPath:latestfolderPath});
        }
    });
})




















async function concatPages(pdfsToMerge) {
    // Create a new PDFDocument
    const tempPDF = await PDFDocument.create();
    for (const pdfpath of pdfsToMerge) { 
        let pdfBytes = fs.readFileSync(pdfpath);
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
 router.post('/delete/:servername/:token', function (req, res, next) {
    const token = req.params.token
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    if ( token !== mcServer.serverinfo.servertoken ) { return res.json({ status: t("data.tokennotvalid") }) }

  
    const filepath = req.body.filepath
    if (filepath) { //return specific file
        if (fs.statSync(filepath).isDirectory()){
            fs.rmSync(filepath, { recursive: true, force: true });
        }
        else {
            fs.unlink(filepath, (err) => { if (err) log.error(err); })
        }
        res.json({ status:"success", sender: "server", message:t("data.fdeleted"),  })
    }
})





/**
 * GET PDF from EXAM directory
 * @param filename if set the content of the file is returned
 */ 

router.post('/getpdf/:servername/:token', function (req, res, next) {
    const { token, servername } = req.params;
    const mcServer = config.examServerList[servername];

    // Prüfen, ob mcServer existiert und der Token übereinstimmt
    if (!mcServer || token !== mcServer.serverinfo?.servertoken) {
        return res.json({ status: t("data.tokennotvalid") });
    }

    const { filename } = req.body;
    if (filename) {
        res.sendFile(filename, (err) => {
            if (err) {
                log.error(err);
                res.status(404).json({ status: t("data.fileerror") });
            }
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
            res.download(filepath);  
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
 * Stores file(s) to the workdirectory (files coming FROM CLIENTS (finished EXAMS) )
 * @param studenttoken the students token - this has to be valid (coming from a registered user) 
 * @param servername the server-exam instance the students token belongs to
 * in order to process the request - DO NOT STORE FILES COMING from anywhere.. always check if token belongs to a registered student (or server)
 */
 router.post('/receive/:servername/:studenttoken', async (req, res, next) => {  
    const studenttoken = req.params.studenttoken
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
  
    const { file, filename } = req.body;

    const fileContent = Buffer.from(file, 'base64');

    if ( !checkToken(studenttoken, mcServer ) ) { res.json({ status: t("data.tokennotvalid") }) }
    else {
        let errors = 0
        let time = new Date(new Date().getTime()).toLocaleTimeString();  //convert to locale string otherwise the foldernames will be created in UTC
        let student = mcServer.studentList.find(element => element.token === studenttoken) // get student from token
        
       
        if (file){
           
                let absoluteFilepath = path.join(config.workdirectory, mcServer.serverinfo.servername, filename);
                if (filename.includes(".zip")){  //ABGABE as ZIP

                    log.info("data @ receive: Receiving File(s) from: ", student.clientname)

                    let studentdirectory =  path.join(config.workdirectory, mcServer.serverinfo.servername, student.clientname)
                    let tstring = String(time).replace(/:/g, "_");
                    let studentarchivedir = path.join(studentdirectory, tstring)

                    // check directories
                    try {
                        if (!fs.existsSync(studentdirectory)){ fs.mkdirSync(studentdirectory, { recursive: true });  }
                        if (!fs.existsSync(studentarchivedir)){ fs.mkdirSync(studentarchivedir, { recursive: true }); }
                    }catch (err) {log.error("data @ receive: ",err)}
            

                    // extract zip file to archive
               
                    fs.writeFile(absoluteFilepath, fileContent, (err) => {
                        if (err) { errors++; log.error( t("data.couldnotstore") ) }
                        else {
                            extract(absoluteFilepath, { dir: studentarchivedir }).then( () => {
                                fs.unlink(absoluteFilepath, (err) => { if (err) log.error(err); }); // remove zip file after extracting
                                // log.info("data @ receive: ZIP file received!")
                                res.json({ status:"success", sender: "server", message:t("data.filereceived"), errors: errors  })
                            }).catch( err => log.error("data @ receive: ",err))
                        }                     
                    });
                }
                else { // this is another file (most likely a screenshot as we do not yet transfer other files)
             
                    fs.writeFile(absoluteFilepath, fileContent, (err) => {
                        if (err) { errors++; log.error( t("data.couldnotstore") ) }
                        else {
                            log.info("data @ receive: Single file received")
                            res.json({ status:"success", sender: "server", message:t("data.filereceived"), errors: errors  })
                        }
                    });

                    
                }
            
           
        }
        else {
            res.json({ status:"error",  sender: "server", message:t("data.nofilereceived"), errors: errors })
        }
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

    // create user abgabe directory
    let uploaddirectory =  path.join(config.workdirectory, mcServer.serverinfo.servername, 'UPLOADS')
    if (!fs.existsSync(uploaddirectory)){ fs.mkdirSync(uploaddirectory, { recursive: true });  }


    if (req.files){
        let filesArray = []  // depending on the number of files this comes as array of objects or object
        if (!Array.isArray(req.files.files)){ filesArray.push(req.files.files)}
        else {filesArray = req.files.files}

        let files = []        
    
        for await (let file of  filesArray) {
            let filename = decodeURIComponent(file.name)  //encode to prevent non-ascii chars weirdness
            let absoluteFilepath = path.join(uploaddirectory, filename);
            await file.mv(absoluteFilepath, (err) => {  
                if (err) { log.error( t("data.couldnotstore") ) }
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
            if (studenttoken == "a"){groupArray = mcServer.serverstatus.groupA }
            if (studenttoken == "b"){groupArray = mcServer.serverstatus.groupB }
            for (let name of groupArray){
                let student = mcServer.studentList.find(element => element.clientname === name)
                if (student) {  
                    student.status['fetchfiles']= true 
                    student.status['files'] = files
                }   
            }
        }
        else {
            let student = mcServer.studentList.find(element => element.token === studenttoken)
            if (student) {  
                student.status['fetchfiles']= true 
                student.status['files'] = files
            }   
        }
        res.json({ status:"success", sender: "server", message:t("data.filereceived")  })
    }
    else {
        res.json({ status:"error",  sender: "server", message:t("data.nofilereceived") })
    }
    
})





export default router



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