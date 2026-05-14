/**
 * Combined latest-submissions PDF pipeline (index table + merged PDF); formerly POST /server/data/getlatest.
 */
import fs from 'fs'
import log from 'electron-log'
import moment from 'moment'
import pdfParse from '@bingsjs/pdf-parse'
import { PDFDocument, rgb } from 'pdf-lib/dist/pdf-lib.js'
import { decryptBufferIfNeeded } from './examFileCryptoContext.js'
import { resolvePathUnderRoot, isSafePathSegment } from '../../server/src/utils/safePaths.js'

/** Returns true when buffer starts with %PDF- */
function isValidPdf(data) {
    const header = new Uint8Array(data, 0, 5)
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2d]
    for (let i = 0; i < pdfHeader.length; i++) {
        if (header[i] !== pdfHeader[i]) {
            log.warn('getLatestCombinedPdf @ isValidPdf: invalid PDF processed')
            return false
        }
    }
    return true
}

/** Copies index.pdf / combined.pdf into backup dir when configured */
async function mirrorExamRootFileToBackup(backupdirectory, servername, basename, data) {
    if (!backupdirectory) return
    const allowed = new Set(['index.pdf', 'combined.pdf'])
    if (!allowed.has(basename) || !isSafePathSegment(servername) || !isSafePathSegment(basename)) {
        log.warn(`getLatestCombinedPdf @ mirrorExamRootFileToBackup: rejected mirror (${servername}/${basename})`)
        return
    }
    const backupExamDir = resolvePathUnderRoot(backupdirectory, [servername])
    const dest = backupExamDir ? resolvePathUnderRoot(backupExamDir, [basename]) : null
    if (!backupExamDir || !dest) {
        log.warn(`getLatestCombinedPdf @ mirrorExamRootFileToBackup: unsafe path (${servername}/${basename})`)
        return
    }
    try {
        await fs.promises.mkdir(backupExamDir, { recursive: true })
        await fs.promises.writeFile(dest, data)
    } catch (err) {
        log.error(`getLatestCombinedPdf @ mirrorExamRootFileToBackup: ${basename}`, err)
    }
}

/** Parses submission PDF for Zeichen count (regex or fallback to extracted length) */
async function countCharsOfPDF(mcServer, pdfPath, studentname, servername) {
    const raw = await fs.promises.readFile(pdfPath)
    const dataBuffer = mcServer ? decryptBufferIfNeeded(raw, mcServer, 'getLatestCombinedPdf @ countCharsOfPDF') : raw
    let chars = 0

    if (isValidPdf(dataBuffer)) {
        chars = await pdfParse(dataBuffer)
            .then((data) => {
                if (data && data.text && studentname) {
                    let numberOfCharacters = data.text.length
                    let regex = /Zeichen: (\d+)/
                    let matches = data.text.match(regex)
                    let zeichenAnzahl = matches ? matches[1] : 'notfound'

                    if (zeichenAnzahl !== 'notfound') {
                        return zeichenAnzahl
                    }
                    regex = /Zeichen:(\d+)/
                    matches = data.text.match(regex)
                    zeichenAnzahl = matches ? matches[1] : 'notfound'
                    if (zeichenAnzahl !== 'notfound') {
                        return zeichenAnzahl
                    }
                    log.verbose('getLatestCombinedPdf @ countCharsOfPDF: Zeichen regex miss')
                    return numberOfCharacters >= 0 ? `~ ${numberOfCharacters}` : '~ 0'
                }
                return 0
            })
            .catch((err) => {
                log.error(`getLatestCombinedPdf @ countCharsOfPDF: ${err}`)
                return 0
            })
    } else {
        chars = 'no pdf'
    }

    return chars
}

/** Builds the index table PDF bytes */
async function createIndexPDF(submissions, servername, mcServer) {
    const tabledata = [['Name', 'Abschnitt', 'Datum', 'Zeichen', 'Dateiname']]
    for (const student of submissions) {
        let hasSubmission = false
        const trimmedName = student.studentName.length > 20 ? `${student.studentName.slice(0, 20)}...` : student.studentName
        for (let section = 1; section <= 4; section++) {
            let name = '-'
            let sectionName = '-'
            let time = '-'
            let chars = '0'
            let filename = '-'

            if (student.sections[section].path) {
                name = trimmedName
                sectionName = student.sections[section].sectionname || `Abschnitt ${section}`
                sectionName = sectionName.length > 20 ? `${sectionName.slice(0, 20)}...` : sectionName
                time = moment(student.sections[section].date).format('DD.MM.YYYY HH:mm')
                chars = await countCharsOfPDF(mcServer, student.sections[section].path, student.studentName, servername)
                filename = student.sections[section].filename.length > 25
                    ? `${student.sections[section].filename.slice(0, 25)}...`
                    : student.sections[section].filename
                tabledata.push([name, sectionName, time, chars, filename])
                hasSubmission = true
            }
        }
        if (!hasSubmission) {
            tabledata.push([trimmedName, '', '', '', ''])
        }
    }

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage()

    const startX = 50
    const startY = page.getHeight() - 50
    const rowHeight = 15
    const columnWidths = [110, 130, 80, 40, 140]

    const drawCell = (x, y, width, height) => {
        page.drawRectangle({ x, y, width, height, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    }
    const addText = (text, x, y) => {
        const s = String(text)
        page.drawText(s, { x, y, size: 9, color: rgb(0, 0, 0) })
    }

    tabledata.forEach((row, rowIndex) => {
        const yPos = startY - rowIndex * rowHeight
        row.forEach((cellText, columnIndex) => {
            const xPos = startX + columnWidths.slice(0, columnIndex).reduce((acc, val) => acc + val, 0)
            drawCell(xPos, yPos - rowHeight, columnWidths[columnIndex], rowHeight)
            addText(cellText, xPos + 3, yPos - rowHeight + 4)
        })
    })
    const pdfBytes = await pdfDoc.save()
    return pdfBytes
}

/** Merges PDF files from disk into one document */
async function concatPages(mcServer, pdfsToMerge) {
    const tempPDF = await PDFDocument.create()
    for (const pdfpath of pdfsToMerge) {
        const raw = await fs.promises.readFile(pdfpath)
        let pdfBytes = mcServer ? decryptBufferIfNeeded(raw, mcServer, 'getLatestCombinedPdf @ concatPages') : raw
        if (isValidPdf(pdfBytes)) {
            const pdfDoc = await PDFDocument.load(pdfBytes)
            const copiedPages = await tempPDF.copyPages(pdfDoc, pdfDoc.getPageIndices())
            copiedPages.forEach((page) => {
                tempPDF.addPage(page)
            })
        }
    }
    const finalPDF = await tempPDF.save()
    return finalPDF
}

/** Writes index.pdf + combined.pdf and returns buffers/paths like the old HTTP route */
export async function buildTeacherCombinedLatestPdf({ workdirectory, backupdirectory, mcServer, submissions }) {
    const warning = false
    const serverFolder = mcServer.serverinfo.servername

    const latestFiles = []
    for (const student of submissions) {
        for (let section = 1; section <= 4; section++) {
            if (student.sections[section].path) {
                latestFiles.push(student.sections[section].path)
            }
        }
    }
    log.info('getLatestCombinedPdf @ buildTeacherCombinedLatestPdf: latestFiles', latestFiles)

    if (latestFiles.length === 0) {
        return { warning, pdfBuffer: null, pdfPath: null }
    }

    const indexPDFdata = await createIndexPDF(submissions, serverFolder, mcServer)
    let indexPDFpath = resolvePathUnderRoot(workdirectory, [serverFolder, 'index.pdf'])
    try {
        if (!indexPDFpath) {
            log.error('getLatestCombinedPdf @ buildTeacherCombinedLatestPdf: rejected index.pdf path')
        } else {
            await fs.promises.writeFile(indexPDFpath, indexPDFdata)
            log.info('getLatestCombinedPdf @ buildTeacherCombinedLatestPdf: Index PDF saved successfully!')
            await mirrorExamRootFileToBackup(backupdirectory, serverFolder, 'index.pdf', indexPDFdata)
        }
    } catch (err) {
        log.error('getLatestCombinedPdf @ buildTeacherCombinedLatestPdf:', err)
    }
    if (indexPDFpath) {
        latestFiles.unshift(indexPDFpath)
    }

    const merged = await concatPages(mcServer, latestFiles)
    const pdfBuffer = Buffer.from(merged)
    let pdfPath = resolvePathUnderRoot(workdirectory, [serverFolder, 'combined.pdf'])
    try {
        if (!pdfPath) {
            log.error('getLatestCombinedPdf @ buildTeacherCombinedLatestPdf: rejected combined.pdf path')
        } else {
            await fs.promises.writeFile(pdfPath, pdfBuffer)
            log.info('getLatestCombinedPdf @ buildTeacherCombinedLatestPdf: PDF saved successfully!')
            await mirrorExamRootFileToBackup(backupdirectory, serverFolder, 'combined.pdf', pdfBuffer)
        }
    } catch (err) {
        log.error('getLatestCombinedPdf @ buildTeacherCombinedLatestPdf:', err)
    }
    return { warning, pdfBuffer, pdfPath: pdfPath || null }
}
