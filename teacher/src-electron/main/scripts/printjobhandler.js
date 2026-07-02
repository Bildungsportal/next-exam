/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 */

import path, { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import { getRendererIndexPath } from './windowhandler.js'

const PRINT_TOTAL_TIMEOUT_MS = 300_000
// delay AFTER webContents.print(success) before resolve/close so the hidden window is not destroyed in the same tick as the callback (legacy Chromium/OS handoff buffer).
const PRINT_POST_HANDOFF_DELAY_MS = 800


const PRINT_WINDOW_W = 850
const PRINT_WINDOW_H = 1200

const LOG = 'printjobhandler'

let pendingPdfPrintJob = null
let pendingPdfPrintWebContentsId = null
let printConsumeHandlerRegistered = false
let printRendererLogRegistered = false

function clearPendingPdfPrintPayload(reason) {
    pendingPdfPrintJob = null
    pendingPdfPrintWebContentsId = null
    if (reason) log.info(`${LOG}: pending cleared (${reason})`)
}

function registerPrintRendererLogHandler() {
    if (printRendererLogRegistered) return
    printRendererLogRegistered = true
    ipcMain.on('print-renderer-log', (event, payload) => {
        const body = typeof payload === 'object' && payload !== null ? JSON.stringify(payload) : String(payload)
        log.info(`${LOG}: renderer-log wcId=${event.sender.id} ${body}`)
    })
}

function registerPrintConsumeHandler() {
    if (printConsumeHandlerRegistered) return
    printConsumeHandlerRegistered = true
    // Do not clear on first invoke: multiple consume calls from the same print window must keep returning the job until main clears after handoff.
    ipcMain.handle('print-consume-pending-job', (event) => {
        const senderId = event.sender.id
        if (pendingPdfPrintWebContentsId === null) {
            log.warn(`${LOG}: consume invoked but no pending window (sender wcId=${senderId})`)
            return null
        }
        if (senderId !== pendingPdfPrintWebContentsId) {
            log.warn(`${LOG}: consume sender mismatch sender=${senderId} pending=${pendingPdfPrintWebContentsId}`)
            return null
        }
        const job = pendingPdfPrintJob
        if (!job) {
            log.warn(`${LOG}: consume ok window but pending job is null (wcId=${senderId})`)
            return null
        }
        log.info(`${LOG}: job consumed by renderer (${job.jobTitle})`)
        return { docBase64: job.docBase64, printerName: job.printerName, jobTitle: job.jobTitle }
    })
}

registerPrintRendererLogHandler()
registerPrintConsumeHandler()


function sanitizeTitle(raw) {
    const s = raw != null && String(raw).trim() ? String(raw).trim() : 'Next-Exam'
    return s.replace(/[/\\?<>|:"*]/g, '_').slice(0, 200)
}

function getTeacherAppLoadUrl() {
    if (app.isPackaged || process.env.DEBUG) {
        return pathToFileURL(getRendererIndexPath()).href
    }
    return process.env.APP_URL || `http://${process.env.VITE_DEV_SERVER_HOST || 'localhost'}:${process.env.VITE_DEV_SERVER_PORT || '9300'}`
}

function makeHiddenWindow(preloadPath) {
    const win = new BrowserWindow({
        show: false,
        width: PRINT_WINDOW_W,
        height: PRINT_WINDOW_H,
        useContentSize: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: false,
            backgroundThrottling: false,
            preload: preloadPath,
        },
    })
    win.webContents.setZoomFactor(1.0)
    return win
}

function getPreloadPath() {
    const currentDir = fileURLToPath(new URL('.', import.meta.url))
    return process.env.QUASAR_ELECTRON_PRELOAD_FOLDER
        ? path.resolve(currentDir, path.join(process.env.QUASAR_ELECTRON_PRELOAD_FOLDER, 'electron-preload' + (process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION || '.cjs')))
        : join(import.meta.dirname, '../preload/preload.mjs')
}

async function processPrintJobPdf(docBase64, printerName, jobTitle) {
    const title = sanitizeTitle(jobTitle)
    const win = makeHiddenWindow(getPreloadPath())

    try {
        const printOptions = {
            silent: true,
            deviceName: printerName,
            printBackground: true,
            pageSize: 'A4',
            margins: { marginType: 'none' },
            preferCSSPageSize: false,
        }

        await new Promise((resolve, reject) => {
            let timeoutId

            const cleanup = () => {
                clearTimeout(timeoutId)
                ipcMain.removeListener('print-ready', onReady)
                ipcMain.removeListener('print-error', onError)
            }

            const onReady = (event) => {
                const sid = event.sender.id
                if (sid !== win.webContents.id) {
                    log.warn(`${LOG}: print-ready ignored (sender=${sid} expected=${win.webContents.id})`)
                    return
                }
                cleanup()
                clearPendingPdfPrintPayload('after print-ready')
                // Wake the Chromium PrintBackendServiceManager with a no-op using the real
                // printer name, then do the actual print. Using the real deviceName forces
                // Chromium to contact the CUPS backend process (an invalid name like '\x00'
                // gets rejected internally before reaching the backend).
                win.webContents.print({ silent: true, deviceName: printerName }, () => {
                    win.webContents.print(printOptions, (success, reason) => {
                        if (success) {
                            log.info(`${LOG}: printed OK → ${printerName} (${title})`)
                            setTimeout(resolve, PRINT_POST_HANDOFF_DELAY_MS)
                        } else {
                            log.error(`${LOG}: print failed → ${printerName} (${title}) reason=${reason || 'empty'}`)
                            reject(new Error(reason || 'Print failed'))
                        }
                    })
                })
            }
            const onError = (event, msg) => {
                const sid = event.sender.id
                if (sid !== win.webContents.id) {
                    log.warn(`${LOG}: print-error ignored (sender=${sid} expected=${win.webContents.id}) msg=${msg}`)
                    return
                }
                cleanup()
                clearPendingPdfPrintPayload('after print-error')
                log.error(`${LOG}: renderer error (${title}): ${msg || 'empty'}`)
                reject(new Error(msg || 'Print renderer error'))
            }

            ipcMain.on('print-ready', onReady)
            ipcMain.on('print-error', onError)

            pendingPdfPrintJob = { docBase64, printerName, jobTitle: title }
            pendingPdfPrintWebContentsId = win.webContents.id
            const loadUrl = `${getTeacherAppLoadUrl()}#/system-print`
            win.loadURL(loadUrl).catch((err) => {
                log.error(`${LOG}: loadURL failed (${title}): ${err.message}`)
                cleanup()
                clearPendingPdfPrintPayload('loadURL catch')
                reject(err)
            })

            timeoutId = setTimeout(() => {
                log.error(`${LOG}: timeout (${title})`)
                cleanup()
                clearPendingPdfPrintPayload('timeout')
                reject(new Error('Print timeout'))
            }, PRINT_TOTAL_TIMEOUT_MS)
        })
    } finally {
        if (!win.isDestroyed()) win.close()
    }
}

async function processPrintJobImage(docBase64, printerName, jobTitle) {
    const title = sanitizeTitle(jobTitle)
    const dataUrl = docBase64.startsWith('data:') ? docBase64 : `data:image/jpeg;base64,${docBase64}`

    const win = new BrowserWindow({
        show: false,
        width: PRINT_WINDOW_W,
        height: PRINT_WINDOW_H,
        useContentSize: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, webSecurity: false, backgroundThrottling: false },
    })
    win.webContents.setZoomFactor(1.0)

    try {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>@page{size:A4;margin:0}body{margin:0}-webkit-print-color-adjust:exact;print-color-adjust:exact}img{display:block;max-width:100%;height:auto}</style>
</head><body><img src="${dataUrl.replace(/"/g, '&quot;')}" alt=""/></body></html>`

        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
        await win.webContents.executeJavaScript(`document.title = ${JSON.stringify(title)}`)

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Print timeout')), PRINT_TOTAL_TIMEOUT_MS)
            win.webContents.print(
                { 
                    silent: true, 
                    deviceName: printerName, 
                    printBackground: true, 
                    pageSize: 'A4', 
                    margins: { marginType: 'none' }, 
                    preferCSSPageSize: false 
                },
                (success, reason) => {
                    clearTimeout(timeout)
                    if (success) { log.info(`${LOG}: printed OK → ${printerName} (${title})`); setTimeout(resolve, PRINT_POST_HANDOFF_DELAY_MS) }
                    else reject(new Error(reason || 'Image print failed'))
                }
            )
        })
    } finally {
        if (!win.isDestroyed()) win.close()
    }
}

export function processPrintJob(docBase64, printerName, previewType, jobTitle) {
    if (previewType === 'pdf') return processPrintJobPdf(docBase64, printerName, jobTitle)
    if (previewType === 'image') return processPrintJobImage(docBase64, printerName, jobTitle)
    throw new Error(`Invalid preview type: ${previewType}`)
}

// FIFO queue — one job at a time
const printQueue = []
let isProcessingPrint = false

async function drainPrintQueue() {
    if (isProcessingPrint) return
    isProcessingPrint = true
    while (printQueue.length > 0) {
        const job = printQueue.shift()
        try {
            await processPrintJob(job.docBase64, job.printerName, job.previewType, job.jobTitle)
            job.resolve(true)
        } catch (err) {
            log.error(`${LOG}: job failed (${sanitizeTitle(job.jobTitle)}): ${err.message}`)
            job.reject(err)
        }
    }
    isProcessingPrint = false
}

export function enqueuePrintJob(docBase64, printerName, previewType, jobTitle) {
    return new Promise((resolve, reject) => {
        printQueue.push({ docBase64, printerName, previewType, jobTitle, resolve, reject })
        log.info(`${LOG}: queued → ${printerName} "${sanitizeTitle(jobTitle)}" (${printQueue.length} in queue)`)
        if (!isProcessingPrint) drainPrintQueue().catch(err => log.error(`${LOG}: queue error: ${err.message}`))
    })
}
