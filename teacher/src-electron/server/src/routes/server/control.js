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

import crypto from 'crypto';
import config from '../../../../main/config.js'
import path from 'path'
import i18n from '../../../../../src/locales/locales.js'
const { t } = i18n.global
import fs from 'fs' 
import qs from 'qs'
import { msalConfig } from '../../../../../src/msalutils/authConfigShared.ts'
import log from 'electron-log';
import { resolvePathUnderRoot, safeScreenshotFileName, safeSectionFolderId, isSafePathSegment } from '../../utils/safePaths.js';
import { normalizeStudentClientName } from '../../../../../../shared/normalizeStudentClientName.js';
import { isStudentReachable } from '../../../../../src/utils/studentPresence.js';

import WindowHandler from '../../../../main/scripts/windowhandler.js'

const fsp = fs.promises 

/**
 * this route generates the necessary codeVerifier and codeChallenge for PKCE
 * authorization flow for the microsoft onedrive graph API
 * it receives a code and then redirects to /msauth which will aquire an
 * accesstoken
 */
  
router.get('/oauth', (req, res) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = base64UrlEncode(sha256(Buffer.from(codeVerifier, 'utf-8')));
    res.cookie('codeVerifier', codeVerifier, { httpOnly: true });
    config.codeVerifier = codeVerifier

    const authUrlParams = {
        client_id: msalConfig.auth.clientId,
        response_type: 'code',
        redirect_uri: msalConfig.auth.redirectUri,
        response_mode: 'query',
        scope: 'openid profile offline_access Files.ReadWrite.AppFolder Files.Read Files.ReadWrite',
        state: '12345',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    };
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${qs.stringify(authUrlParams)}`;
    res.redirect(authUrl);
});
  
/**
 * this uses the code from /oauth route together with the client_id to receive
 * an accessToken for the microsoft ondrive API
 * the token is stored on the global config object and can be requested via /getconfig or ipcRenderer 'getconfig
 */
router.get('/msauth', async (req, res) => {
    const code = req.query.code;
    const codeVerifier =  config.codeVerifier;
    try {
        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://localhost',
            },
            body: qs.stringify({
                client_id: msalConfig.auth.clientId,
                grant_type: 'authorization_code',
                scope: 'openid profile offline_access Files.ReadWrite.AppFolder Files.Read Files.ReadWrite',
                code,
                redirect_uri: msalConfig.auth.redirectUri,
                code_verifier: codeVerifier,
            }),
        })
        const tokenJson = await tokenResponse.json()

        if (!tokenResponse.ok) {
            throw new Error(tokenJson.error_description || tokenJson.error || `${tokenResponse.status} ${tokenResponse.statusText}`)
        }

        config.accessToken = tokenJson.access_token     // we received the access token - store it on global config object

        let html = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Custom Button</title>
                <link rel="stylesheet" href="/static/css/staticstyles.css">
                <script>
                function closeWindowAfterFourSeconds() { setTimeout(function() { window.close(); }, 4000); }
                </script>
            </head>
            <body onload="closeWindowAfterFourSeconds()"><br>
                <h3>Login OK!</h3> <br>
            </body>
        </html>`
        res.send(html);
    } catch (error) {
        console.error(error);
        let html = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Custom Button</title>
                <link rel="stylesheet" href="/static/css/staticstyles.css">
            </head>
            <body><br>
                <h4>${error.message}</h4> <br>
                Please close this Window and try again! <br>
                <button onclick="window.close()" class="custom-btn custom-btn-danger">Close Window</button>
            </body>
        </html>`
        res.status(500).send(html);
    }
  });

















/**
 * STUDENT-ORIENTED ROUTES (Bearer student token required except: oauth, msauth, registerclient=PIN,
 * serverlist+pong=open LAN discovery; connectedstudentips only if config.exposeStudents).
 */



///////////////////
/** OPEN ROUTES */


/**
 *  sends an "alive" signal back
 */
 router.get('/pong', function (req, res, next) {
    res.send('pong')
})


/**
 *  sends a list of all running exam servers
 */
router.get('/serverlist', function (req, res, next) {
    let serverlist = []
    Object.values(config.examServerList).forEach( server => {
        serverlist.push({
            servername: server.serverinfo.servername,
            id: server.serverinfo.id,
            serverip: server.serverinfo.ip,
            reachable: true,
            version: server.serverinfo.version,
            bip: !!server.serverinfo.bip,
            requireBiP: !!server.serverstatus?.requireBiP,
            examStatus: server.serverinfo.bip ? (server.serverstatus?.bipStatus || 'closed') : undefined,
        }) 
    });
    res.send({serverlist:serverlist, status: "success"})
})







if (config.exposeStudents) {
    /** Plain text allowlist: one reachable student IP per line (text/plain; empty body outside exammode). */
    router.get('/connectedstudentips', function (req, res) {
        const servers = Object.values(config.examServerList)
        if (servers.length === 0) {
            return res.status(404).type('text/plain').send('')
        }
        const mcServer = servers[0]
        if (!mcServer.serverstatus?.exammode) {
            return res.type('text/plain').send('')
        }
        const now = Date.now()
        const ips = [...new Set((mcServer.studentList || [])
            .filter((student) => isStudentReachable(student, now))
            .map((student) => student.clientip)
            .filter((ip) => typeof ip === 'string' && ip.length > 0))]
        const body = ips.length ? `${ips.join('\n')}\n` : ''
        return res.type('text/plain').send(body)
    })
}

 /** OPEN ROUTES END*/
/////////////////////






 /////////////////////////////
/** PROTECTED ROUTES START */


/**
 *  REGISTER CLIENT
 *  checks pin code, creates csrf token for client, answeres with token
 *
 *  @param pin  the pincode to connect to the serverinstance
 *  @param clientname the name of the student
 *  @param clientip the clients ip address for api calls
 */
 router.post('/registerclient/:servername', async function (req, res, next) {
    const { packet } = req.body || {}
    const servername = req.params.servername
    const mcServer = config.examServerList[servername] // get the multicastserver object
    if (!mcServer) { return res.send({ sender: "server", message: t("control.notfound"), status: "error" }) }
    const sessionRef = String(mcServer.serverinfo?.pin || '')
    let clientname, clientip, pin, version, hostname, bipuserID, exammode
    try {
        const payload = await processSecurePayload(packet, sessionRef)
        ;({ clientname, clientip, pin, version, hostname, bipuserID, exammode } = payload || {})
    } catch (err) {
        return res.send({ sender: "server", message: "Wrong PIN", status: "error" })
    }
    clientname = normalizeStudentClientName(clientname)
    const token = `csrf-${crypto.randomUUID()}`

    //log.info("control @ registerclient: Client Version:",version)


    let vteacher = config.version.split('.').slice(0, 2),
    versionteacher = vteacher.join('.'); 
    let vstudent = version.split('.').slice(0, 2),
    versionstudent = vstudent.join('.'); 

    //console.log(versionteacher, versionstudent)
  
    if (!pin || !clientname || !clientip || !hostname || !version) { return res.send({sender: "server", message:"Invalid registration payload", status: "error"} ) }
    if (`${versionteacher}` !== versionstudent ) {  return res.send({sender: "server", message:t("control.versionmismatch"), status: "error", version: config.version, versioninfo: config.info} )  }  
    
    if (mcServer.serverinfo?.bip && (mcServer.serverstatus?.bipStatus || 'closed') !== 'open') {
        return res.send({sender: "server", message:t("control.bipclosed"), status: "error"} )
    }

    if (mcServer.serverstatus.requireBiP && (bipuserID === false || bipuserID === 'false' || !bipuserID)){ // allow old string values and strict false
        return res.send({sender: "server", message:t("control.biprequired"), status: "error"} ) 
    }
    try {
        if (pin == mcServer.serverinfo.pin) {
            if (exammode === true && !mcServer.serverstatus?.exammode) {
                return res.json({ sender: "server", message: t("control.exammismatchregistration"), status: "error" })
            }
            let registeredClient = mcServer.studentList.find(element => element.clientname.toLowerCase() === clientname)
        
            

            if (!registeredClient) {   // create client object
                log.info(`control @ registerclient: adding new client '${clientname}'`)


                //group handling - everybody is in groupA except there is already a group configuration
                let group = false;
                const groupAUsers = mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupA?.users || []
                const groupBUsers = mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupB?.users || []
                if (groupAUsers.some((u) => String(u).toLowerCase() === clientname)) { group = 'a'; }
                else if (groupBUsers.some((u) => String(u).toLowerCase() === clientname)) { group = 'b'; }
                else {  // user is not in any group or no group is configured
                    group = 'a'
                   mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupA.users.push(clientname)

                }

                const client = {    // we have a different representation of the clientobject on the server than on the client - why exactly? we could just send the whole client object via POST (as we already do in /update route )
                    clientname: clientname,
                    hostname: hostname,
                    token: token,
                    clientip: clientip,
                    timestamp: new Date().getTime(),
                    focus: true,
                    exammode: exammode ?? false,
                    imageurl:false,
                    virtualized: false,
                    version: version,  // set at registration so isVersionMismatch is correct before first /update
                    bipuserID: bipuserID,  // we can use this in the future to re-check if this user is in the pre-defined userlist for this specific BIP exam
                    status: { group: group || 'a'},    // we use this to store (per student) information about whats going on on the serverside (tasklist) and send it back on /update
                    // we allow two groups (this is just used for distribution of files by now)
                }
                //create folder for student (canonical lowercase name)
                const parentDir = path.join(config.workdirectory, mcServer.serverinfo.servername)
                const targetDirName = clientname
                let studentfolder = path.join(parentDir, targetDirName)
                try {
                    const directories = (await fs.promises.readdir(parentDir, { withFileTypes: true }))
                        .filter((dirent) => dirent.isDirectory())
                        .map((dirent) => dirent.name)
                    const existingDir = directories.find((dir) => dir.toLowerCase() === targetDirName)
                    if (existingDir) {
                        if (existingDir !== targetDirName) {
                            const oldPath = path.join(parentDir, existingDir)
                            await fs.promises.rename(oldPath, studentfolder)
                            log.info(`control @ registerclient: Renamed workdir ${existingDir} -> ${targetDirName}`)
                        } else {
                            log.warn(`control @ registerclient: Using already existing directory: ${targetDirName}`)
                        }
                    } else {
                        await fs.promises.mkdir(studentfolder, { recursive: true })
                        log.info(`control @ registerclient: Creating ${studentfolder}`)
                    }
                } catch (mkdirErr) {
                    log.error(`control @ registerclient: Error creating directory: ${mkdirErr}`)
                }

                try {
                    await fs.promises.mkdir(config.tempdirectory, { recursive: true });
                } catch (err) {
                    // Directory might already exist, that's ok
                }

                mcServer.studentList.push(client)
                return res.json({sender: "server", message:"Student successfully registered", status: "success", token: token})  // on success return client token (auth needed for server api)
            }
            else {

                let now = new Date().getTime()
                if (now - 20000 > registeredClient.timestamp) { // student probably went offline (teacher connection loss) but is coming back now
                    registeredClient.clientname = clientname
                    registeredClient.timestamp = now
                    registeredClient.exammode = exammode ?? false
                    log.info("control @ registerclient: student reconnected")

                    //inform frontend about re-connection
                    WindowHandler.mainwindow.webContents.send("reconnected", registeredClient)
                    return res.json({ sender: "server", message: "Student successfully reconnected", status: "success", token: registeredClient.token, reconnected: true }) // send back old token; reconnected flags student UI success copy
                }
                else {
                    return res.json({sender: "server", message:"Student already registered", status: "error"})
                }  
            }
        }
        else {
            return res.json({sender: "server", message:"Wrong PIN", status: "error"})
        }
    }
    catch (err){
        log.error(`control @ registerclient: ${err}`);
        return res.json({sender: "server", message:"An unknown error occurred", status: "error"})
    }
})















/**
 * UPDATES Clientinfo - the specified students timestamp (used in dashboard to mark user as online) and other status updates
 * FETCHES Serverstatus & Studentstatus
 * usually triggered by the clients directly from the Main Process (loop)
 * @param servername the name of the server at which the student is registered
 * @param token the students token to search and update the entry in the list
 */
 router.post('/update', function (req, res, next) {
    const clientinfo = req.body.clientinfo
    if (!clientinfo) {
        return respondStudentAuth(res, 'authrequired')
    }
    const exammode = clientinfo.exammode
    const servername = clientinfo.servername

    const auth = resolveStudentForControl(req, servername)
    if (!auth.ok) {
        return respondStudentAuth(res, auth.reason)
    }
    const { mcServer, studenttoken, student } = auth

    //update important student attributes
    student.focus = clientinfo.focus
    student.virtualized = clientinfo.virtualized
    if (clientinfo.vmFindings) student.vmFindings = clientinfo.vmFindings
    if (clientinfo.webglFindings) student.webglFindings = clientinfo.webglFindings
    student.timestamp = new Date().getTime()   //last seen  / this is like a heartbeat - update lastseen
    student.exammode = exammode  
    student.files = clientinfo.numberOfFiles
    student.remoteassistant = clientinfo.remoteassistant
    student.version = clientinfo.version
    if (typeof clientinfo.displayCount === 'number') student.displayCount = clientinfo.displayCount
    if (typeof clientinfo.multiMonitor === 'boolean') student.multiMonitor = clientinfo.multiMonitor
    if (typeof clientinfo.isRunningInCage === 'boolean') student.isRunningInCage = clientinfo.isRunningInCage
    if (typeof clientinfo.isAssessmentMode === 'boolean') student.isAssessmentMode = clientinfo.isAssessmentMode
    if (clientinfo.isRunningInCage && clientinfo.allowedKioskApps) {
        student.allowedKioskApps = {
            startLayoutReadable: !!clientinfo.allowedKioskApps.startLayoutReadable,
            appNames: Array.isArray(clientinfo.allowedKioskApps.appNames) ? clientinfo.allowedKioskApps.appNames : [],
        }
    } else {
        delete student.allowedKioskApps
    }


    if (clientinfo.focus) { student.status.restorefocusstate = false }  // remove task because its obviously done
    if (clientinfo.screenshotinterval == 0){ student.imageurl = "person-lines-fill.svg"  }

    let studentstatus = JSON.parse(JSON.stringify(student.status))  // copy current status > send copy of original to student
   
    // teacher sets studentstatus.kick to true - the moment the student fetches his status and knwon he's kicked he will be removed from the server
    if (student.status.kicked) {
        mcServer.studentList = mcServer.studentList.filter((el) => el.token !== studenttoken)
    }


    // reset some status values that are only used to transport something once
    student.status.printdenied = false 
    student.status.delfolder = false 
    student.status.sendexam = false // request only once
    student.status.sendlog = false // request only once (next-exam-student.log snapshot to teacher)
    student.status.focus = true
    student.status.getmaterials = false
    //student.status.activatePrivateSpellcheck = false   // activate only once - when student retrieved "studentstatus" we can reset some values of "student.status"

    // return current serverinformation to process on clientside 
    // Create optimized shallow copy of serverstatus without examInstructionFiles to reduce payload size
    const serverstatusCopy = { ...mcServer.serverstatus };
    serverstatusCopy.examSections = { ...mcServer.serverstatus.examSections };
    
    // Clear examInstructionFiles in all 4 examSections for both groupA and groupB (we dont want to send the materials to the student on every update)
    for (let sectionKey of [1, 2, 3, 4]) {
        if (serverstatusCopy.examSections[sectionKey]) {
            serverstatusCopy.examSections[sectionKey] = {
                ...serverstatusCopy.examSections[sectionKey],
                groupA: {
                    ...serverstatusCopy.examSections[sectionKey].groupA,
                    examInstructionFiles: []
                },
                groupB: {
                    ...serverstatusCopy.examSections[sectionKey].groupB,
                    examInstructionFiles: []
                }
            };
        }
    }
    
    res.charset = 'utf-8';
    res.send({sender: "server", message:t("control.studentupdate"), status:"success", serverstatus:serverstatusCopy, studentstatus: studentstatus })
})


/**
 * UPDATE SCREENSHOT
 * POST Data contains a screenshot of the clients desktop !!
 * @param servername the name of the server at which the student is registered
 * @param token the students token to search and update the screenshot
 */
router.post('/updatescreenshot', async function (req, res, next) {
    const clientinfo = req.body.clientinfo
    if (!clientinfo) {
        return respondStudentAuth(res, 'authrequired')
    }
    const servername = clientinfo.servername
    const auth = resolveStudentForControl(req, servername)
    if (!auth.ok) {
        return respondStudentAuth(res, auth.reason)
    }
    const { mcServer, student } = auth
  
    if (req.body.screenshot ) {
        const screenshotBase64 = req.body.screenshot;   // the base64 string does not need to be converted, it can be used directly
        //let hash = crypto.createHash('md5').update(Buffer.from(screenshotBase64, 'base64')).digest("hex");  // compute MD5 hash of the base64 string

            student.imageurl = 'data:image/jpeg;base64,' + screenshotBase64; // or 'data:image/png;base64,' depending on actual image format

            if (!student.focus) { // Archiviere Screenshot, wenn Student nicht fokussiert ist
                log.info("control @ updatescreenshot: Student out of focus - securing screenshots");
                let time = new Date().toISOString().substr(11, 8).replace(/:/g, "_");
                const shotPart = safeScreenshotFileName(req.body.screenshotfilename) || safeScreenshotFileName('shot.png');
                const finalName = `${time}-${shotPart}`;
                if (!isSafePathSegment(finalName)) {
                    log.warn(`control @ updatescreenshot: rejected screenshot filename (${finalName})`);
                } else {
                const filepath = resolvePathUnderRoot(config.workdirectory, [mcServer.serverinfo.servername, student.clientname, "focuslost"]);
                const absoluteFilename = filepath ? resolvePathUnderRoot(filepath, [finalName]) : null;
            
                try {
                    if (!filepath || !absoluteFilename) {
                        log.warn('control @ updatescreenshot: rejected unsafe focuslost path');
                    } else {
                    await fs.promises.mkdir(filepath, { recursive: true });
                    let screenshotBuffer = Buffer.from(req.body.screenshot, 'base64');    // Konvertieren des Base64-Strings in einen Buffer und Speichern der Datei
                    await fs.promises.writeFile(absoluteFilename, screenshotBuffer);
                    }
                } catch (err) { log.error(`control @ updatescreenshot: ${err}` ); }
                }
            }
      
    } else {
        //log.warn('control @ updatescreenshot: Screenshot or hash not provided');
        student.imageurl = "person-lines-fill.svg"
    }
    res.send({sender: "server", message:t("control.studentupdate"), status:"success" })
})


/**
 * Receive ABGABE & PRINTREQUEST From Student
 * @param servername the name of the server at which the student is registered
 * @param token the students token to search and update the entry in the list
 */
router.post('/submission/:servername', async function (req, res, next) {
    const servername = req.params.servername
    const pdfDocument = req.body.document
    const printrequest = req.body.printrequest
    const submissionnumber = req.body.submissionnumber
    const lockedsection = safeSectionFolderId(req.body.lockedsection)
    const saveReason = typeof req.body.saveReason === 'string' ? req.body.saveReason : 'n/a'

    const auth = resolveStudentForControl(req, servername)
    if (!auth.ok) {
        return respondStudentAuth(res, auth.reason)
    }
    const { mcServer, student } = auth
    
    if (printrequest){   
        student.printrequest = pdfDocument  // we put the base64 string of the document on printrequest which is checked by the frontend on every fetch cycle
    }

    // track student submissions on the server because of possible reconnects and resets on the student side
    // if (student.submissionnumber === undefined){
    //     student.submissionnumber = 1    // first submission
    // }
    // else {
    //     student.submissionnumber += 1
    // }

    let safeStudent = student.clientname.replace(/\s+/g, '_')  // replace spaces with "_"
    let now = new Date()
  
    let timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`
    let filename = `${servername}-${safeStudent}-${submissionnumber}-${timestamp}.pdf`
    if (!isSafePathSegment(filename)) {
        log.error(`control @ submission: rejected generated filename (${filename})`);
        return res.status(500).send({ sender: 'server', message: t("control.submissionfailed"), status: 'error' });
    }

   
    const pdfBuffer = Buffer.from(pdfDocument, 'base64');

    try {
        const filepath = resolvePathUnderRoot(config.workdirectory, [mcServer.serverinfo.servername, student.clientname, 'ABGABE', lockedsection])
        if (!filepath) {
            log.error('control @ submission: unsafe filepath');
            return res.status(500).send({ sender: 'server', message: t("control.submissionfailed"), status: 'error' });
        }
        await fsp.mkdir(filepath, { recursive: true })                                        // ensure dir
        const absoluteFilename = resolvePathUnderRoot(filepath, [filename])
        if (!absoluteFilename) {
            log.error('control @ submission: unsafe absoluteFilename');
            return res.status(500).send({ sender: 'server', message: t("control.submissionfailed"), status: 'error' });
        }
        await fsp.writeFile(absoluteFilename, pdfBuffer)                                       // write main

        const formData = req.body.formData
        if (formData && typeof formData === 'object' && !Array.isArray(formData)) {
            const htmName = filename.replace(/\.pdf$/i, '.htm')
            if (isSafePathSegment(htmName)) {
                const absoluteHtm = resolvePathUnderRoot(filepath, [htmName])
                if (absoluteHtm) {
                    await fsp.writeFile(absoluteHtm, JSON.stringify(formData, null, 2), 'utf8')
                    if (config.backupdirectory) {
                        const backuppath = resolvePathUnderRoot(config.backupdirectory, [mcServer.serverinfo.servername, student.clientname, 'ABGABE', lockedsection])
                        const absoluteBackupHtm = backuppath ? resolvePathUnderRoot(backuppath, [htmName]) : null
                        if (absoluteBackupHtm) {
                            await fsp.writeFile(absoluteBackupHtm, JSON.stringify(formData, null, 2), 'utf8')
                        }
                    }
                }
            }
        }

        log.info(`control @ submission: Received and stored submission file for user: ${student.clientname} saveReason=${saveReason}`)
        WindowHandler.mainwindow.webContents.send('submission', { clientname: student.clientname, clientip: student.clientip, hostname: student.hostname, printrequest: !!printrequest, saveReason })
        // create backup of abgabe
        let backupStatus = 'skipped'                                                           // default backup status
        if (config.backupdirectory) {                                                          // optional backup
          const backuppath = resolvePathUnderRoot(config.backupdirectory, [mcServer.serverinfo.servername, student.clientname, 'ABGABE', lockedsection])
          if (!backuppath) {
            log.error('control @ submission: unsafe backuppath');
          } else {
          await fsp.mkdir(backuppath, { recursive: true })                                     // ensure backup dir
          const absoluteBackupFilename = resolvePathUnderRoot(backuppath, [filename])                       // backup path
          if (!absoluteBackupFilename) {
            log.error('control @ submission: unsafe backup file path');
          } else {
          await fsp.writeFile(absoluteBackupFilename, pdfBuffer)                               // write backup
          backupStatus = 'ok'                                                                  // backup ok
          }
          }
        }
      
        res.send({ sender: 'server', message: 'success', status: 'success', backup: backupStatus }) // respond success
      } catch (err) {
        log.error(`control @ submission: ${err}`)                                            // log error
        let message = t("control.submissionfailed")
        res.status(500).send({ sender: 'server', message: message, status: 'error' })   // respond error
      }
    
})

/**
 * Receive PRINTJOB From Student (no ABGABE)
 * Stores PDF under PRINTJOBS and triggers teacher-side printrequest UI flow.
 */
router.post('/printjob/:servername', async function (req, res, next) {
    const servername = req.params.servername
    const pdfDocument = req.body.document
    const submissionnumber = req.body.submissionnumber
    const lockedsection = safeSectionFolderId(req.body.lockedsection)
    const saveReason = typeof req.body.saveReason === 'string' ? req.body.saveReason : 'n/a'

    const auth = resolveStudentForControl(req, servername)
    if (!auth.ok) {
        return respondStudentAuth(res, auth.reason)
    }
    const { mcServer, student } = auth

    // trigger teacher dashboard printrequest flow (polled via studentlist)
    student.printrequest = pdfDocument

    let safeStudent = student.clientname.replace(/\s+/g, '_')
    let now = new Date()
    let timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    let filename = `${servername}-${safeStudent}-${submissionnumber}-${timestamp}.pdf`
    if (!isSafePathSegment(filename)) {
        log.error(`control @ printjob: rejected generated filename (${filename})`);
        return res.status(500).send({ sender: 'server', message: t("control.submissionfailed"), status: 'error' });
    }

    const pdfBuffer = Buffer.from(pdfDocument, 'base64');

    try {
        const filepath = resolvePathUnderRoot(config.workdirectory, [mcServer.serverinfo.servername, student.clientname, 'PRINTJOBS', lockedsection])
        if (!filepath) {
            log.error('control @ printjob: unsafe filepath');
            return res.status(500).send({ sender: 'server', message: t("control.submissionfailed"), status: 'error' });
        }
        await fsp.mkdir(filepath, { recursive: true })
        const absoluteFilename = resolvePathUnderRoot(filepath, [filename])
        if (!absoluteFilename) {
            log.error('control @ printjob: unsafe absoluteFilename');
            return res.status(500).send({ sender: 'server', message: t("control.submissionfailed"), status: 'error' });
        }
        await fsp.writeFile(absoluteFilename, pdfBuffer)

        log.info(`control @ printjob: Received and stored printjob file for user: ${student.clientname} saveReason=${saveReason}`)
        WindowHandler.mainwindow.webContents.send('submission', { clientname: student.clientname, clientip: student.clientip, hostname: student.hostname, printrequest: true, saveReason })

        let backupStatus = 'skipped'
        if (config.backupdirectory) {
            const backuppath = resolvePathUnderRoot(config.backupdirectory, [mcServer.serverinfo.servername, student.clientname, 'PRINTJOBS', lockedsection])
            if (!backuppath) {
                log.error('control @ printjob: unsafe backuppath');
            } else {
            await fsp.mkdir(backuppath, { recursive: true })
            const absoluteBackupFilename = resolvePathUnderRoot(backuppath, [filename])
            if (!absoluteBackupFilename) {
                log.error('control @ printjob: unsafe backup file path');
            } else {
            await fsp.writeFile(absoluteBackupFilename, pdfBuffer)
            backupStatus = 'ok'
            }
            }
        }

        res.send({ sender: 'server', message: 'success', status: 'success', backup: backupStatus })
    } catch (err) {
        log.error(`control @ printjob: ${err}`)
        let message = t("control.submissionfailed")
        res.status(500).send({ sender: 'server', message: message, status: 'error' })
    }
})















export default router

/** Parses Authorization: Bearer <token> for student control routes (not register/oauth/msauth). */
function bearerTokenFromRequest(req) {
    const h = req.headers?.authorization
    if (!h || typeof h !== 'string') return null
    const m = /^Bearer\s+(\S+)/i.exec(h.trim())
    return m ? m[1] : null
}

/** Resolves mcServer+student by Bearer token and servername; reason authrequired|notavailable|removed. */
function resolveStudentForControl(req, servername) {
    const studenttoken = bearerTokenFromRequest(req)
    if (!studenttoken) return { ok: false, reason: 'authrequired' }
    const mcServer = config.examServerList[servername]
    if (!mcServer) return { ok: false, reason: 'notavailable' }
    const student = mcServer.studentList.find((el) => el.token === studenttoken)
    if (!student) return { ok: false, reason: 'removed' }
    return { ok: true, mcServer, studenttoken, student }
}

/** Sends consistent JSON for student auth failures on control routes. */
function respondStudentAuth(res, reason) {
    if (reason === 'authrequired') return res.send({ sender: 'server', message: 'authrequired', status: 'error' })
    if (reason === 'notavailable') return res.send({ sender: 'server', message: 'notavailable', status: 'error' })
    return res.send({ sender: 'server', message: 'removed', status: 'error' })
}



async function processSecurePayload(packet, sessionRef) {
    const PAD = '0'; 
    const enc = new TextEncoder(); // Initialize text encoder
    
    const raw = enc.encode((sessionRef + PAD).padEnd(32, '0').slice(0, 32));
    const k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); // Import key for decryption
    
    const iv = new Uint8Array(atob(packet.v).split('').map(c => c.charCodeAt(0))); // Decode IV from Base64
    const buf = new Uint8Array(atob(packet.d).split('').map(c => c.charCodeAt(0))); // Decode data from Base64
  
    const res = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, buf); // Decrypt the buffer
    return JSON.parse(new TextDecoder().decode(res)); // Parse and return JSON
  }


//this is needed by the /oauth and /msauth routes 
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('hex');
}
function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}
function base64UrlEncode(str) {
    return str.toString('base64')
    .replace('+', '-')
    .replace('/', '_')
    .replace(/=+$/, '');
}


