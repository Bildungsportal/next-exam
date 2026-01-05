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


import dgram from 'dgram';
import config from '../config.js';  // node not vue (relative path needed)
import log from 'electron-log';
import {SchedulerService} from './schedulerservice.ts'

/**
 * STORES ALL CLIENT/Server INFORMATION
 * Starts a dgram (udp) socket that listens for mulitcast messages
 */

class MulticastClient {
    constructor () {
        this.PORT = config.multicastClientPort
        this.MULTICAST_ADDR = config.multicastServerAdrr
        this.client = null
        this.beaconsLost = 0
        this.examServerList = []
        this.clientinfo = {
            name: "DemoUser",
            token: false,
            ip: false,  // ip address wird vom multicastserver teacher mit geschickt
            hostname: false,
            serverip: false,   // wird lokal gesetzt (ist aber logischerweise gleich der ip des multicastservers)
            servername: false,
            focus: true,
            exammode: false,
            timestamp: false,
            virtualized: false,  // this config setting is set by simplevmdetect.js (electron preload)
            examtype : false,
            pin: false,
            screenlock: false,
            msofficeshare: false,
            screenshotinterval: 4000,   //milliseconds
            printrequest : false,
            privateSpellcheck: {activated: false},
            localLockdown: false,
            group: 'a',
            submissionnumber: 0
        }
    }

    /**
     * receives messages and stores new exam instances in this.examServerList[]
     * starts an intervall to check server status and reacts on information given by the server instance
     */
    init (gateway) {
        this.gateway = gateway
        this.client = dgram.createSocket('udp4')  // moving this here will allow to respawn it if binding fails

        this.client.on('error', (err) => {
            log.error(`multicastclient @ init: UDP MC Client error:\n${err.stack}`);
            this.client.close();
        });

        try {
            this.client.bind(this.PORT, '0.0.0.0',  () => { 
                this.client.setBroadcast(true)
                this.client.setMulticastTTL(128); 
                if (this.gateway) {this.client.addMembership(this.MULTICAST_ADDR)} // es ist für ein verlässliches multicast sinnvoll der gruppe beizutreten
                if (!this.gateway) {log.warn("mcclient: No Gateway! Starting MulticastClient without adding group membership")}
                log.info(`multicastclient @ init: UDP MC Client listening on http://${config.hostip}:${this.client.address().port}`)
            })
        }
        catch (e){ 
            log.error(`mulitcastclient @ init: ${e}`) 
        }
            
        this.client.on('message', (message, rinfo) => { this.messageReceived(message, rinfo) })
 
        //check for deprecated instance in a loop
        this.refreshExamsScheduler = new SchedulerService(this.isDeprecatedInstance.bind(this), 5000)
        this.refreshExamsScheduler.start()
    }

    /**
     * receives messages and stores new exam instances in this.examServerList[]
     */
     messageReceived (message, rinfo) {
      
        const serverInfo = JSON.parse(String(message))
        serverInfo.serverip = rinfo.address
        serverInfo.serverport = rinfo.port
        serverInfo.reachable = true
        serverInfo.timestamp = new Date().getTime()   //record timestamp of last message from server (ignore servertimestamp because it may have a different system time)
        
        if (this.isNewExamInstance(serverInfo)) {
            log.info(`multicastclient @ messageReceived: Adding new Exam Instance "${serverInfo.servername}" to Serverlist`)
            this.examServerList.push(serverInfo)
        }
    }

    /**
     * checks if the message came from a new exam instance or an old one that is already registered
     */
    isNewExamInstance (obj) {
        for (let i = 0; i < this.examServerList.length; i++) {
            if (this.examServerList[i].id === obj.id) {
                //log.info('existing server - updating timestamp')
                this.examServerList[i].timestamp = obj.timestamp // existing server - update timestamp
                return false
            }
        }
        return true
    }

    /**
     * checks servertimestamp and removes server from list if older than 1 minute
     */
    isDeprecatedInstance () {
        for (let i = 0; i < this.examServerList.length; i++) {
            const now = new Date().getTime()

            if (now - 16000 > this.examServerList[i].timestamp) {
                log.warn(`multicastclient @ isDeprecatedInstance: Removing inactive server '${this.examServerList[i].servername}' from list`)
                this.examServerList.splice(i, 1)
            }
        }
    }
}

export default new MulticastClient()
