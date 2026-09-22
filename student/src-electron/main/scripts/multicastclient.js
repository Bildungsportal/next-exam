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
import config from '../../../src/utils/config.js';  // node not vue (relative path needed)
//import log from 'electron-log';
import {SchedulerService} from './schedulerservice.ts'
import LoggingBridge from "../../../src/utils/loggingBridge.js";

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
        this.lastMembershipRefresh = 0
        this.reconnectToken = false
        this.teacherCertificateHosts = new Set(['localhost', '127.0.0.1', '::1'])
        this.teacherCertificateFingerprints = new Map()
        this.teacherCertificatePems = new Map()
        this.pendingTeacherCertificateFingerprints = new Map()
        this.examServerList = []
        this.serverstatus = {}
        this.clientinfo = {
            name: "DemoUser",
            token: false,
            lockedSection: 1,
            ip: false,  // ip address is sent along by the teacher multicast server
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
            displayCount: 1,
            multiMonitor: false,
            msofficeshare: false,
            screenshotinterval: 4000,   //milliseconds
            printrequest : false,
            privateSpellcheck: {activated: false},
            localLockdown: false,
            group: 'a',
            submissionnumber: 0,
            localVMHost: null,
            localVMState: null,
            version: config.version
        }
    }

    /**
     * receives messages and stores new exam instances in this.examServerList[]
     * starts an intervall to check server status and reacts on information given by the server instance
     */
    init (gateway) {
        this.gateway = gateway
        this.client = dgram.createSocket({ type: 'udp4', reuseAddr: true }) // reuseAddr is important for Windows


        this.client.on('error', (err) => {
            LoggingBridge.error(`multicastclient @ init: UDP MC Client error:\n${err.stack}`);
            this.client.close();
        });

        try {

            // On Windows we bind directly to the chosen host IP instead of 0.0.0.0 //
            const bindAddr = process.platform === 'win32' ? config.hostip : '0.0.0.0';

            this.client.bind(this.PORT, bindAddr,  () => {
                try {
                    try { this.client.setBroadcast(true); } catch (e) { /* optional for multicast receive */ }
                    this.client.setMulticastTTL(128);
                    this.client.addMembership(this.MULTICAST_ADDR, config.hostip);
                    LoggingBridge.info(`UDP MC Client bound to ${bindAddr}:${this.PORT} and joined ${this.MULTICAST_ADDR}`)
                } catch (e) {
                    LoggingBridge.error(`Multicast Join failed: ${e.message}`);
                }
            })
        }
        catch (e){ 
            LoggingBridge.error(`mulitcastclient @ init: ${e}`)
        }
            
        this.client.on('message', (message, rinfo) => { this.messageReceived(message, rinfo) })
 
        //check for deprecated instance in a loop
        this.refreshExamsScheduler = new SchedulerService(this.isDeprecatedInstance.bind(this), 5000)
        this.refreshExamsScheduler.start()
    }

    async stop(interfaceAddr) {
        if (!this.client) return;
        const addr = interfaceAddr ?? config.hostip;
        if (this.refreshExamsScheduler) this.refreshExamsScheduler.stop();
        try {
            this.client.dropMembership(this.MULTICAST_ADDR, addr);
        } catch (e) {}
        await new Promise((resolve) => {
            this.client.close(() => resolve());
        });
        this.client = null;
    }

    /**
     * receives messages and stores new exam instances in this.examServerList[]
     */
     messageReceived (message, rinfo) {
        const serverInfo = JSON.parse(String(message))
        serverInfo.serverip = rinfo.address
        this.allowTeacherCertificateHost(rinfo.address, serverInfo.tlsFingerprint)
        serverInfo.serverport = rinfo.port
        serverInfo.reachable = true
        serverInfo.timestamp = new Date().getTime()   //record timestamp of last message from server (ignore servertimestamp because it may have a different system time)
        
        if (this.isNewExamInstance(serverInfo)) {
            LoggingBridge.info(`multicastclient @ messageReceived: Adding new Exam Instance "${serverInfo.servername}" to Serverlist`)
            this.examServerList.push(serverInfo)
        }
    }

    /** Allow self-signed TLS only for a Teacher host selected or discovered by this client. */
    allowTeacherCertificateHost(hostname, fingerprint = null) {
        if (typeof hostname !== 'string' || !hostname) return
        const normalizedHost = hostname.toLowerCase()
        this.teacherCertificateHosts.add(normalizedHost)
        const normalizedFingerprint = this.normalizeCertificateFingerprint(fingerprint)
        if (normalizedFingerprint) {
            const expected = this.teacherCertificateFingerprints.get(normalizedHost)
            if (!expected || expected === normalizedFingerprint) {
                if (expected !== normalizedFingerprint) this.teacherCertificatePems.delete(normalizedHost)
                this.teacherCertificateFingerprints.set(normalizedHost, normalizedFingerprint)
            }
        }
    }

    /** Normalize SHA-256 certificate fingerprints from beacon hex or Electron colon notation. */
    normalizeCertificateFingerprint(fingerprint) {
        if (typeof fingerprint !== 'string') return null
        const normalized = fingerprint.replace(/[^a-f0-9]/gi, '').toLowerCase()
        return normalized.length === 64 ? normalized : null
    }

    /** Pin a first-seen certificate or report a changed Teacher certificate. */
    observeTeacherCertificate(hostname, fingerprint) {
        const normalizedHost = typeof hostname === 'string' ? hostname.toLowerCase() : ''
        const actual = this.normalizeCertificateFingerprint(fingerprint)
        if (!normalizedHost || !actual) return { status: 'error' }
        this.teacherCertificateHosts.add(normalizedHost)
        const expected = this.teacherCertificateFingerprints.get(normalizedHost)
        if (!expected) {
            this.teacherCertificatePems.delete(normalizedHost)
            this.teacherCertificateFingerprints.set(normalizedHost, actual)
            return { status: 'trusted' }
        }
        if (expected === actual) return { status: 'trusted' }
        this.pendingTeacherCertificateFingerprints.set(normalizedHost, actual)
        return { status: 'fingerprint-changed', serverip: hostname }
    }

    /** Pin the fingerprint the Teacher serves right now, replacing any previously pinned one. */
    pinTeacherCertificate(hostname, fingerprint) {
        if (typeof hostname !== 'string' || !hostname) return false
        const normalizedHost = hostname.toLowerCase()
        const actual = this.normalizeCertificateFingerprint(fingerprint)
        if (!actual) return false
        this.teacherCertificateHosts.add(normalizedHost)
        this.teacherCertificatePems.delete(normalizedHost)
        this.teacherCertificateFingerprints.set(normalizedHost, actual)
        this.pendingTeacherCertificateFingerprints.delete(normalizedHost)
        return true
    }

    /** Pinned fingerprint + PEM for a Teacher host, or null when nothing is pinned yet. */
    getPinnedTeacherCertificate(hostname) {
        if (typeof hostname !== 'string' || !hostname) return null
        const normalizedHost = hostname.toLowerCase()
        const fingerprint = this.teacherCertificateFingerprints.get(normalizedHost)
        const pem = this.teacherCertificatePems.get(normalizedHost)
        return (fingerprint && pem) ? { fingerprint, pem } : null
    }

    /** Store the leaf PEM belonging to an already pinned fingerprint (used for Node TLS validation). */
    setTeacherCertificatePem(hostname, pem) {
        if (typeof hostname !== 'string' || !hostname || !pem) return
        this.teacherCertificatePems.set(hostname.toLowerCase(), pem)
    }

    /** Verify that a certificate belongs to a known Teacher host and matches its advertised fingerprint. */
    isTeacherCertificateAllowed(hostname, fingerprint) {
        if (typeof hostname !== 'string') return false
        const normalizedHost = hostname.toLowerCase()
        if (!this.teacherCertificateHosts.has(normalizedHost)) {
            LoggingBridge.warn(`multicastclient @ TLS: rejected unknown Teacher host ${normalizedHost}`)
            return false
        }
        const expected = this.teacherCertificateFingerprints.get(normalizedHost)
        if (!expected) return false
        const actual = this.normalizeCertificateFingerprint(fingerprint)
        if (actual !== expected) {
            LoggingBridge.warn(`multicastclient @ TLS: fingerprint mismatch for ${normalizedHost}; expected=${expected}, actual=${actual || 'missing'}`)
            return false
        }
        return true
    }

    /**
     * checks if the message came from a new exam instance or an old one that is already registered
     */
    isNewExamInstance (obj) {
        for (let i = 0; i < this.examServerList.length; i++) {
            if (this.examServerList[i].id === obj.id) {
                // Existing server - update the stored entry with latest fields (e.g. requireBiP toggles).
                this.examServerList[i] = { ...this.examServerList[i], ...obj, timestamp: obj.timestamp }
                return false
            }
        }
        return true
    }

    /**
     * re-joins the multicast group every ~120s to survive IGMP-snooping timeouts
     */
    refreshMulticastMembership () {
        if (!this.client) return
        const now = new Date().getTime()
        if (now - this.lastMembershipRefresh < 120000) return
        this.lastMembershipRefresh = now
        try {
            try { this.client.dropMembership(this.MULTICAST_ADDR, config.hostip) } catch (e) {}
            this.client.addMembership(this.MULTICAST_ADDR, config.hostip)
        } catch (e) {
            LoggingBridge.error(`multicastclient @ refreshMulticastMembership: ${e.message}`)
        }
    }

    /**
     * checks servertimestamp and removes server from list if older than 1 minute
     */
    isDeprecatedInstance () {
        // re-join multicast group periodically so APs/switches with IGMP snooping
        // don't drop our membership after idle -> beacons keep arriving
        this.refreshMulticastMembership()

        // iterate backwards so splice() does not skip the next entry
        for (let i = this.examServerList.length - 1; i >= 0; i--) {
            const now = new Date().getTime()

            if (now - 16000 > this.examServerList[i].timestamp) {
                LoggingBridge.warn(`multicastclient @ isDeprecatedInstance: Removing inactive server '${this.examServerList[i].servername}' from list`)
                this.examServerList.splice(i, 1)
            }
        }
    }
}

export default new MulticastClient()
