/**
 * @license GPL LICENSE
 * Copyright (c) 2021-2022 Thomas Michael Weissel
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
import virtualized from './scripts/simplevmdetect.js';  // has to run in frontend (since we create a webgl insance) > inform backend (mulitcastClient.clientinfo)


let config = ipcRenderer.sendSync('getconfig')  // we need to fetch the updated version of the systemconfig from express api (server.js)
let virtualCpu = ipcRenderer.sendSync('get-cpu-info')


if (virtualized && virtualCpu ){ipcRenderer.send('virtualized')}

// Expose configuration (readonly) to the renderer process
contextBridge.exposeInMainWorld('config', config);

// Expose ipcRenderer methods safely via contextBridge
contextBridge.exposeInMainWorld('ipcRenderer', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    sendSync: (channel, data) => ipcRenderer.sendSync(channel, data),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data), // invoke für asynchrone IPC-Kommunikation
    removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener), // Entfernt einen Listener
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel), // Entfernt alle Listener für einen Channel
  });



