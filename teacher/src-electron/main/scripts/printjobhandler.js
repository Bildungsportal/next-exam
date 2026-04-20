/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 */

import fs from 'fs'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { tmpdir } from 'os'
import log from 'electron-log'
import { getPublicBase } from './windowhandler.js'

const PRINT_TOTAL_TIMEOUT_MS = 300_000
// Chromium may still be spooling after print()'s IPC fires; closing immediately yields empty jobs.
const PRINT_POST_HANDOFF_DELAY_MS = 800

const PRINT_WINDOW_W = 850
const PRINT_WINDOW_H = 1200

const LOG = 'printjobhandler'

function sanitizeTitle(raw) {
    const s = raw != null && String(raw).trim() ? String(raw).trim() : 'Next-Exam'
    return s.replace(/[/\\?<>|:"*]/g, '_').slice(0, 200)
}

function getPublicPrintDir() {
    const base = getPublicBase()
    if (fs.existsSync(join(base, 'print-document', 'print-document.html'))) return join(base, 'print-document')
    const cwd = join(process.cwd(), 'public', 'print-document')
    if (fs.existsSync(join(cwd, 'print-document.html'))) return cwd
    return join(base, 'print-document')
}

async function writeTempPdf(docBase64) {
    let b64 = docBase64
    const comma = b64.indexOf(',')
    if (comma >= 0 && b64.slice(0, comma).includes('base64')) b64 = b64.slice(comma + 1)
    const dir = await mkdtemp(join(tmpdir(), 'next-exam-print-'))
    const pdfPath = join(dir, 'doc.pdf')
    await writeFile(pdfPath, Buffer.from(b64, 'base64'))
    return { pdfPath, tempDir: dir }
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

async function processPrintJobPdf(docBase64, printerName, jobTitle) {
    const title = sanitizeTitle(jobTitle)
    const printDir = getPublicPrintDir()
    const { pdfPath, tempDir } = await writeTempPdf(docBase64)
    const preloadPath = join(printDir, 'print-document-preload.cjs')
    const win = makeHiddenWindow(preloadPath)

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
            const timeout = setTimeout(() => reject(new Error('Print timeout')), PRINT_TOTAL_TIMEOUT_MS)

            const cleanup = () => {
                clearTimeout(timeout)
                ipcMain.removeListener('print-ready', onReady)
                ipcMain.removeListener('print-error', onError)
            }

            const onReady = (event) => {
                if (event.sender.id !== win.webContents.id) return
                cleanup()
                log.info(`${LOG}: renderer ready, calling webContents.print (${title})`)
                win.webContents.print(printOptions, (success, reason) => {
                    if (success) {
                        log.info(`${LOG}: job handed to OS (${title})`)
                        setTimeout(resolve, PRINT_POST_HANDOFF_DELAY_MS)
                    } else {
                        reject(new Error(reason || 'Print failed'))
                    }
                })
            }
            const onError = (event, msg) => {
                if (event.sender.id !== win.webContents.id) return
                cleanup()
                reject(new Error(msg || 'Print renderer error'))
            }

            ipcMain.on('print-ready', onReady)
            ipcMain.on('print-error', onError)

            const fileUrl = pathToFileURL(pdfPath).href
            const params = new URLSearchParams({ fileUrl, printer: printerName, title })
            win.loadFile(join(printDir, 'print-document.html'), { query: Object.fromEntries(params) })
                .catch(reject)
        })

        log.info(`${LOG}: print job done for ${printerName} (${title})`)
    } finally {
        try { await rm(tempDir, { recursive: true, force: true }) } catch { }
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
                { silent: true, deviceName: printerName, printBackground: true, pageSize: 'A4', margins: { marginType: 'none' }, preferCSSPageSize: false },
                (success, reason) => {
                    clearTimeout(timeout)
                    if (success) { log.info(`${LOG}: image job handed to OS (${title})`); setTimeout(resolve, PRINT_POST_HANDOFF_DELAY_MS) }
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
        log.info(`${LOG}: processing job (${printQueue.length} remaining)`)
        try {
            await processPrintJob(job.docBase64, job.printerName, job.previewType, job.jobTitle)
            job.resolve(true)
        } catch (err) {
            log.error(`${LOG}: job failed: ${err.message}`)
            job.reject(err)
        }
    }
    isProcessingPrint = false
    log.info(`${LOG}: queue empty`)
}

export function enqueuePrintJob(docBase64, printerName, previewType, jobTitle) {
    return new Promise((resolve, reject) => {
        printQueue.push({ docBase64, printerName, previewType, jobTitle, resolve, reject })
        log.info(`${LOG}: enqueued (${printQueue.length} in queue)`)
        if (!isProcessingPrint) drainPrintQueue().catch(err => log.error(`${LOG}: queue error: ${err.message}`))
    })
}
