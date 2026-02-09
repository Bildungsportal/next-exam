import {isElectronWindow, isIOS} from '../types/platform.ts'

// class wraps ipcRenderer methods with platform checks
export class ActionHandler {
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
            // ios implementation placeholder for future integration
            return
        }

        // log unsupported platform information
        console.warn(`ActionHandler.send: unsupported platform for channel ${channel}`)
    }

    // sendSync forwards all params to electron synchronously
    sendSync(channel, ...args) {
        const win = this.targetWindow

        if (isElectronWindow(win) && win.ipcRenderer && typeof win.ipcRenderer.sendSync === 'function') {
            return win.ipcRenderer.sendSync(channel, ...args)
        }

        if (isIOS()) {
            // ios implementation placeholder for future integration
            return null
        }

        // log unsupported platform information
        console.warn(`ActionHandler.sendSync: unsupported platform for channel ${channel}`)
        return null
    }

    // invoke forwards all params to electron asynchronously
    async invoke(channel, ...args) {
        const win = this.targetWindow

        if (isElectronWindow(win) && win.ipcRenderer && typeof win.ipcRenderer.invoke === 'function') {
            return await win.ipcRenderer.invoke(channel, ...args)
        }

        if (isIOS()) {
            // ios implementation placeholder for future integration
            return null
        }

        // log unsupported platform information
        console.warn(`ActionHandler.invoke: unsupported platform for channel ${channel}`)
        return null
    }

    // on registers event listener for electron ipc events
    on(channel, callback) {
        const win = this.targetWindow

        if (isElectronWindow(win) && win.ipcRenderer && typeof win.ipcRenderer.on === 'function') {
            win.ipcRenderer.on(channel, callback)
            return
        }

        if (isIOS()) {
            // ios implementation placeholder for future integration
            return
        }

        // log unsupported platform information
        console.warn(`ActionHandler.on: unsupported platform for channel ${channel}`)
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
        console.warn(`ActionHandler.removeAllListeners: unsupported platform for channel ${channel ?? 'ALL'}`)
    }
}

