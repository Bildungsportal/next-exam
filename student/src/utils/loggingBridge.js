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
 * LoggingBridge is a class that wraps the electron logger methods with platform checks
 *
 * It works a facade for logging calls, electron-log for electron and console for capacitor
 */


import {isElectronWindow, isIOS} from '../types/platform.ts'

let log = null;
if (isElectronWindow()) {
    import("electron-log").then(mod => { log = mod.default; });
}

// class wraps logging for electron and capacitor
export class LoggingBridge {
    constructor() {
        this.targetWindow = null;
    }

    init(window) {
        this.targetWindow = window;
    }

    error(...message) {
        const win = this.targetWindow

        if (isElectronWindow(win) && log) {
            log.error(...message)
        } else {
            console.error(...message)
        }
    }

    warn(...message) {
        const win = this.targetWindow

        if (isElectronWindow(win) && log) {
            log.warn(...message)
        } else {
            console.warn(...message)
        }
    }

    info(...message) {
        const win = this.targetWindow

        if (isElectronWindow(win) && log) {
            log.info(...message)
        } else {
            console.info(...message)
        }
    }

    debug(...message) {
        const win = this.targetWindow

        if (isElectronWindow(win) && log) {
            log.debug(...message)
        } else {
            console.debug(...message)
        }
    }
}

export default new LoggingBridge();