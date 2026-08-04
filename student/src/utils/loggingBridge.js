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

let electronLogger = null;
if (isElectronWindow()) {
    import("electron-log").then(mod => {
        electronLogger = mod.default;
    });
}

let iosLogger = null;
if (isIOS()) {
    import("../plugins/logging").then(mod => { iosLogger = mod.LoggingHandler; });
}

function stringify(...message) {
    return message.map(m => typeof m === 'object' ? JSON.stringify(m) : String(m)).join(' ')
}

// class wraps logging for electron and capacitor
export class LoggingBridge {
    error(...message) {
        const msg = stringify(...message)
        if (isElectronWindow() && electronLogger) {
            electronLogger.error(...message)
        } else if (isIOS() && iosLogger) {
            iosLogger.error({ message: msg })
        } else {
            console.error(...message)
        }
    }

    warn(...message) {
        if (isElectronWindow() && electronLogger) {
            electronLogger.warn(...message)
        } else if (isIOS() && iosLogger) {
            iosLogger.warn({ message: stringify(...message) })
        } else {
            console.warn(...message)
        }
    }

    log(...message) {
        if (isElectronWindow() && electronLogger) {
            electronLogger.log(...message)
        } else if (isIOS() && iosLogger) {
            iosLogger.log({ message: stringify(...message) })
        } else {
            console.log(message)
        }
    }

    info(...message) {
        if (isElectronWindow() && electronLogger) {
            electronLogger.info(...message)
        } else if (isIOS() && iosLogger) {
            iosLogger.info({ message: stringify(...message) })
        } else {
            console.info(...message)
        }
    }

    debug(...message) {
        if (isElectronWindow() && electronLogger) {
            electronLogger.debug(...message)
        } else if (isIOS() && iosLogger) {
            iosLogger.debug({ message: stringify(...message) })
        } else {
            console.debug(...message)
        }
    }
}

export default new LoggingBridge();