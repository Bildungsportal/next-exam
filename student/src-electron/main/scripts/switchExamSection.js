import log from 'electron-log';
import fs from 'fs';
import WindowHandler from './windowhandler.js';
import config from '../../../src/utils/config.js';
import multicastClient from './multicastclient.js';
import { webContents } from 'electron';

export async function switchExamSection(CommunicationHandler, serverstatus, newSectionNumber){

    const currentLockedSection = multicastClient.clientinfo.lockedSection; // Current section number (source for saving)
    const newLockedSection = newSectionNumber; // New section number (source for loading)
    const examDir = config.examdirectory;

    log.warn(`switchExamSection: changing section to ${newLockedSection } ${serverstatus.examSections[newLockedSection].sectionname} , Examtype: ${serverstatus.examSections[newLockedSection].examtype}` )
                        
    //save all files from the old section (if exam mode is "editor") and send to teacher - trigger sendToTeacher()
    if (multicastClient.clientinfo.examtype === "editor"){
        log.info("switchExamSection: sending exam to teacher (final submit)")

        // send current work as base64 to teacher (stores pdf in ABGABE folder with submission number)
        let pdf = await CommunicationHandler.getBase64PDF(multicastClient.clientinfo.submissionnumber, serverstatus.examSections[currentLockedSection].sectionname)  // local function to get base64 pdf from editor
        if (pdf.status === "success"){
            CommunicationHandler.sendBase64PDFtoTeacher(pdf.base64pdf, currentLockedSection)
        }
    }
    CommunicationHandler.sendToTeacher(); //backup local files and send to teacher (archive with timestamp)




    //wait 1 second and cleanup NEXT-EXAM-STUDENT-WORKDIR
    await CommunicationHandler.sleep(2000);


    // update examtype in clientinfo
    multicastClient.clientinfo.examtype = serverstatus.examSections[newLockedSection].examtype
    // Update the locked section AFTER saving the old state
    multicastClient.clientinfo.lockedSection = newLockedSection;



    // MOVE Section Files to a subdirectory named by the CURRENT locked section
    try {
        // PART 1: SAVE CURRENT EXAMDIR FILES to a subdirectory named by the CURRENT locked section
                        
        if (fs.existsSync(examDir) && currentLockedSection != null && currentLockedSection !== undefined) { // Check if main dir exists and a section is currently active
            
            log.debug(`switchExamSection: Saving content from examDir to section ${currentLockedSection}`);

            const savePath = `${examDir}/${currentLockedSection}`;
            if (!fs.existsSync(savePath)) {
                fs.mkdirSync(savePath, { recursive: true }); // Create save directory if it doesn't exist
            }

            const files = fs.readdirSync(examDir);
            log.info(`switchExamSection: Found ${files.length} items in examDir to save`);
            
            let filesSaved = 0;
            for (const file of files) {
                const oldPath = `${examDir}/${file}`;
                const stat = fs.statSync(oldPath); // Get file stats
                
                // Only process actual FILES, not directories (like the section folders themselves)
                if (stat.isFile()) {
                    const newPath = `${savePath}/${file}`;
                    fs.copyFileSync(oldPath, newPath); // Copy file
                    fs.unlinkSync(oldPath); // Delete original file from examDir
                    filesSaved++;
                    log.info(`switchExamSection: Saved file ${file} to section ${currentLockedSection}`);
                } else {
                    log.info(`switchExamSection: Skipping non-file (folder) item ${file} in examDir`);
                }
            }
            log.info(`switchExamSection: Successfully saved ${filesSaved} files to section ${currentLockedSection}`);
        } else {
            log.warn(`switchExamSection: Skipping save - examDir exists: ${fs.existsSync(examDir)}, currentLockedSection: ${currentLockedSection}`);
        }

        // PART 2: LOAD FILES from the subdirectory named by the NEW locked section to examDir
        if (newLockedSection != null && newLockedSection !== undefined) {
            log.debug(`switchExamSection: Loading content from section ${newLockedSection} to examDir`);

            const loadPath = `${examDir}/${newLockedSection}`;
            if (fs.existsSync(loadPath)) { // Check if the new section folder exists
                const filesToLoad = fs.readdirSync(loadPath);
                log.info(`switchExamSection: Found ${filesToLoad.length} items in section ${newLockedSection} directory`);
                
                let filesCopied = 0;
                for (const file of filesToLoad) {
                    const sourcePath = `${loadPath}/${file}`;
                    const destPath = `${examDir}/${file}`;
                    const stat = fs.statSync(sourcePath);
                    
                    if (stat.isFile()) { // Ensure only files are copied back
                        fs.copyFileSync(sourcePath, destPath); // Copy file to examDir
                        filesCopied++;
                        log.info(`switchExamSection: Copied file ${file} from section ${newLockedSection} to examDir`);
                    } else {
                        log.warn(`switchExamSection: Skipping non-file item ${file} in section ${newLockedSection} directory`);
                    }
                }
                log.info(`switchExamSection: Successfully copied ${filesCopied} files from section ${newLockedSection} to examDir`);
            } else {
                log.info(`switchExamSection: New locked section directory ${newLockedSection} does not exist. Starting with a clean state.`);
            }
        } else {
            log.warn(`switchExamSection: newLockedSection is falsy (${newLockedSection}), skipping file load`);
        }
    } catch (error) {
        log.error(`switchExamSection: Error during folder operation - ${error}`);
        log.error(`switchExamSection: Error stack: ${error.stack}`);
        log.error(`switchExamSection: currentLockedSection: ${currentLockedSection}, newLockedSection: ${newLockedSection}, examDir: ${examDir}`);
    }

    /**
     *  Actually SWITCH EXAM SECTION
     */
    //close exam window or relead the new exam section in the same window
    if (WindowHandler.examwindow){


                // destroy devtools window - if you don't next-exam will crash silently on reload and section switch
            if (config.development){
                webContents.getAllWebContents().forEach(wc => {                        // alle WebViews des Childs
                    if (wc.hostWebContents?.id === WindowHandler.examwindow.webContents.id && wc.isDevToolsOpened?.()){
                        log.info("switchExamSection: destroying devtools window")
                        wc.closeDevTools()                                                 // DT des WebViews schließen (auch detached)
                    }
                })
            } 
            //close exam window and reopen it with the new exam section
            WindowHandler.examwindow.once('closed', async () => {
                if (process.platform == 'darwin'){
                    await disableRestrictions()
                    await CommunicationHandler.sleep(500)
                }


                WindowHandler.examwindow = null;
                CommunicationHandler.startExam(serverstatus);
            });
            WindowHandler.examwindow.close();
            WindowHandler.examwindow.destroy();

    }
}