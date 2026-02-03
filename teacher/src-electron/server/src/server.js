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
import { gateway4sync } from 'default-gateway';
import multicastClient from '../../main/scripts/multicastclient.js'
import cookieParser from 'cookie-parser'
import { app } from 'electron'
import log from 'electron-log';


config.homedirectory = os.homedir()
config.workdirectory = path.join(config.homedirectory, config.serverdirectory);
config.tempdirectory = path.join(os.tmpdir(), 'exam-tmp')

if (!fs.existsSync(config.workdirectory)){ fs.mkdirSync(config.workdirectory, { recursive: true }); }
if (!fs.existsSync(config.tempdirectory)){ fs.mkdirSync(config.tempdirectory, { recursive: true }); }


// Define the desktop path based on the platform
const desktopPath = process.platform === 'win32'
    ? path.join(process.env['USERPROFILE'], 'Desktop')
    : path.join(config.homedirectory, 'Desktop');

// Create the symbolic link
if (!fs.existsSync(desktopPath)) {  fs.mkdirSync(desktopPath, { recursive: true }); }  // Check if the desktop folder exists and create if it doesn't
const linkPath = path.join(desktopPath, config.serverdirectory);  // Define the path for the symbolic link
try {fs.unlinkSync(linkPath) }catch(e){}
try {   if (!fs.existsSync(linkPath)) { fs.symlinkSync(config.workdirectory, linkPath, 'junction'); }}
catch(e){log.error("main: can't create symlink")}




try {
    const {gateway, interface: iface} =  gateway4sync()
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
// fsExtra.copy(publicPath, `${config.tempdirectory}/`, function (err) {
//   if (err) return console.error(err);
//   log.info('server: copied public directory to temp...');
// });






// init express API
const api = express()
api.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 }, }))  //When you upload a file, the file will be accessible from req.files (init before routes)
api.use(express.json({ limit: '50mb' }))
api.use(express.urlencoded({extended: true}));
api.use(zip())
api.use(cors())
api.use("/static",express.static(config.tempdirectory));
api.use(cookieParser());

// Track connection metrics for monitoring (declared here so it can be used in middleware)
let activeConnections = 0;

// Request monitoring middleware - logs request duration and warns on slow requests
api.use((req, res, next) => {
    const startTime = Date.now();
    const requestId = `${req.method} ${req.url}`;
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        if (duration > 5000) { // Warn if request takes longer than 5 seconds
            log.warn(`server: Slow request detected: ${requestId} took ${duration}ms`);
        }
        if (activeConnections > 150) {
            log.warn(`server: High load - ${activeConnections} active connections during ${requestId}`);
        }
    });
    
    res.on('close', () => {
        if (!res.headersSent) {
            const duration = Date.now() - startTime;
            log.warn(`server: Request closed before completion: ${requestId} after ${duration}ms`);
        }
    });
    
    next();
});

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

// Configure timeouts and connection limits to prevent resource exhaustion
server.timeout = 30000; // 30 seconds - close idle connections after 30s
server.keepAliveTimeout = 5000; // 5 seconds - close keep-alive connections after 5s of inactivity
server.maxConnections = 200; // Limit concurrent connections to prevent overload

// Track connection metrics for monitoring
server.on('connection', (socket) => {
    activeConnections++;
    if (activeConnections > 150) {
        log.warn(`server: High connection count: ${activeConnections}`);
    }
    socket.on('close', () => {
        activeConnections--;
    });
});

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
