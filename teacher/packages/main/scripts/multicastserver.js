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

import { createSocket } from 'dgram'
import config from '../config.js'
import crypto from 'crypto';
import log from 'electron-log/main';
import {SchedulerService} from './schedulerservice.ts'


/**
 * Starts a dgram (udp) socket that broadcasts information about this server
 * one multicastServer instance for every exam (holds all student information and serverstatus)
 */
class MulticastServer {
    constructor () {
        this.SRC_PORT = 0  // in order to allow several multicast servers (more exams on the same machine) this port needs to be set dynamically
        this.ClientPORT = config.multicastClientPort
        this.MULTICAST_ADDR = config.multicastServerAdrr
        this.server = null
        this.serverinfo = null
        this.broadcastInterval = null
        this.running = false
        this.studentList = []
        this.serverstatus = {}
    }

    /**
     * sets up an intervall to send serverinfo every 2 seconds
     * @param servername the given name of the server (for example "math")
     * @param pin the pin needed to register as student
     */
    init (servername, pin, password) {
        this.server = createSocket('udp4')
        this.serverinfo = {
            servername: servername,   //should be unique if several servers are allowed
            pin: pin,
            password: password,
            timestamp: 0,
            id:crypto.randomUUID(),
            ip: config.hostip,
            servertoken: `server-${crypto.randomUUID()}`
        }
        
        this.server.bind(this.SRC_PORT,'0.0.0.0',  () => { // Add the HOST_IP_ADDRESS for reliability
            this.server.setBroadcast(true)
            this.server.setMulticastTTL(128)
            this.server.setTTL(128)
            this.server.addMembership(this.MULTICAST_ADDR); 
            

            //check for deprecated instance in a loop
            this.broadcastInterval = new SchedulerService(this.sendMulticastMessage.bind(this), 2000)
            this.broadcastInterval.start()


            log.info(`multicastserver @ init: UDP MC Server listening on http://${config.hostip}:${this.server.address().port}`)
        })
    }


    /**
     * updates the server timestamp and actually broadcasts the message (serverinfo)
     */
    sendMulticastMessage () {
        this.serverinfo.timestamp = new Date().getTime()
        let message = {
            servername: this.serverinfo.servername,
            timestamp: this.serverinfo.timestamp,
            id: this.serverinfo.id,
            ip: this.serverinfo.ip
        }
        const preparedMessage = new Buffer.from(JSON.stringify(message))
        this.server.send(preparedMessage, 0, preparedMessage.length, this.ClientPORT, this.MULTICAST_ADDR)  //broadcast to clients
        this.server.send(preparedMessage, 0, preparedMessage.length, config.multicastServerClientPort, this.MULTICAST_ADDR)        //broadcast to other server(clients) - servers also want to know what other servers are in the network
    }
}

export default MulticastServer
