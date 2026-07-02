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

/**
 * SignalBridge is a class that wraps the ipcRenderer methods with platform checks
 * 
 * It works a facade or bridgeservice between the renderer and the main process or ios capacitor plugin calls
 */


import {isElectronWindow, isIOS} from '../types/platform.ts'
import { IosTaskDispatcher } from './ios/iosTaskDispatcher.js'



// class wraps ipcRenderer methods with platform checks
export class SignalBridge {
    // constructor stores reference to target window
    constructor(targetWindow = window) {
        this.targetWindow = targetWindow
    }

    // send forwards all params to electron or leaves hook for ios
    send(channel, ...args) {
        const win = this.targetWindow

        if (isElectronWindow(win) && win.ipcRenderer && typeof win.ipcRenderer.send === 'function') {
            win.ipcRenderer.send(channel, ...args)
            return
        }

        if (isIOS()) {
            IosTaskDispatcher.dispatch(channel, ...args)
            return
        }

        // log unsupported platform information
        console.warn(`SignalBridge.send: unsupported platform for channel ${channel}`)
    }

    // sendSync forwards all params to electron synchronously
    sendSync(channel, ...args) {
        const win = this.targetWindow

        if (isElectronWindow(win) && win.ipcRenderer && typeof win.ipcRenderer.sendSync === 'function') {
            return win.ipcRenderer.sendSync(channel, ...args)
        }

        if (isIOS()) {
            return IosTaskDispatcher.dispatch(channel, ...args)
        }

        // log unsupported platform information
        console.warn(`SignalBridge.sendSync: unsupported platform for channel ${channel}`)
        return null
    }

    // invoke forwards all params to electron asynchronously - returns a promise
    async invoke(channel, ...args) {
        const win = this.targetWindow

        if (isElectronWindow(win) && win.ipcRenderer && typeof win.ipcRenderer.invoke === 'function') {
            return await win.ipcRenderer.invoke(channel, ...args)
        }

        if (isIOS()) {
            return await IosTaskDispatcher.dispatch(channel, ...args)
        }

        // log unsupported platform information
        console.warn(`SignalBridge.invoke: unsupported platform for channel ${channel}`)
        return null
    }

    // on registers event listener for electron ipc events
    // those signals are usually sent from the main process to the renderer process to trigger actions in the renderer process
    // for ios where everything happens in the frontend we can call the methods in question directly
    on(channel, callback) {
        const win = this.targetWindow

        if (isElectronWindow(win) && win.ipcRenderer && typeof win.ipcRenderer.on === 'function') {
            win.ipcRenderer.on(channel, callback)
            return
        }

        if (isIOS()) {
            IosTaskDispatcher.dispatch(channel, ...args)
            return
        }

        // log unsupported platform information
        console.warn(`SignalBridge.on: unsupported platform for channel ${channel}`)
    }

    // removeAllListeners unregisters listeners for a given channel or all
    removeAllListeners(channel) {
        const win = this.targetWindow

        if (isElectronWindow(win) && win.ipcRenderer && typeof win.ipcRenderer.removeAllListeners === 'function') {
            if (channel) {
                win.ipcRenderer.removeAllListeners(channel)
            } else {
                win.ipcRenderer.removeAllListeners()
            }
            return
        }

        if (isIOS()) {
            // ios implementation placeholder for future integration
            return
        }

        // log unsupported platform information
        console.warn(`SignalBridge.removeAllListeners: unsupported platform for channel ${channel ?? 'ALL'}`)
    }
}

