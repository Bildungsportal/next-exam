/**
 * @license GPL LICENSE
 * Copyright (c) 2021-2023 Thomas Michael Weissel
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
 * This is used to preload packages for the renderer process of electron (the frontend)
 */


import { contextBridge, ipcRenderer } from 'electron'

let config = ipcRenderer.sendSync('getconfig')  // we need to fetch the updated version of the systemconfig from express api (server.js)


/** document ready */
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
    return new Promise(resolve => {
        if (condition.includes(document.readyState)) {
            resolve(true)
        } 
        else {
            document.addEventListener('readystatechange', () => {
                if (condition.includes(document.readyState)) {
                resolve(true)
                }
            })
        }
    })
}

;(async () => {
    await domReady()
})()


// --------- Expose some API to the Renderer process. ---------
contextBridge.exposeInMainWorld('ipcRenderer', withPrototype(ipcRenderer))
contextBridge.exposeInMainWorld('config', config )  // expose configuration (readonly) to the renderer (frontend)

// `exposeInMainWorld` can't detect attributes and methods of `prototype`, manually patching it.
function withPrototype(obj: Record<string, any>): Record<string, any> {
    const protos = Object.getPrototypeOf(obj)
    for (const [key, value] of Object.entries(protos)) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) continue
        if (typeof value === 'function') {obj[key] = function (...args: any) { return value.call(obj, ...args)  }  } // Some native APIs, like `NodeJS.EventEmitter['on']`, don't work in the Renderer process. Wrapping them into a function
        else { obj[key] = value }
    }
    return obj
}
