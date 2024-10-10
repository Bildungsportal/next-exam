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
 router.post('/start/:servername/:passwd', function (req, res, next) {
    // this route may be used by localhost only
    if (!requestSourceAllowed(req, res)) return   // for the webversion we need to check user permissions here (future stuff)

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
    mcs.init(servername, pin, req.params.passwd)
    config.examServerList[servername]=mcs
    // log.info(config.workdirectory)
    let serverinstancedir = path.join(config.workdirectory, servername)

    if (!fs.existsSync(serverinstancedir)){ fs.mkdirSync(serverinstancedir, { recursive: true }); }
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
 router.get('/checkpasswd/:servername/:passwd', function (req, res, next) {
    const servername = req.params.servername 
    const passwd = req.params.passwd
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
        serverlist.push({servername: server.serverinfo.servername, serverip: server.serverinfo.ip, reachable: true}) 
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
 *  sends a list of all connected students { clientname: clientname, token: token, clientip: clientip }
 * @param servername the name of the exam server in question
 * @param csrfservertoken the servers csrf token needed to process the request (generated and transferred to the webbrowser on login) 
 */
 router.get('/studentlist/:servername/:csrfservertoken', function (req, res, next) {
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]

        //demo users start
      // for (let i = 0; i<democlients.length; i++ ){ democlients[i].timestamp= new Date().getTime()  }
      // mcServer.studentList = democlients
        //demo users end

    if (mcServer && req.params.csrfservertoken === mcServer.serverinfo.servertoken) {
        res.send({studentlist: mcServer.studentList})
    }
    else {
        res.send({sender: "server", message:t("control.notfound"), status: "error", studentlist: []} )
    }
})


/**
 *  REGISTER CLIENT
 *  checks pin code, creates csrf token for client, answeres with token
 *
 *  @param pin  the pincode to connect to the serverinstance
 *  @param clientname the name of the student
 *  @param clientip the clients ip address for api calls
 */



 router.get('/registerclient/:servername/:pin/:clientname/:clientip/:hostname/:version/:bipuserid', function (req, res, next) {
    const clientname = req.params.clientname
    const clientip = req.params.clientip
    const pin = req.params.pin
    const version = req.params.version
    const servername = req.params.servername
    const token = `csrf-${crypto.randomUUID()}`
    const mcServer = config.examServerList[servername] // get the multicastserver object
    const hostname = req.params.hostname
    const bipuserID = req.params.bipuserid

    log.info("control @ registerclient: ",version)
    // this needs to change once we reached v1.0 (featurefreeze for stable version)
    let vteacher = config.version.split('.').slice(0, 2),
    versionteacher = vteacher.join('.'); 
    let vstudent = version.split('.').slice(0, 2),
    versionstudent = vstudent.join('.'); 

  
    if (!mcServer) {  return res.send({sender: "server", message:t("control.notfound"), status: "error"} )  }
    if (`${versionteacher}` !== versionstudent ) {  return res.send({sender: "server", message:t("control.versionmismatch"), status: "error", version: config.version, versioninfo: config.info} )  }  
    
    if (mcServer.serverstatus.requireBiP && bipuserID == 'false'){ // req.params come as string.. not nice but simple
        return res.send({sender: "server", message:t("control.biprequired"), status: "error"} ) 
    }
    
    if (pin === mcServer.serverinfo.pin) {
        let registeredClient = mcServer.studentList.find(element => element.clientname === clientname)
       
        

        if (!registeredClient) {   // create client object
            log.info('control @ registerclient: adding new client')

            let group = false;
            if (mcServer.serverstatus.groupA?.includes(clientname)) { group = 'a'; } 
            else if (mcServer.serverstatus.groupB?.includes(clientname)) { group = 'b';  }


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
           
           
            if (fs.existsSync(studentfolder)) { 
                // das verzeichnis für diesen student existiert 
                // auf unix ist der ordnername 100% ident - auf windows könnte es aber in der gross/kleinschreibung unterschiede geben
                // prüfe ob es EXAKT gleich geschrieben wurde (case-sensitiv)
                
                const parentDir = path.dirname(studentfolder);
                const targetDirName = path.basename(studentfolder);
                const directories = fs.readdirSync(parentDir, { withFileTypes: true })
                                      .filter(dirent => dirent.isDirectory())
                                      .map(dirent => dirent.name);


                if (!directories.includes(targetDirName)) {  // wir haben windows ertappt.. der dateiname ist nicht 100% ident "Test" !== "test"
                    
                    const existingDir = directories.find(dir => dir.toLowerCase() === targetDirName.toLowerCase());
                    if (existingDir) {
                        const oldPath = path.join(parentDir, existingDir);
                        const newPath = path.join(parentDir, `backup-${existingDir}`);
                        fs.renameSync(oldPath, newPath);  // Umbenennen des alten Verzeichnisses
                        log.warn(`control @ registerclient: Renaming ${oldPath} to ${newPath} - thx bill gates for the worst operating system otw`)
                    }
                }
                else {
                    log.warn(`control @ registerclient: Using already existing directory: ${targetDirName}`)
                }
            } else { // Das Verzeichnis existiert nicht, erstelle es
                fs.mkdirSync(studentfolder, { recursive: true });
                console.log(`control @ registerclient: Creating ${studentfolder}`);
            }

           



            if (!fs.existsSync(config.tempdirectory)){ fs.mkdirSync(config.tempdirectory, { recursive: true }); }

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
        res.json({sender: "server", message:t("control.wrongpin"), status: "error"})
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
 router.get('/kick/:servername/:csrfservertoken/:studenttoken', function (req, res, next) {
    const servername = req.params.servername
    const studenttoken = req.params.studenttoken
    const mcServer = config.examServerList[servername]

    if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {  //first check if csrf token is valid and server is allowed to trigger this api request
        let student = mcServer.studentList.find(element => element.token === studenttoken)
        if (student) {   mcServer.studentList = mcServer.studentList.filter( el => el.token !==  studenttoken); } // remove client from studentlist
        res.send( {sender: "server", message: t("control.studentremove"), status: "success"} )
    }
    else {
        res.send( {sender: "server", message: t("control.actiondenied"), status: "error"} )
    }
})




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
router.post('/getserverstatus/:servername/:csrfservertoken', function (req, res, next) {
    const csrfservertoken = req.params.csrfservertoken
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]
    if (!mcServer) {  return res.send({sender: "server", message:t("control.notfound"), status: "error"} )  }
    if (csrfservertoken !== mcServer.serverinfo.servertoken) { res.send({sender: "server", message:t("control.tokennotvalid"), status: "error"} )}
    // mcServer.serverstatus von der JSON-Datei wieder importieren
    const filePath = path.join(config.workdirectory, mcServer.serverinfo.servername, 'serverstatus.json');
    let serverstatus;
    try {  
        serverstatus = JSON.parse(fs.readFileSync(filePath, 'utf-8')); 
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
    if (csrfservertoken !== mcServer.serverinfo.servertoken) { res.send({sender: "server", message:t("control.tokennotvalid"), status: "error"} )}
   
    return res.json({sender: "server", status: "success", serverstatus: mcServer.serverstatus}) 
})




/**
 * Set Serverstatus 
 * Students fetch the serverstatus object every updatecycle and act on it (start exam, lockscreens,etc)
 * @param servername the name of the server
 * @param csrfservertoken servertoken to authenticate before the request is processed
 * @param req.body.serverstatus contains the whole serverstatus object
 */
router.post('/setserverstatus/:servername/:csrfservertoken', function (req, res, next) {
    const csrfservertoken = req.params.csrfservertoken
    const servername = req.params.servername
    const mcServer = config.examServerList[servername]
    if (!mcServer) {  return res.send({sender: "server", message:t("control.notfound"), status: "error"} )  }
    if (csrfservertoken !== mcServer.serverinfo.servertoken) { res.send({sender: "server", message:t("control.tokennotvalid"), status: "error"} )}
    
    mcServer.serverstatus = req.body.serverstatus
    mcServer.serverstatus.msOfficeFile = false  // we cant store a file object as json

    //console.log("control:", mcServer.serverstatus)
    log.info("control @ serverstatus: saving server status to disc")
    const filePath = path.join(config.workdirectory, mcServer.serverinfo.servername, 'serverstatus.json');
    try {  fs.writeFileSync(filePath, JSON.stringify(mcServer.serverstatus, null, 2));  }   // mcServer.serverstatus als JSON-Datei speichern
    catch (error) {  log.error(error) }

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

    if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {  //first check if csrf token is valid and server is allowed to trigger this api request
        
        if (studenttoken === "all"){
            for (let student of mcServer.studentList){ 
                if (delfolder)  { student.status.delfolder = true   } // on the next update cycle the student gets informed to delete workfolder
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



                //log.info("control @ setstudentstatus:", req.body)
              
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
    const clientinfo = JSON.parse(req.body.clientinfo)
    const studenttoken = clientinfo.token
    const exammode = clientinfo.exammode
    const servername = clientinfo.servername

    //check if server and student exist
    const mcServer = config.examServerList[servername]
    if ( !mcServer) {  return res.send({sender: "server", message:"notavailable", status: "error"} )  }
    let student = mcServer.studentList.find(element => element.token === studenttoken)
    if ( !student ) {return res.send({ sender: "server", message:"removed", status: "error" }) } //check if the student is registered on this server

    //update important student attributes
    student.focus = clientinfo.focus
    student.virtualized = clientinfo.virtualized
    student.timestamp = new Date().getTime()   //last seen  / this is like a heartbeat - update lastseen
    student.exammode = exammode  
    student.files = clientinfo.numberOfFiles
    student.printrequest = clientinfo.printrequest

    if (clientinfo.focus) { student.status.restorefocusstate = false }  // remove task because its obviously done
    if (clientinfo.screenshotinterval == 0){ student.imageurl = "person-lines-fill.svg"  }

    let studentstatus = JSON.parse(JSON.stringify(student.status))  // copy current status > send copy of original to student
   
    // reset some status values that are only used to transport something once
    student.status.printdenied = false 
    student.status.delfolder = false 
    student.status.sendexam = false // request only once
    //student.status.activatePrivateSpellcheck = false   // activate only once - when student retrieved "studentstatus" we can reset some values of "student.status"

    // return current serverinformation to process on clientside
    res.charset = 'utf-8';
    res.send({sender: "server", message:t("control.studentupdate"), status:"success", serverstatus:mcServer.serverstatus, studentstatus: studentstatus })
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
    if ( !student ) {return res.send({ sender: "server", message:"removed", status: "error" }) } //check if the student is registered on this server
  


    if (req.body.screenshot && req.body.screenshothash) {
        const screenshotBase64 = req.body.screenshot;   // Der Base64-String muss nicht konvertiert werden, er kann direkt verwendet werden
        let hash = crypto.createHash('md5').update(Buffer.from(screenshotBase64, 'base64')).digest("hex");  // Berechnen des MD5-Hashs des Base64-Strings
        if (hash === req.body.screenshothash) {
            student.imageurl = 'data:image/jpeg;base64,' + screenshotBase64; // oder 'data:image/png;base64,' je nach tatsächlichem Bildformat  
            
            if (mcServer.serverstatus.exammode && mcServer.serverstatus.screenshotocr){
                try{
                    const header = req.body.header.split(';base64,').pop();
                    const headerimageBuffer = Buffer.from(header, 'base64');
                    if (!TesseractWorker){
                        TesseractWorker = await Tesseract.createWorker('eng');
                    }
                     

                    const { data: { text } }  = await TesseractWorker.recognize(headerimageBuffer);
                    let pincodeVisible = text.includes(mcServer.serverinfo.pin)

                    if (!pincodeVisible){
                        student.focus = pincodeVisible
                        log.info("control @ updatescreenshot (ocr): Student Screenshot does not include Exam PIN");
                    }
                }
                catch(err){
                    log.info(`control @ updatescreenshot (ocr): ${err}`);
                }
                
            }

   

            if (!student.focus) { // Archiviere Screenshot, wenn Student nicht fokussiert ist
                log.info("control @ updatescreenshot: Student out of focus - securing screenshots");
                let time = new Date().toISOString().substr(11, 8).replace(/:/g, "_");
                let filepath = path.join(config.workdirectory, mcServer.serverinfo.servername, student.clientname, "focuslost");
                let absoluteFilename = path.join(filepath, `${time}-${req.body.screenshotfilename}`);
            
                try {
                    if (!fs.existsSync(filepath)) {fs.mkdirSync(filepath, { recursive: true }); }
                    let screenshotBuffer = Buffer.from(req.body.screenshot, 'base64');    // Konvertieren des Base64-Strings in einen Buffer und Speichern der Datei
                    fs.writeFile(absoluteFilename, screenshotBuffer, err => {
                        if (err) { log.error(err); }
                    });
                } catch (err) { log.error(err); }
            }
        } else {
            log.error('control @ updatescreenshot: Hash mismatch, screenshot possibly corrupted');
        }
    } else {
        log.warn('control @ updatescreenshot: Screenshot or hash not provided');
        student.imageurl = "person-lines-fill.svg"
    }
    res.send({sender: "server", message:t("control.studentupdate"), status:"success" })
})


/**
 * HEARTBEAT ! 
 * This is used only to determine online/offline status of the students
 * @param servername the name of the server at which the student is registered
 * @param token the students token to search and update the entry in the list
 */
router.post('/heartbeat/:servername/:studenttoken', function (req, res, next) {
    const studenttoken = req.params.studenttoken
    const servername = req.params.servername

    //check if server exists 
    const mcServer = config.examServerList[servername]
    if ( !mcServer) {  return res.send({sender: "server", message:"notavailable", status: "error"} )  }

    //check if student is registered on server
    let student = mcServer.studentList.find(element => element.token === studenttoken)
    if ( !student ) {return res.send({ sender: "server", message:"removed", status: "error" }) }
    
    student.timestamp = new Date().getTime()   //update last seen for UI
    res.send({sender: "server", message:"success", status:"success" })
})






/**
 * LanguageTool Request 
 * Students can send a string in order to check for spelling and grammar mistakes
 * Returns an array of misspelled words with additional descriptions and location in the text
 * @param servername the name of the server at which the student is registered
 * @param token the students token to search and update the entry in the list
 */
router.post('/languagetool/:servername/:studenttoken', async function (req, res, next) {
    const studenttoken = req.params.studenttoken
    const servername = req.params.servername
    const text = req.body.text
    const language = req.body.language
    
    //check if server exists 
    const mcServer = config.examServerList[servername]
    if ( !mcServer) {  return res.send({sender: "server", message:"notavailable", status: "error"} )  }

    //check if student is registered on server
    let student = mcServer.studentList.find(element => element.token === studenttoken)
    if ( !student ) {return res.send({ sender: "server", message:"removed", status: "error" }) }
    
    const languageToolUrl = 'http://127.0.0.1:8088/v2/check';
     
    try {
        const response = await fetch(languageToolUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({ text: text, language: language}).toString() 
        });
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`);   }
        const data = await response.json();
        //console.log(data)
        res.send({sender: "server", message:"success", status:"success", data: data.matches })
    } catch (error) {
        log.error('control @ languagetool: Error sending text to LanguageTool:', error);
        res.send({sender: "server", message:"error", status:"error", data: error.message })
    }

})





export default router

/**
 * Should be used before processing API requests that come from external sources
 * Checks if the student that sent the request has a valid token (is registered) on the server
 * in order to process api request
 */
 function checkToken(token, mcserver){
    let tokenexists = false
    mcserver.studentList.forEach( (student) => {
        if (token === student.token) {
            tokenexists = true
        }
    });
    return tokenexists
}



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


