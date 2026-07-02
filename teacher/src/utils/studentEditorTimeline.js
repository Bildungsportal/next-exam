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
 * 
 * 
 * Credits go to the original author: @stefankugler https://github.com/stefankugler/next-exam-timeline-diff
 */

import log from 'electron-log/renderer'

/** Matches Next-Exam editor backup folders YYYYMMDD_HH_MM_SS under a student directory. */
const BACKUP_DIR_NAME_RE = /^\d{8}_\d{2}_\d{2}_\d{2}$/

/** Skip system dirs at exam workdir root when offering timeline on student folders. */
const PINNED_STUDENT_ROOT_DIRS = new Set(['ABGABE', 'logfiles', 'screenshots'])

/** Avoid LCS DP blowups in the renderer (n*m cap). */
const MAX_LCS_CELLS = 4_000_000

/**
 * True when file row is a direct subdirectory of the exam workdir (student folder candidate).
 */
export function isStudentExplorerRowForTimeline(file, workdirectory) {
    if (!file || file.type !== 'dir' || !file.parent || !workdirectory) return false
    if (PINNED_STUDENT_ROOT_DIRS.has(file.name)) return false
    const norm = (s) => String(s).replace(/\\/g, '/').replace(/\/+$/, '')
    return norm(file.parent) === norm(workdirectory)
}

/**
 * Join path segments using the separator style of the base path (Windows vs POSIX).
 */
export function joinFsPath(base, ...segments) {
    const sep = String(base).includes('\\') ? '\\' : '/'
    let out = String(base).replace(new RegExp(`[\\\\/]+$`), '')
    for (const seg of segments) {
        const s = String(seg).replace(/^[\\\\/]+/, '')
        if (s) out = `${out}${sep}${s}`
    }
    return out
}

/**
 * Map backup folder name to ISO-like local timestamp string (no timezone shift).
 */
export function backupDirNameToTimestampIso(dirName) {
    const m = String(dirName).match(/^(\d{4})(\d{2})(\d{2})_(\d{2})_(\d{2})_(\d{2})$/)
    if (!m) return null
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
}

/**
 * Convert editor .htm backup buffer to plain text (DOM in Electron renderer).
 */
export function htmToPlainText(html) {
    const raw = String(html ?? '')
    if (!raw.trim()) return ''
    if (typeof document === 'undefined') return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    try {
        const doc = new DOMParser().parseFromString(raw, 'text/html')
        const body = doc.body
        if (!body) return ''
        const t = body.innerText ?? body.textContent ?? ''
        return String(t).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    } catch (e) {
        log.warn(`studentEditorTimeline @ htmToPlainText: ${e?.message || e}`)
        return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
}

/**
 * Escape text for safe v-html wrapping of diff spans.
 */
export function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

/**
 * Split into words and whitespace runs for word-level diff.
 */
export function tokenizeForDiff(text) {
    const m = String(text ?? '').match(/\S+|\s+/gu)
    return m || []
}

function isWhitespaceToken(t) {
    return /^\s+$/.test(t)
}

/**
 * Myers LCS backtrack yielding delete/insert/equal ops on token arrays.
 */
function diffTokensRaw(a, b) {
    const n = a.length
    const m = b.length
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
            else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
    }
    const rev = []
    let i = n
    let j = m
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            rev.push({ op: 'eq', t: a[i - 1] })
            i -= 1
            j -= 1
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            rev.push({ op: 'ins', t: b[j - 1] })
            j -= 1
        } else {
            rev.push({ op: 'del', t: a[i - 1] })
            i -= 1
        }
    }
    rev.reverse()
    return rev
}

/**
 * Merge isolated del+ins of single non-whitespace tokens into a replace segment (orange).
 */
function mergeReplaceOps(ops) {
    const out = []
    let i = 0
    while (i < ops.length) {
        const cur = ops[i]
        const nxt = ops[i + 1]
        if (
            cur.op === 'del' &&
            nxt &&
            nxt.op === 'ins' &&
            !isWhitespaceToken(cur.t) &&
            !isWhitespaceToken(nxt.t)
        ) {
            out.push({ op: 'chg', oldT: cur.t, newT: nxt.t })
            i += 2
        } else {
            out.push(cur)
            i += 1
        }
    }
    return out
}

/**
 * Build display segments from previous and current plain text (word-level).
 */
export function diffPlainTextToSegments(prevText, currText) {
    const a = tokenizeForDiff(prevText)
    const b = tokenizeForDiff(currText)
    if (a.length * b.length > MAX_LCS_CELLS) {
        return { tooLarge: true, segments: [{ op: 'plain', t: currText }] }
    }
    const raw = diffTokensRaw(a, b)
    const segments = mergeReplaceOps(raw)
    return { tooLarge: false, segments }
}

/**
 * Extra CSS class for whitespace-only diff tokens (softer highlight in viewer).
 */
function diffTokenWsClass(t) {
    return isWhitespaceToken(String(t ?? '')) ? ' etd-token-ws' : ''
}

/**
 * Turn diff segments into HTML (trusted structure, escaped user text).
 */
export function segmentsToDiffHtml(segments) {
    let html = ''
    for (const s of segments) {
        if (s.op === 'eq') html += escapeHtml(s.t)
        else if (s.op === 'del') html += `<span class="etd-del${diffTokenWsClass(s.t)}">${escapeHtml(s.t)}</span>`
        else if (s.op === 'ins') html += `<span class="etd-ins${diffTokenWsClass(s.t)}">${escapeHtml(s.t)}</span>`
        else if (s.op === 'chg') {
            html += `<span class="etd-chg-old${diffTokenWsClass(s.oldT)}">${escapeHtml(s.oldT)}</span><span class="etd-chg-new${diffTokenWsClass(s.newT)}">${escapeHtml(s.newT)}</span>`
        } else if (s.op === 'plain') html += escapeHtml(s.t)
    }
    return html
}

async function ipcListWorkdir(dir) {
    const res = await window.ipcRenderer.invoke('listTeacherWorkdir', {
        servername: this.servername,
        servertoken: this.servertoken,
        dir,
    })
    if (!res || res.status !== 'success' || !Array.isArray(res.filelist)) {
        throw new Error(res?.message || 'listTeacherWorkdir failed')
    }
    return res.filelist
}

async function ipcReadWorkdirFile(filepath) {
    const res = await window.ipcRenderer.invoke('readTeacherWorkdirFile', {
        servername: this.servername,
        servertoken: this.servertoken,
        filepath,
    })
    if (!res || res.status !== 'success' || res.data == null) {
        const err = new Error(res?.message || 'readTeacherWorkdirFile failed')
        if (res?.code) err.code = res.code
        throw err
    }
    return res.data
}

function decodeFileToString(raw) {
    const buf = raw instanceof ArrayBuffer ? raw : new Uint8Array(raw).buffer
    return new TextDecoder('utf-8').decode(buf)
}

/**
 * Scan student folder for timestamp subdirs and build timeline document + write JSON next to backups (expects dashboard `this`).
 */
async function buildStudentEditorTimeline(studentDirFile) {
    const studentDir = studentDirFile.path
    const studentFolder = studentDirFile.name
    const rows = await ipcListWorkdir.call(this, studentDir)
    const dirs = rows.filter((r) => r && r.type === 'dir' && BACKUP_DIR_NAME_RE.test(r.name))
    dirs.sort((a, b) => String(a.name).localeCompare(String(b.name)))
    const entries = []
    for (const d of dirs) {
        const htmBase = `${studentFolder}.htm`
        const htmPath = joinFsPath(d.path, htmBase)
        let text = ''
        try {
            const raw = await ipcReadWorkdirFile.call(this, htmPath)
            text = htmToPlainText(decodeFileToString(raw))
        } catch (e) {
            if (e && e.code === 'ENOENT') continue
            log.warn(`studentEditorTimeline: read htm failed path=${htmPath} err=${e?.message || e}`)
            continue
        }
        const tsIso = backupDirNameToTimestampIso(d.name)
        entries.push({
            timestamp_name: d.name,
            timestamp: tsIso,
            text,
            sourceHtm: htmPath,
        })
    }
    if (!entries.length) {
        log.warn(
            `studentEditorTimeline: no .htm backup files found for "${studentFolder}" (${dirs.length} editor backup timestamp folder(s) scanned; expected ${studentFolder}.htm in each)`,
        )
        return null
    }
    const outPath = joinFsPath(studentDir, `${studentFolder}_editor_timeline.json`)
    const doc = {
        version: 1,
        kind: 'next-exam-editor-timeline',
        studentFolder,
        generatedAt: new Date().toISOString(),
        jsonPath: outPath,
        entries,
    }
    const jsonStr = `${JSON.stringify(doc, null, 2)}\n`
    const wres = await window.ipcRenderer.invoke('writeTeacherWorkdirUtf8File', {
        servername: this.servername,
        filepath: outPath,
        utf8: jsonStr,
    })
    if (!wres || wres.status !== 'success') {
        throw new Error(wres?.message || 'writeTeacherWorkdirUtf8File failed')
    }
    log.info(
        `studentEditorTimeline: timeline saved folder=${studentFolder} entries=${entries.length} path=${outPath}`,
    )
    return doc
}

/**
 * Build timeline JSON for a student folder and open the in-dashboard diff viewer (dashboard `this`).
 */
export async function openStudentEditorTimelineDiff(file) {
    this.$swal.fire({
        text: this.$t('dashboard.editorTimelineDiffBuilding'),
        showConfirmButton: false,
        allowOutsideClick: false,
        didOpen: () => {
            this.$swal.showLoading()
        },
    })
    try {
        const doc = await buildStudentEditorTimeline.call(this, file)
        this.$swal.close()
        if (!doc) {
            await this.$swal.fire({
                icon: 'warning',
                text: this.$t('dashboard.editorTimelineDiffNoSnapshots'),
            })
            return
        }
        this.editorTimelineViewerDoc = doc
        this.showEditorTimelineViewer = true
        await this.$swal.fire({
            icon: 'success',
            timer: 1400,
            showConfirmButton: false,
            text: this.$t('dashboard.editorTimelineDiffSaved', { name: doc.studentFolder }),
        })
    } catch (e) {
        log.error('studentEditorTimeline @ openStudentEditorTimelineDiff:', e)
        this.$swal.close()
        await this.$swal.fire({
            icon: 'warning',
            text: this.$t('dashboard.editorTimelineDiffError'),
        })
    }
}
