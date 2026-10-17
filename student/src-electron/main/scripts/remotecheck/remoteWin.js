import { exec } from 'child_process'
import { promisify } from 'util'
import { appsToClose } from '../appsToClose.js'
import { findKeywordHits, normalizeStem, parseWinTasklistStems } from './processKeywords.js'

const execAsync = promisify(exec)

// derived from appsToClose (single source of truth); lowercase + deduped; exact process-stem match via processKeywords.js
const suspiciousKeywords = [...new Set(appsToClose.map((k) => k.toLowerCase()))]

const suspiciousPorts = [
  2002, 5222, 5650, 5900, 5901, 5902, 5938,
  7070, 6783, 6784, 6785, 8040, 8041, 8042, 21115, 21116
];

const MSEDGE_BROWSER_TITLE = /\bedge\b/i

// True when interactive msedge shows a real browser window title (not leftover OLE/N/A stubs after quit).
async function confirmMsedgeUserBrowser() {
  try {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq msedge.exe" /FO CSV /V', {
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 1024 * 1024,
    })
    for (const line of String(stdout).split(/\r?\n/)) {
      const cols = line.match(/"(.*?)"/g)?.map((s) => s.slice(1, -1))
      if (!cols || cols.length < 9 || normalizeStem(cols[0]) !== 'msedge') continue
      const sessionId = Number(cols[3])
      const title = cols[cols.length - 1] || ''
      if (sessionId > 0 && MSEDGE_BROWSER_TITLE.test(title)) return true
    }
    return false
  } catch {
    return false
  }
}

async function checkProcesses() {
  try {
    // Execute 'tasklist /fo csv' (structured format, faster than /v, still shows process names)
    const { stdout } = await execAsync('tasklist /fo csv', {
      encoding: 'utf8',
      timeout: 3000,  // 3 second timeout
      maxBuffer: 1024 * 1024 * 2  // 2MB buffer
    })
    const stems = parseWinTasklistStems(stdout)
    let hits = findKeywordHits(stems, suspiciousKeywords)
    if (stems.has('msedge') && !(await confirmMsedgeUserBrowser())) {
      hits = hits.filter((k) => normalizeStem(k) !== 'msedge' && normalizeStem(k) !== 'microsoft edge')
    }
    return hits
  } catch (error) {
    return []  // Return empty on error/timeout
  }
}

async function checkPorts() {
  const foundPorts = []

  try {
    // Execute 'netstat -ano' (shows all connection states including ESTABLISHED for screensharing detection)
    const { stdout } = await execAsync('netstat -ano', {
      encoding: 'utf8',
      timeout: 3000,  // 3 second timeout
      maxBuffer: 1024 * 1024 * 2  // 2MB buffer
    })

    for (const port of suspiciousPorts) {
      // Regex to find :PORT followed by a space (ensures exact port match, e.g., :5938 )
      // This prevents matching :53 inside :535543
      const regex = new RegExp(`:${port}\\s`, 'g')
      if (regex.test(stdout)) {
        foundPorts.push(port)
      }
    }

    return foundPorts
  } catch (error) {
    return []  // Return empty on error/timeout
  }
}

export async function runRemoteCheck() {
  try {
    // Run both checks in parallel with timeout
    const [foundKeywords, foundPorts] = await Promise.all([
      checkProcesses(),
      checkPorts()
    ])

    if (foundKeywords.length === 0 && foundPorts.length === 0) {
      return false
    }

    return { // Return found keywords and ports
      keywords: foundKeywords,
      ports: foundPorts,
    }
  } catch (error) {
    return false  // Return false on any error
  }
}
