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
import log from "electron-log";



// class wraps logging for electron and capacitor
export class LoggingBridge {
    // constructor stores reference to target window
    constructor() {
        this.targetWindow = null;
    }

    init(window) {
        this.targetWindow = window;
    }

    error(message) {
        const win = this.targetWindow

        if (isElectronWindow(win)) {
            log.error(message)
        }

        if (isIOS()) {
            console.error(message)
        }
    }

    warn(message) {
        const win = this.targetWindow

        if (isElectronWindow(win)) {
            log.warn(message)
        }

        if (isIOS()) {
            console.warn(message)
        }
    }

    info(message) {
        const win = this.targetWindow

        if (isElectronWindow(win)) {
            log.info(message)
        }

        if (isIOS()) {
            console.info(message)
        }
    }

    debug(message) {
        const win = this.targetWindow

        if (isElectronWindow(win)) {
            log.debug(message)
        }

        if (isIOS()) {
            console.debug(message)
        }
    }
}

export default new LoggingBridge();