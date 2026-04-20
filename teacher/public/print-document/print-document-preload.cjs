'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printBridge', {
    ready: () => ipcRenderer.send('print-ready'),
    error: (msg) => ipcRenderer.send('print-error', msg),
});
