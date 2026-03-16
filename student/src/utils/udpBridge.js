import { UdpSocket } from 'capacitor-udp-socket';
import {isElectronWindow} from '../types/platform.ts'

export class UdpBridge {
    constructor() {
        if (isElectronWindow(window)) {
            // ELECTRON SETUP
            const dgram = window.require ? window.require('dgram') : require('dgram');
            this.nativeClient = dgram.createSocket('udp4');
            console.log('UdpBridge: Running in Electron mode');
        } else {
            // CAPACITOR SETUP
            this.socketId = null;
            this.listeners = {};
            this.pluginListener = null;
            this.boundPort = 0;
            console.log('UdpBridge: Running in Capacitor mode');

            // Start async initialization
            this.ready = this.initCapacitorSocket();
        }
    }

    async initCapacitorSocket() {
        try {
            const res = await UdpSocket.create();
            this.socketId = res.socketId;

            this.pluginListener = await UdpSocket.addListener('receive', (event) => {
                if (event.socketId === this.socketId) {
                    const rinfo = { address: event.remoteAddress, port: event.remotePort };
                    this.emitCapacitor('message', event.buffer, rinfo);
                }
            });
        } catch (err) {
            this.emitCapacitor('error', err);
        }
    }

    on(event, callback) {
        if (isElectronWindow()) {
            this.nativeClient.on(event, callback);
        } else {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
        }
    }

    emitCapacitor(event, ...args) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(...args));
        }
    }

    bind(port, address = '0.0.0.0', callback) {
        if (isElectronWindow()) {
            this.nativeClient.bind(port, address, callback);
        } else {
            this.boundPort = port;
            this.ready.then(async () => {
                if (this.socketId === null) return;
                try {
                    await UdpSocket.bind({ socketId: this.socketId, port, address });
                    if (callback) callback();
                } catch (err) {
                    this.emitCapacitor('error', err);
                }
            });
        }
    }

    setBroadcast(flag) {
        if (isElectronWindow()) {
            this.nativeClient.setBroadcast(flag);
        } else {
            this.ready.then(async () => {
                if (this.socketId === null) return;
                try {
                    await UdpSocket.setBroadcast({ socketId: this.socketId, broadcast: flag });
                } catch (err) {
                    this.emitCapacitor('error', err);
                }
            });
        }
    }

    setMulticastTTL(ttl) {
        if (isElectronWindow()) {
            this.nativeClient.setMulticastTTL(ttl);
        } else {
            console.warn(`UdpBridge: setMulticastTTL(${ttl}) ignored on Capacitor.`);
        }
    }

    addMembership(address) {
        if (isElectronWindow()) {
            this.nativeClient.addMembership(address);
        } else {
            this.ready.then(async () => {
                if (this.socketId === null) return;
                try {
                    await UdpSocket.joinGroup({ socketId: this.socketId, address });
                } catch (err) {
                    this.emitCapacitor('error', err);
                }
            });
        }
    }

    send(message, port, address, callback) {
        if (isElectronWindow()) {
            this.nativeClient.send(message, port, address, callback);
        } else {
            this.ready.then(async () => {
                if (this.socketId === null) return;
                try {
                    // Convert message to string if it's a Buffer/Uint8Array
                    const bufferStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

                    await UdpSocket.send({
                        socketId: this.socketId,
                        address: address,
                        port: port,
                        buffer: bufferStr
                    });

                    if (callback) callback();
                } catch (err) {
                    this.emitCapacitor('error', err);
                }
            });
        }
    }

    address() {
        if (isElectronWindow()) {
            return this.nativeClient.address();
        } else {
            return { port: this.boundPort, address: '0.0.0.0', family: 'IPv4' };
        }
    }

    close() {
        if (isElectronWindow()) {
            this.nativeClient.close();
        } else {
            this.ready.then(async () => {
                if (this.socketId !== null) {
                    await UdpSocket.close({ socketId: this.socketId }).catch(() => {});
                    this.socketId = null;
                }
                if (this.pluginListener) {
                    this.pluginListener.remove();
                }
            });
        }
    }
}