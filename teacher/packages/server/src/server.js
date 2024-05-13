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

import express from "express"
import https from 'https'
import cors from 'cors'
import fileUpload from "express-fileupload";
import {serverRouter} from './routes/serverroutes.js' 
import config from '../../main/config.js';
import fsExtra from "fs-extra"
import path from 'path'
import rateLimit  from 'express-rate-limit'  //simple ddos protection
import ip from 'ip'
import zip from 'express-easy-zip'
import fs from 'fs'
import os from 'os'
import forge from 'node-forge'
forge.options.usePureJavaScript = true; 
import defaultGateway from'default-gateway';
import multicastClient from '../../main/scripts/multicastclient.js'
import cookieParser from 'cookie-parser'
import { app } from 'electron'
import log from 'electron-log/main';

config.workdirectory = path.join(os.homedir(), config.examdirectory)  //Attention! In Electron this makes sense. the WEBserver version will most likely need another Workdirectory
config.tempdirectory = path.join(os.tmpdir(), 'exam-tmp')
//if (!fs.existsSync(config.workdirectory)){ fs.mkdirSync(config.workdirectory); } //this is done in control.js /start/ anyways
if (!fs.existsSync(config.tempdirectory)){ fs.mkdirSync(config.tempdirectory); }

try {
    const {gateway, interface: iface} =  defaultGateway.v4.sync()
    config.hostip = ip.address(iface)    // this returns the ip of the interface that has a default gateway..  should work in MOST cases.  probably provide "ip-options" in UI ?
    config.gateway = true
}
 catch (e) {
   log.error("main: unable to determine default gateway")
   config.hostip = ip.address() 
   log.info(`main: IP ${config.hostip}`)
   config.gateway = false

 }


if (typeof window !== 'undefined'){
    if (window.process.type == "renderer") config.electron = true
}



const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: 400, // Limit each IP to 400 requests per `window` 
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// clean temp directory
fsExtra.emptyDirSync(config.tempdirectory)

// Legen Sie den Pfad zur `public/`-Ressource basierend auf dem Modus fest.
const publicPath = app.isPackaged
  ? path.join(process.resourcesPath,'app.asar.unpacked', 'public')
  : path.join('public');

// Kopieren Sie den Inhalt von `public/` in das `config.tempdirectory`.
fsExtra.copy(publicPath, `${config.tempdirectory}/`, function (err) {
  if (err) return console.error(err);
  log.info('server: copied public directory to temp...');
});






// init express API
const api = express()
api.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 }, }))  //When you upload a file, the file will be accessible from req.files (init before routes)
api.use(express.json({ limit: '50mb' }))
api.use(express.urlencoded({extended: true}));
api.use(zip())
api.use(cors())
api.use("/static",express.static(config.tempdirectory));
api.use(cookieParser());

api.use('/server', serverRouter)
//api.use(limiter)  //disabled for now because this need a lot of testing to find good parameters


let certs = createCACert()  // we can not use self signed certs for web (fallback to let's encrypt!)

var options = {
    key: certs.key,
    cert: certs.cert,
    requestCert: false,
    rejectUnauthorized: false,
    agent: false
  };

const server = https.createServer(options, api);

if (config.buildforWEB){  // the api is started by the electron main process - for web we do it here
    server.listen(config.serverApiPort, () => {  
        log.info(`server: Express listening on https://${config.hostip}:${config.serverApiPort}`)
    })
    if (config.hostip) {
        multicastClient.init()
    }
}

 
 


export default server;




function createCACert() {
    let rsa =  forge.pki.rsa;
    let pki = forge.pki;
    let seed = forge.random.getBytesSync(32);
    let keys = rsa.generateKeyPair({bits: 1024, seed: seed});
    var cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.privateKey = keys.privateKey;
    cert.sign(keys.privateKey);
    var pem_pkey = pki.privateKeyToPem(keys.privateKey);
    var pem_cert = pki.certificateToPem(cert);
    return {key: pem_pkey , cert: pem_cert}
};
