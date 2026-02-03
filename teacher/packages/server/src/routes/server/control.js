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
import multiCastserver from '../../../../main/scripts/multicastserver.js'
import multiCastclient from '../../../../main/scripts/multicastclient.js'
import crypto from 'crypto';
import config from '../../../../main/config.js'
import path from 'path'
import i18n from '../../../../renderer/src/locales/locales.js'
const { t } = i18n.global
import fs from 'fs' 
import qs from 'qs'
import axios from "axios"
import { msalConfig } from '../../../../renderer/src/msalutils/authConfig'
import log from 'electron-log';

import WindowHandler from '../../../../main/scripts/windowhandler.js'
import Tesseract from 'tesseract.js';
let TesseractWorker = false

import { app } from 'electron'
const __dirname = import.meta.dirname;
const fsp = fs.promises 

/**
 * this route generates the nessesary codeVerifier and codeChallenge für PKCE 
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
        const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', qs.stringify({
            client_id: msalConfig.auth.clientId,
            grant_type: 'authorization_code',
            scope: 'openid profile offline_access Files.ReadWrite.AppFolder Files.Read Files.ReadWrite',
            code,
            redirect_uri: msalConfig.auth.redirectUri,
            code_verifier: codeVerifier,
            }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://localhost',
            },
        });

        config.accessToken = response.data.access_token     // we received the access token - store it on global config object

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
        console.error(error.response.data);
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
                <h4>${error.response.data.error_description}</h4> <br>
                Please close this Window and try again! <br>
                <button onclick="window.close()" class="custom-btn custom-btn-danger">Close Window</button>
            </body>
        </html>`
        res.status(500).send(html);
    }
  });






/**
 * STARTS an exam server instance
 * @param servername the chosen name (for example "mathe")
 * @param password the password to enter the exam (not neccessary on single instance system (app) but will be used to exit secure exam mode in the future)
 * #FIXME !!!  This route needs to be secured (anyone can start a server right now - or 1000 servers)
 */
 router.post('/start/:servername/:passwd?', async function (req, res, next) {
    // this route may be used by localhost only
    if (!requestSourceAllowed(req, res)) return   // for the webversion we need to check user permissions here (future stuff)

    const bip = req.body.bip  // this info is also sent via multicastserver message
    const bipId = req.body.bipId

    const servername = req.params.servername 
    const mcServer = config.examServerList[servername]

    // log.info(req.body) // holds workdir: we could store the current workdirectory for every mcserver on mcserver.serverinfo in the future
    
    //generate random pin
    let pin = String(Math.floor(Math.random()*9000) + 1000)  // 4 digits is enough  Math.floor(Math.random() * 9000) + 1000;
    if (config.development){ pin = "1337" }  

    // // check if server is already running locally or in LAN
    if (mcServer) { 
        return res.send( {sender: "server", message: t("control.serverexists"), status: "error"})
    } 

    for (const exam of multiCastclient.examServerList) {  // do not use forEach() because its run async and the interpreter will not wait for it to finish
        if (servername == exam.servername ){
            return res.send( {sender: "server", message: t("control.serverexistsLAN"), status: "error"})
        }
     }
    
    log.info('control @ start: Initializing new Exam Server:', servername)
    let mcs = new multiCastserver();

    if (!req.params.passwd){ 
        mcs.init(servername, pin, "", bip, bipId)
    }
    else {
        mcs.init(servername, pin, req.params.passwd, bip, bipId)
    }

    config.examServerList[servername]=mcs
    // log.info(config.workdirectory)
    let serverinstancedir = path.join(config.workdirectory, servername)

    try {
        await fs.promises.mkdir(serverinstancedir, { recursive: true });
    } catch (err) {
        // Directory might already exist, that's ok
    }
    res.send( {sender: "server", message: t("control.serverstarted"), status: "success"})
    
})



/**
 * STOPS an exam server instance
 * @param servername the name of the exam server in question
 * @param csrfservertoken the servers csrf token needed to process the request (generated and transferred to the webbrowser on login) 
 */
 router.get('/stopserver/:servername/:csrfservertoken', function (req, res, next) {
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]

    if (mcServer && req.params.csrfservertoken === mcServer.serverinfo.servertoken) {
      
        mcServer.broadcastInterval.stop()

        mcServer.server.close();
        //delete mcServer
        delete config.examServerList[servername]
        res.send( {sender: "server", message: t("control.serverstopped"), status: "success"})

        
    }
})


/**
 * checks serverpassword for login via VUE ROUTER
 * @param servername the chosen name (for example "mathe")
 * @param passwd the password needed to enter the dashboard  !!FIXME: use https and proper auth 
 **/
 router.get('/checkpasswd/:servername/:passwd?', function (req, res, next) {
    const servername = req.params.servername 
    let passwd = req.params.passwd
    if (!passwd){ passwd = ""}   // we allow empty passwords for now
    const mcServer = config.examServerList[servername]

    if (mcServer) { 
        if (passwd === mcServer.serverinfo.password){ 
        return res.send( {
            sender: "server", 
            message: t("control.correctpw"), 
            status: "success", 
            data: {
            pin: mcServer.serverinfo.pin,
            servertoken: mcServer.serverinfo.servertoken,
            serverip: mcServer.serverinfo.ip
            } 
        } )} 
        else { return res.send( {sender: "server", message: t("control.wrongpw"), status: "error"}) }
    } 
    else {
        res.send( {sender: "server", message: t("control.notfound"), status: "error"})
    }
})


/**
 *  sends a list of all running exam servers
 */
router.get('/serverlist', function (req, res, next) {
    let serverlist = []
    Object.values(config.examServerList).forEach( server => {
        serverlist.push({servername: server.serverinfo.servername, id: server.serverinfo.id, serverip: server.serverinfo.ip, reachable: true, password: server.serverinfo.password, version: server.serverinfo.version}) 
    });
    res.send({serverlist:serverlist, status: "success"})
})

/**
 *  sends an "alive" signal back
 */
 router.get('/pong', function (req, res, next) {
    res.send('pong')
})


router.post('/pong', function (req, res, next) {
    res.send({ status: "success"})
})




let democlients = []
for (let i = 0; i<16; i++ ){
    let democlient = {
        clientname: `user-${ crypto.randomBytes(6).toString('hex')  }`,
        token: `csrf-${crypto.randomUUID()}`,
        ip: false,
        hostname: false,
        serverip: false,
        servername: false,
        focus: true,
        exammode: false,
        timestamp: new Date().getTime() ,
        virtualized: true,  // this config setting is set by simplevmdetect.js (electron preload)
        examtype : false,
        pin: false,
        screenlock: false,
        imageurl:"user-black.svg",
        status : {} 
    }
    democlients.push(democlient)
}






/**
 *  REGISTER CLIENT
 *  checks pin code, creates csrf token for client, answeres with token
 *
 *  @param pin  the pincode to connect to the serverinstance
 *  @param clientname the name of the student
 *  @param clientip the clients ip address for api calls
 */



 router.get('/registerclient/:servername/:pin/:clientname/:clientip/:hostname/:version/:bipuserid', async function (req, res, next) {
    const clientname = req.params.clientname
    const clientip = req.params.clientip
    const pin = req.params.pin
    const version = req.params.version
    const servername = req.params.servername
    const token = `csrf-${crypto.randomUUID()}`
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const hostname = req.params.hostname
    const bipuserID = req.params.bipuserid

    log.info("control @ registerclient: Client Version:",version)
    // this needs to change once we reached v1.0 (featurefreeze for stable version)
    let vteacher = config.version.split('.').slice(0, 2),
    versionteacher = vteacher.join('.'); 
    let vstudent = version.split('.').slice(0, 2),
    versionstudent = vstudent.join('.'); 

    //console.log(versionteacher, versionstudent)
  
    if (!mcServer) {  return res.send({sender: "server", message:t("control.notfound"), status: "error"} )  }
    if (`${versionteacher}` !== versionstudent ) {  return res.send({sender: "server", message:t("control.versionmismatch"), status: "error", version: config.version, versioninfo: config.info} )  }  
    
    if (mcServer.serverstatus.requireBiP && bipuserID == 'false'){ // req.params come as string.. not nice but simple
        return res.send({sender: "server", message:t("control.biprequired"), status: "error"} ) 
    }
    try {
        if (pin == mcServer.serverinfo.pin) {
            let registeredClient = mcServer.studentList.find(element => element.clientname === clientname)
        
            

            if (!registeredClient) {   // create client object
                log.info(`control @ registerclient: adding new client '${clientname}'`)


                //group handling - everybody is in groupA except there is already a group configuration
                let group = false;
                if (mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupA?.users?.includes(clientname)) { group = 'a'; } 
                else if (mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupB?.users?.includes(clientname)) { group = 'b';  }
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
                    exammode: false,
                    imageurl:false,
                    virtualized: false,
                    bipuserID: bipuserID,  // we can use this in the future to re-check if this user is in the pre-defined userlist for this specific BIP exam
                    status: { group: group || 'a'},    // we use this to store (per student) information about whats going on on the serverside (tasklist) and send it back on /update
                    // we allow two groups (this is just used for distribution of files by now)
                }
                //create folder for student
                let studentfolder =path.join(config.workdirectory, mcServer.serverinfo.servername , clientname);
            
            
                try {
                    await fs.promises.access(studentfolder); // Check if directory exists
                    // das verzeichnis für diesen student existiert 
                    // auf unix ist der ordnername 100% ident - auf windows könnte es aber in der gross/kleinschreibung unterschiede geben
                    // prüfe ob es EXAKT gleich geschrieben wurde (case-sensitiv)
                    
                    const parentDir = path.dirname(studentfolder);
                    const targetDirName = path.basename(studentfolder);
                    const directories = (await fs.promises.readdir(parentDir, { withFileTypes: true }))
                                        .filter(dirent => dirent.isDirectory())
                                        .map(dirent => dirent.name);


                    if (!directories.includes(targetDirName)) {  // wir haben windows ertappt.. der dateiname ist nicht 100% ident "Test" !== "test"
                        
                        const existingDir = directories.find(dir => dir.toLowerCase() === targetDirName.toLowerCase());
                        if (existingDir) {
                            const oldPath = path.join(parentDir, existingDir);
                            const newPath = path.join(parentDir, `backup-${existingDir}`);
                            await fs.promises.rename(oldPath, newPath);  // Umbenennen des alten Verzeichnisses
                            log.warn(`control @ registerclient: Renaming ${oldPath} to ${newPath} - thx bill gates for the worst operating system otw`)
                        }
                    }
                    else {
                        log.warn(`control @ registerclient: Using already existing directory: ${targetDirName}`)
                    }
                } catch (err) {
                    // Das Verzeichnis existiert nicht, erstelle es
                    try {
                        await fs.promises.mkdir(studentfolder, { recursive: true });
                        log.info(`control @ registerclient: Creating ${studentfolder}`);
                    } catch (mkdirErr) {
                        log.error(`control @ registerclient: Error creating directory: ${mkdirErr}`);
                    }
                }

                try {
                    await fs.promises.mkdir(config.tempdirectory, { recursive: true });
                } catch (err) {
                    // Directory might already exist, that's ok
                }

                mcServer.studentList.push(client)
                return res.json({sender: "server", message:t("control.registered"), status: "success", token: token})  // on success return client token (auth needed for server api)
            }
            else {

                let now = new Date().getTime()
                if (now - 20000 > registeredClient.timestamp) { // student probably went offline (teacher connection loss) but is coming back now
                    registeredClient.timestamp = now
                    log.info("control @ registerclient: student reconnected")

                    //inform frontend about re-connection
                    WindowHandler.mainwindow.webContents.send("reconnected", registeredClient)
                    return res.json({sender: "server", message:t("control.registered"), status: "success", token: registeredClient.token})  //send back old token
                }
                else {
                    return res.json({sender: "server", message:t("control.alreadyregistered"), status: "error"})
                }  
            }
        }
        else {
            return res.json({sender: "server", message:t("control.wrongpin"), status: "error"})
        }
    }
    catch (err){
        log.error(`control @ registerclient: ${err}`);
        return res.json({sender: "server", message:"an unknown error occured", status: "error"})
    }
})


















/**
 * INFORM Client(s) about a "sendfile" request from the server (clients should download the file(s) via /data/download/... route) 
 * @param servename the server that waits with the file
 * @param csrfservertoken the servers token to authenticate
 * @param studenttoken the students token who should send the exam (false means everybody)
 */
 router.post('/sendtoclient/:servername/:csrfservertoken/:studenttoken', function (req, res, next) {
    const servername = req.params.servername
    const studenttoken = req.params.studenttoken
    const mcServer = config.examServerList[servername]
    const files = req.body.files   //  { files:[ {name:file.name, path:file.path }, {name:file.name, path:file.path } ] }
   
    if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {  //first check if csrf token is valid and server is allowed to trigger this api request
        if (studenttoken === "all"){
            for (let student of mcServer.studentList){ 
                student.status['fetchfiles'] = true  
                student.status['files'] =  files
            }
        }
        else {
            let student = mcServer.studentList.find(element => element.token === studenttoken)
            if (student) {  
                student.status['fetchfiles']= true 
                student.status['files'] = files
            }   
        }
        res.send( {sender: "server", message: t("control.examrequest"), status: "success"} )
    }
    else {
        res.send( {sender: "server", message: t("control.actiondenied"), status: "error"} )
    }
})










/**
 *  KICK client - client will get error response on next update and remove connection automatically
 * @param servename the server that wants to kick the client
 * @param csrfservertoken the servers token to authenticate
 * @param studenttoken the students token who should be kicked
 */
//  router.get('/kick/:servername/:csrfservertoken/:studenttoken', function (req, res, next) {
//     const servername = req.params.servername
//     const studenttoken = req.params.studenttoken
//     const mcServer = config.examServerList[servername]

//     if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {  //first check if csrf token is valid and server is allowed to trigger this api request
//         let student = mcServer.studentList.find(element => element.token === studenttoken)
//         if (student) {   mcServer.studentList = mcServer.studentList.filter( el => el.token !==  studenttoken); } // remove client from studentlist
//         res.send( {sender: "server", message: t("control.studentremove"), status: "success"} )
//     }
//     else {
//         res.send( {sender: "server", message: t("control.actiondenied"), status: "error"} )
//     }
// })




/**
 * SET cients SHARE LINK for microsoft365 mode
 * @param servename the servers name
 * @param csrfservertoken the servers token to authenticate
 * @param studenttoken the students token who should be kicked
 */
router.post('/sharelink/:servername/:csrfservertoken/:studenttoken', function (req, res, next) {
    const servername = req.params.servername
    const studenttoken = req.params.studenttoken
    const mcServer = config.examServerList[servername]
    const sharelink = req.body.sharelink

    if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {  //first check if csrf token is valid and server is allowed to trigger this api request
        let student = mcServer.studentList.find(element => element.token === studenttoken)
        if (student) {   
            student.status.msofficeshare = sharelink
         }
        res.send( {sender: "server", message: t("control.studentupdate"), status: "success"} )
    }
    else {
        res.send( {sender: "server", message: t("control.actiondenied"), status: "error"} )
    }
})




/**
 * RESTORE cients focused state  !! USE /setstudentstatus/ instead (simplify code)
 * @param servename the server 
 * @param csrfservertoken the servers token to authenticate
 * @param studenttoken the students token who's state should be restored
 */
 router.get('/restore/:servername/:csrfservertoken/:studenttoken', function (req, res, next) {
    const servername = req.params.servername
    const studenttoken = req.params.studenttoken
    const mcServer = config.examServerList[servername]

    if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {  //first check if csrf token is valid and server is allowed to trigger this api request
        let student = mcServer.studentList.find(element => element.token === studenttoken)
        if (student) {   
            student.status.restorefocusstate = true  // set student.status so that the student can restore its focus state on the next update
         }
        res.send( {sender: "server", message: t("control.staterestore"), status: "success"} )
    }
    else {
        res.send( {sender: "server", message: t("control.actiondenied"), status: "error"} )
    }
})

















/**
 * FETCH EXAMS from connected clients (set student.status - students will then send their workdirectory to /data/receive)
 * attention!!  move to setStudentStatus eventually.. because its redundant
 * @param servename the server that wants to kick the client
 * @param csrfservertoken the servers token to authenticate
 * @param studenttoken the students token who should send the exam (false means everybody)
 */
 router.get('/fetch/:servername/:csrfservertoken/:studenttoken', function (req, res, next) {
    const servername = req.params.servername
    const studenttoken = req.params.studenttoken
    const mcServer = config.examServerList[servername]

    if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {  //first check if csrf token is valid and server is allowed to trigger this api request
        if (studenttoken === "all"){
            for (let student of mcServer.studentList){ student.status['sendexam'] = true  }
        }
        else {
            let student = mcServer.studentList.find(element => element.token === studenttoken)
            if (student) {  student.status['sendexam']= true  }   
        }
        res.send( {sender: "server", message: t("control.examrequest"), status: "success"} )
    }
    else {
        res.send( {sender: "server", message: t("control.actiondenied"), status: "error"} )
    }
})






/**
 * Get previous Serverstatus and return Serverstatus from FILE (from previous interrupted exam in order to resume)
 * @param servername the name of the server 
 * @param csrfservertoken servertoken to authenticate before the request is processed
 */
router.post('/getserverstatus/:servername/:csrfservertoken', async function (req, res, next) {
    const csrfservertoken = req.params.csrfservertoken
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]
    if (!mcServer) {  return res.send({sender: "server", message:t("control.notfound"), status: "error"} )  }
    if (csrfservertoken !== mcServer.serverinfo.servertoken) { return res.send({sender: "server", message:t("control.tokennotvalid"), status: "error"} )}
    // mcServer.serverstatus von der JSON-Datei wieder importieren
    const filePath = path.join(config.workdirectory, mcServer.serverinfo.servername, 'serverstatus.json');
    let serverstatus;
    try {  
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        serverstatus = JSON.parse(fileContent); 
        mcServer.serverinfo.pin = serverstatus.pin  //also restore last pin to make it easier for students
    }    
    catch (error) {  serverstatus = false;  }
    return res.json({sender: "server", status: "success", serverstatus: serverstatus}) 
})

//get current serverstatus from mcserver
router.get('/getcurrentserverstatus/:servername/:csrfservertoken', function (req, res, next) {
    const csrfservertoken = req.params.csrfservertoken
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]
    if (!mcServer) {  return res.send({sender: "server", message:t("control.notfound"), status: "error"} )  }
    if (csrfservertoken !== mcServer.serverinfo.servertoken) { return res.send({sender: "server", message:t("control.tokennotvalid"), status: "error"} )}
   
    return res.json({sender: "server", status: "success", serverstatus: mcServer.serverstatus}) 
})




/**
 * Set Serverstatus 
 * Students fetch the serverstatus object every updatecycle and act on it (start exam, lockscreens,etc)
 * @param servername the name of the server
 * @param csrfservertoken servertoken to authenticate before the request is processed
 * @param req.body.serverstatus contains the whole serverstatus object
 */
router.post('/setserverstatus/:servername/:csrfservertoken', async function (req, res, next) {
    const csrfservertoken = req.params.csrfservertoken
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]
    if (!mcServer) {  return res.send({sender: "server", message:t("control.notfound"), status: "error"} )  }
    if (csrfservertoken !== mcServer.serverinfo.servertoken) { return res.send({sender: "server", message:t("control.tokennotvalid"), status: "error"} )}
    
    mcServer.serverstatus = req.body.serverstatus
    mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].msOfficeFile = false  // we cant store a file object as json

    //console.log("control:", mcServer.serverstatus)
    log.info("control @ setserverstatus: saving server status to disc")
    
    const workdir = path.join(config.workdirectory, mcServer.serverinfo.servername)
    const filePath = path.join(config.workdirectory, mcServer.serverinfo.servername, 'serverstatus.json');

    try {  
        await fs.promises.mkdir(workdir, { recursive: true });
        const jsonString = JSON.stringify(mcServer.serverstatus, null, 2);
        // Validate JSON before writing to prevent invalid JSON files
        JSON.parse(jsonString);
        await fs.promises.writeFile(filePath, jsonString);  
    }   // mcServer.serverstatus als JSON-Datei speichern
    catch (error) {  
        log.error(`control @ setserverstatus: ${error}` );
        return res.json({ sender: "server", message:"could not save serverstatus to disc", status: "error" });
    }

    res.json({ sender: "server", message:t("general.ok"), status: "success" })
})















/**
 * Set STUDENT.STATUS and therefore Inform Client on the next update cycle about a denied printrequest (we handle one request at a time) and other things.
 * @param servename the server 
 * @param csrfservertoken the servers token to authenticate
 * @param studenttoken the students token who should be informed
 */
router.post('/setstudentstatus/:servername/:csrfservertoken/:studenttoken', function (req, res, next) {
    const servername = req.params.servername
    const studenttoken = req.params.studenttoken
    const mcServer = config.examServerList[servername]
    
    const printdenied = req.body.printdenied
    const delfolder = req.body.delfolder
    const activatePrivateSpellcheck = req.body.activatePrivateSpellcheck
    const activatePrivateSuggestions = req.body.activatePrivateSuggestions
    const removeprintrequest = req.body.removeprintrequest
    const group = req.body.group
    const kicked = req.body.kick
    const msofficeshare = req.body.msofficeshare
    const getmaterials = req.body.getmaterials


    if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {  //first check if csrf token is valid and server is allowed to trigger this api request
        
        if (studenttoken === "all"){
            for (let student of mcServer.studentList){ 
                if (delfolder)  { student.status.delfolder = true   } // on the next update cycle the student gets informed to delete workfolder
                if (group) {student.status.group = group; }
                if (typeof msofficeshare !== 'undefined') {student.status.msofficeshare = msofficeshare; }   // we need to set this to false for every student to trigger a new upload of the msOfficeFile on section change
                if (getmaterials) {student.status.getmaterials = true; }
            }
        }
        else {
            let student = mcServer.studentList.find(element => element.token === studenttoken)
            if (student) {  
                // here we handle different forms of information that needs to be set on studentstatus (dont forget to reset those values in /update/route)
                if (printdenied){ 
                    student.status.printdenied = true // set student.status so that the student can act on it on the next update
                    student.printrequest = false  // unset printrequest so that dashboard fetchInfo (which fetches the studentlist) doesnt trigger it again
                } 
                if (delfolder)  { student.status.delfolder = true   } // on the next update cycle the student gets informed to delete workfolder
                if (activatePrivateSpellcheck) {    // allow spellcheck for this specific student (special cases)
                    student.status.activatePrivateSpellcheck = true; 
                    student.status.activatePrivateSuggestions = activatePrivateSuggestions;
                }
                else {
                    student.status.activatePrivateSpellcheck = false;
                    student.status.activateSuggestions = false;
                }
                if (removeprintrequest == true){ student.printrequest = false }  // unset printrequest so that dashboard fetchInfo (which fetches the studentlist) doesnt trigger it again
                if (group) {student.status.group = group; }
                if (typeof msofficeshare !== 'undefined') {student.status.msofficeshare = msofficeshare; }
                if (kicked) { student.status.kicked = true }
                if (getmaterials) {student.status.getmaterials = true; }

                //log.info("control @ setstudentstatus:", req.body)
              
            }
            let now = new Date().getTime()
      
            if (now - 20000 > student.timestamp && student.status.kicked)    {
                let student = mcServer.studentList.find(element => element.token === studenttoken)
                if (student) {   mcServer.studentList = mcServer.studentList.filter( el => el.token !==  studenttoken); } // remove client from studentlist
            }

        }
        res.send( {sender: "server", message: t("control.studentupdate"), status: "success"} )
    }
    else {
        res.send( {sender: "server", message: t("control.actiondenied"), status: "error"} )
    }
})





/**
 * THE FOLLOWING ROUTES ARE ACCESSED BY STUDENTS ONLY
 */


/**
 * UPDATES Clientinfo - the specified students timestamp (used in dashboard to mark user as online) and other status updates
 * FETCHES Serverstatus & Studentstatus
 * usually triggered by the clients directly from the Main Process (loop)
 * @param servername the name of the server at which the student is registered
 * @param token the students token to search and update the entry in the list
 */
 router.post('/update', function (req, res, next) {
    const clientinfo = req.body.clientinfo
    const studenttoken = clientinfo.token
    const exammode = clientinfo.exammode
    const servername = clientinfo.servername

    //check if server and student exist
    const mcServer = config.examServerList[servername]
    if ( !mcServer) {  return res.send({sender: "server", message:"notavailable", status: "error"} )  }  // server is gone - disconnect student

    let student = mcServer.studentList.find(element => element.token === studenttoken)
    if ( !student ) {return res.send({ sender: "server", message:"removed", status: "error" }) } // student kicked - disconnect student

    //update important student attributes
    student.focus = clientinfo.focus
    student.virtualized = clientinfo.virtualized
    student.timestamp = new Date().getTime()   //last seen  / this is like a heartbeat - update lastseen
    student.exammode = exammode  
    student.files = clientinfo.numberOfFiles
    student.remoteassistant = clientinfo.remoteassistant

    if (clientinfo.focus) { student.status.restorefocusstate = false }  // remove task because its obviously done
    if (clientinfo.screenshotinterval == 0){ student.imageurl = "person-lines-fill.svg"  }

    let studentstatus = JSON.parse(JSON.stringify(student.status))  // copy current status > send copy of original to student
   
    // teacher sets studentstatus.kick to true - the moment the student fetches his status and knwon he's kicked he will be removed from the server
    if (student.status.kicked)    {
        let student = mcServer.studentList.find(element => element.token === studenttoken)
        if (student) {   mcServer.studentList = mcServer.studentList.filter( el => el.token !==  studenttoken); } // remove client from studentlist
    }


    // reset some status values that are only used to transport something once
    student.status.printdenied = false 
    student.status.delfolder = false 
    student.status.sendexam = false // request only once
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
    const studenttoken = clientinfo.token
    const servername = clientinfo.servername

    // check if student@server exists
    const mcServer = config.examServerList[servername]
    if ( !mcServer) {  return res.send({sender: "server", message:"notavailable", status: "error"} )  }
    let student = mcServer.studentList.find(element => element.token === studenttoken)
    if ( !student ) {return res.send({ sender: "server", message:"removed from server", status: "error" }) } //check if the student is registered on this server
  
    if (req.body.screenshot ) {
        const screenshotBase64 = req.body.screenshot;   // Der Base64-String muss nicht konvertiert werden, er kann direkt verwendet werden
        //let hash = crypto.createHash('md5').update(Buffer.from(screenshotBase64, 'base64')).digest("hex");  // Berechnen des MD5-Hashs des Base64-Strings
        
            student.imageurl = 'data:image/jpeg;base64,' + screenshotBase64; // oder 'data:image/png;base64,' je nach tatsächlichem Bildformat  

            // only scan screenshot in exam mode and NOT if a restoring/unlocking operation is already in process (otherwise it will lock the unlocked again)
            if (mcServer.serverstatus.exammode && mcServer.serverstatus.screenshotocr && !student.status.restorefocusstate && student.focus){
                try{
                    const header = req.body.header.split(';base64,').pop();
                    const headerimageBuffer = Buffer.from(header, 'base64');


                    const publicPath = app.isPackaged
                    ? path.join(process.resourcesPath,'app.asar.unpacked', 'public')
                    : path.resolve(__dirname, '../../public');
                    
                    if (!TesseractWorker){
                        TesseractWorker = await Tesseract.createWorker('eng',1,{
                            langPath: publicPath , 
                        });
                    }
                     
                    const { data: { text } }  = await TesseractWorker.recognize(headerimageBuffer);
                    let pincodeVisible = text.includes(mcServer.serverinfo.pin)

                    if (!pincodeVisible){
                        student.focus = pincodeVisible  // this is the local student object for the frontend
                        student.status.focus = pincodeVisible  // this sets the studentstatus object which is fetched on every update - the students react on this
                        log.info("control @ updatescreenshot (ocr): Student Screenshot does not include Exam PIN");
                    }
                }
                catch(err){ log.info(`control @ updatescreenshot (ocr): ${err}`); }
            }

            if (!student.focus) { // Archiviere Screenshot, wenn Student nicht fokussiert ist
                log.info("control @ updatescreenshot: Student out of focus - securing screenshots");
                let time = new Date().toISOString().substr(11, 8).replace(/:/g, "_");
                let filepath = path.join(config.workdirectory, mcServer.serverinfo.servername, student.clientname, "focuslost");
                let absoluteFilename = path.join(filepath, `${time}-${req.body.screenshotfilename}`);
            
                try {
                    await fs.promises.mkdir(filepath, { recursive: true });
                    let screenshotBuffer = Buffer.from(req.body.screenshot, 'base64');    // Konvertieren des Base64-Strings in einen Buffer und Speichern der Datei
                    await fs.promises.writeFile(absoluteFilename, screenshotBuffer);
                } catch (err) { log.error(`control @ updatescreenshot: ${err}` ); }
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
router.post('/printrequest/:servername/:studenttoken', async function (req, res, next) {
    const studenttoken = req.params.studenttoken
    const servername = req.params.servername
    const pdfDocument = req.body.document
    const printrequest = req.body.printrequest
    const submissionnumber = req.body.submissionnumber
    const lockedsection = req.body.lockedsection || 1 // default to section 1 if not provided


    //check if server exists 
    const mcServer = config.examServerList[servername]
    if ( !mcServer) {  return res.send({sender: "server", message:"notavailable", status: "error"} )  }

    //check if student is registered on server
    let student = mcServer.studentList.find(element => element.token === studenttoken)
    if ( !student ) {return res.send({ sender: "server", message:"removed", status: "error" }) }
    
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


   
    const pdfBuffer = Buffer.from(pdfDocument, 'base64');


    try {
        const filepath = path.join(config.workdirectory, mcServer.serverinfo.servername, student.clientname, 'ABGABE', lockedsection.toString() ) // target dir
        await fsp.mkdir(filepath, { recursive: true })                                        // ensure dir
        const absoluteFilename = path.join(filepath, filename)                                 // build path
        await fsp.writeFile(absoluteFilename, pdfBuffer)                                       // write main
      
        log.info(`control @ printrequest: Received and stored submission file for user: ${student.clientname}`)
        // create backup of abgabe
        let backupStatus = 'skipped'                                                           // default backup status
        if (config.backupdirectory) {                                                          // optional backup
          const backuppath = path.join(config.backupdirectory, mcServer.serverinfo.servername, student.clientname, 'ABGABE', lockedsection.toString() )
          await fsp.mkdir(backuppath, { recursive: true })                                     // ensure backup dir
          const absoluteBackupFilename = path.join(backuppath, filename)                       // backup path
          await fsp.writeFile(absoluteBackupFilename, pdfBuffer)                               // write backup
          backupStatus = 'ok'                                                                  // backup ok
        }
      
        res.send({ sender: 'server', message: 'success', status: 'success', backup: backupStatus }) // respond success
      } catch (err) {
        log.error(`control @ printrequest: ${err}`)                                            // log error
        let message = t("control.submissionfailed")
        res.status(500).send({ sender: 'server', message: message, status: 'error' })   // respond error
      }
    
})















export default router



//do not allow requests from external hosts
function requestSourceAllowed(req,res){
    if (req.ip == "::1"  || req.ip == "127.0.0.1" || req.ip.includes('127.0.0.1') ){ 
      return true
    }  
    log.error(`Blocked request from remote Host: ${req.ip}`); 
    res.json('Request denied') 
    return false 
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


