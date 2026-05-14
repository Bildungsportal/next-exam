
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
import log from 'electron-log';
import {
    resolvePathUnderRoot,
    safeClientZipBasename,
    isSafePathSegment,
} from '../../utils/safePaths.js';
import {
    decryptNxe1FilesUnderDir,
} from '../../../../main/scripts/examFileCryptoContext.js';

/**
 * Student file bundle download (Bearer student token only; type must be studentfilerequest).
 */

router.post('/download/:servername', async (req, res, next) => {
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]
    const studenttoken = bearerTokenFromRequest(req)
    const type = req.body.type
    const files = req.body.files

    if (!mcServer) {
        return res.json({ status: t("data.tokennotvalid") })
    }
    if (!studenttoken) {
        return res.status(401).json({ status: t("data.tokennotvalid") })
    }
    if (!checkToken(studenttoken, mcServer)) {
        return res.json({ status: t("data.tokennotvalid") })
    }
    if (type !== 'studentfilerequest') {
        return res.status(400).json({ status: t("data.fileerror") })
    }
    const student = mcServer.studentList.find((element) => element.token === studenttoken)
    if (!student) {
        return res.status(403).json({ status: t("data.tokennotvalid") })
    }
    student.status['fetchfiles'] = false
    student.status['files'] = []
    res.zip({ files: files })
})

/**
 * Download a QEMU qcow2 disk from teacher workdir/QEMU (POST + Bearer student token; body.filename).
 */
router.post('/qemu/:servername', async (req, res) => {
    const servername = req.params.servername
    const studenttoken = bearerTokenFromRequest(req)
    const filenameRaw = req.body?.filename
    const mcServer = config.examServerList[servername]
    if (!mcServer) { return res.status(404).json({ status: "error", sender: "server", message: "server not found" }) }
    if (!studenttoken) { return res.status(401).json({ status: t("data.tokennotvalid") }) }
    if (!checkToken(studenttoken, mcServer)) { return res.status(403).json({ status: t("data.tokennotvalid") }) }

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





router.post('/getexammaterials/:servername', async (req, res, next) => {
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]
    const studenttoken = bearerTokenFromRequest(req)
    const group = req.body.group
    const clientLockedSection = req.body.lockedSection

    if (!mcServer) {
        return res.json({ status: t("data.tokennotvalid") })
    }
    if (!studenttoken) {
        return res.status(401).json({ status: t("data.tokennotvalid") })
    }
    if (!checkToken(studenttoken, mcServer)) {
        return res.json({ status: t("data.tokennotvalid") })
    }

    let student = mcServer.studentList.find((element) => element.token === studenttoken)
    if (student) {  

        let serverstatus = mcServer.serverstatus
        const sectionIndex = serverstatus.allowSectionSwitch && clientLockedSection != null ? clientLockedSection : serverstatus.activeSection
        let examSection = serverstatus.examSections[sectionIndex]
        if (!examSection || typeof examSection !== 'object') {
            log.warn(`data @ getexammaterials: missing examSections[${sectionIndex}]`)
            return res.status(400).json({ status: 'error', sender: 'server', message: t('data.fileerror') })
        }
        let groupA = examSection.groupA
        let groupB = examSection.groupB
    
        let materials = []
        let allowedUrls = []
        if (group === "a") {
            materials = [...((groupA && groupA.examInstructionFiles) || [])]
            allowedUrls = (groupA && groupA.allowedUrls) || []
        }
        else if (group === "b") {
            materials = [...((groupB && groupB.examInstructionFiles) || [])]
            allowedUrls = (groupB && groupB.allowedUrls) || []
        }

        res.json({ status:"success", sender: "server", materials: materials, allowedUrls: allowedUrls  })
    } 
    else {
        res.json({ status:"error", sender: "server", message:t("data.tokennotvalid")  })
    }
    

 
})










/**
 * Stores file(s) to the workdirectory (files coming FROM CLIENTS (BACKUPS) )
 * @param servername the server-exam instance; student auth: Authorization Bearer (registered student token)
 * in order to process the request - DO NOT STORE FILES COMING from anywhere.. always check if token belongs to a registered student
 */
 router.post('/receive/:servername', async (req, res, next) => {  
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const studenttoken = bearerTokenFromRequest(req)
    const { file, filename, lastExamWriteSaveReason } = req.body;
    const fileContent = Buffer.from(file, 'base64');
    const zipSaveTag = typeof lastExamWriteSaveReason === 'string' ? lastExamWriteSaveReason : 'n/a';

    if (!mcServer) { return res.json({ status: t("data.tokennotvalid") }) }
    if (!studenttoken || !checkToken(studenttoken, mcServer)) { return res.json({ status: t("data.tokennotvalid") }) }
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
        if (!student) {
            return res.json({ status: t("data.tokennotvalid") })
        }
        const zipName = safeClientZipBasename(filename)
        if (!zipName) {
            log.warn(`data @ receive: rejected unsafe or non-zip filename (${filename})`)
            return res.json({ status: "error", sender: "server", message: "Invalid filename", errors: errors })
        }
        let absoluteFilepath = resolvePathUnderRoot(config.workdirectory, [mcServer.serverinfo.servername, student.clientname, zipName]);
        let studentdirectory = resolvePathUnderRoot(config.workdirectory, [mcServer.serverinfo.servername, student.clientname])
        
        let studentarchivedir = studentdirectory ? resolvePathUnderRoot(studentdirectory, [tstring]) : null
        if (!absoluteFilepath || !studentdirectory || !studentarchivedir) {
            log.error('data @ receive: unsafe path for zip or archive dir', { zipName, tstring })
            return res.json({ status: "error", sender: "server", message: "Invalid path", errors: errors })
        }
        try {
            await fs.promises.mkdir(studentdirectory, { recursive: true });
            await fs.promises.mkdir(studentarchivedir, { recursive: true });
        }
        catch (err) {
            log.error("data @ receive: ", err)
        }

        if (file){

            if (zipName){
                log.info("data @ receive: Received ZIP File from user:", student.clientname, "lastExamWriteSaveReason=", zipSaveTag)
                let success = await archiveAndExtractZip(absoluteFilepath, studentarchivedir, fileContent, mcServer)
                
                if (config.backupdirectory && success){     // copy to backup directory - do not unzip a second time - this is already done in archiveAndExtractZip
                    
                    let backupdir = resolvePathUnderRoot(config.backupdirectory, [mcServer.serverinfo.servername, student.clientname, tstring]) // same concept as in studentarchivedir
                    if (!backupdir) {
                        log.error('data @ receive: unsafe backupdir');
                    } else {
                    log.info(`data @ receive: Copying to backup directory: ${studentarchivedir} ->   ${backupdir} `)
                    try {
                        await fs.promises.mkdir(backupdir, { recursive: true });
                        await fs.promises.cp(studentarchivedir, backupdir, { recursive: true })
                    }
                    catch (err) {
                        log.error("data @ receive: ", err)
                    }
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
})


/**
 * POST next-exam-student.log from client into workdir/<server>/<client>/logfiles/ and mirror to backupdirectory when set
 */
router.post('/studentlog/:servername', async (req, res, next) => {
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]
    const studenttoken = bearerTokenFromRequest(req)
    const { file, clientname } = req.body || {}

    if (!mcServer) {
        return res.json({ status: t("data.tokennotvalid"), sender: "server" })
    }
    if (!studenttoken) {
        return res.status(401).json({ status: t("data.tokennotvalid"), sender: "server" })
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
    const studentdirectory = resolvePathUnderRoot(config.workdirectory, [mcServer.serverinfo.servername, student.clientname])
    const logdir = studentdirectory ? resolvePathUnderRoot(studentdirectory, ['logfiles']) : null
    const destPath = logdir ? resolvePathUnderRoot(logdir, ['next-exam-student.log']) : null
    try {
        if (!studentdirectory || !logdir || !destPath) {
            log.error('data @ studentlog: unsafe log path');
            return res.json({ status: "error", sender: "server", message: "Invalid path" })
        }
        await fs.promises.mkdir(logdir, { recursive: true })
        await fs.promises.writeFile(destPath, fileContent)
        // Mirror student log to backupdirectory when configured (same relative layout as workdir).
        if (config.backupdirectory) {
            const backupLogdirRoot = resolvePathUnderRoot(config.backupdirectory, [mcServer.serverinfo.servername, student.clientname])
            const backupLogdir = backupLogdirRoot ? resolvePathUnderRoot(backupLogdirRoot, ['logfiles']) : null
            const backupDestPath = backupLogdir ? resolvePathUnderRoot(backupLogdir, ['next-exam-student.log']) : null
            try {
                if (!backupLogdir || !backupDestPath) {
                    log.error('data @ studentlog: unsafe backup log path');
                } else {
                await fs.promises.mkdir(backupLogdir, { recursive: true })
                await fs.promises.writeFile(backupDestPath, fileContent)
                }
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

/** Parses Authorization: Bearer <token> for student-only /server/data routes. */
function bearerTokenFromRequest(req) {
    const h = req.headers?.authorization
    if (!h || typeof h !== 'string') return null
    const m = /^Bearer\s+(\S+)/i.exec(h.trim())
    return m ? m[1] : null
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