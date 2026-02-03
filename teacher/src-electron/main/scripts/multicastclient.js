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
 * Starts a dgram (udp) socket that listens for mulitcast messages
 */
class MulticastClient {
    constructor () {
        this.PORT = config.multicastServerClientPort
        this.MULTICAST_ADDR = '239.255.255.250'
        this.client = null
        this.examServerList = []
        this.refreshExamsIntervall = null
    }

    /**
     * receives messages and stores new exam instances in this.examServerList[]
     * starts an intervall to check server status by timestamp
     */
    init (gateway) {
        this.gateway = gateway
        try {
            this.client = dgram.createSocket('udp4')
            this.client.bind(this.PORT, '0.0.0.0', () => { 
                this.client.setBroadcast(true)
                this.client.setMulticastTTL(128); 
                if (this.gateway) { this.client.addMembership(this.MULTICAST_ADDR) }
                if (!this.gateway) {log.warn("multicastclient @ init: No Gateway! Starting MulticastClient without adding group membership")}
                log.info(`multicastclient @ init: UDP MC Client listening on http://${config.hostip}:${this.client.address().port}`)
            })
        }
        catch (err){log.error(err)}

        this.client.on('message', (message, rinfo) => { this.messageReceived(message, rinfo) })

        //check for deprecated instance in a loop
        this.refreshExamsScheduler = new SchedulerService(this.isDeprecatedInstance.bind(this), 5000)
        this.refreshExamsScheduler.start()


    }

    async stop () {
        try {
            this.client.dropMembership(this.MULTICAST_ADDR) // entfernt Multicast-Mitgliedschaft
        } catch(e){}
        this.client.close() // schließt den UDP-Socket
        if (this.refreshExamsScheduler) this.refreshExamsScheduler.stop() // stoppt den Scheduler
        return true
    }

    
    /**
     * receives messages and stores new exam instances in this.examServerList[]
     */
    messageReceived (message, rinfo) {
        const serverInfo = JSON.parse(String(message))
        serverInfo.serverip = rinfo.address
        serverInfo.serverport = rinfo.port
        serverInfo.timestamp = new Date().getTime()   //record timestamp of last message from server
        
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
