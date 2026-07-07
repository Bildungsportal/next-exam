import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import { appsToClose } from '../appsToClose.js'
import { findKeywordHits, normalizeStem, parseWinTasklistStems } from './processKeywords.js'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

// derived from appsToClose (single source of truth); lowercase + deduped; exact process-stem match via processKeywords.js
const suspiciousKeywords = [...new Set(appsToClose.map((k) => k.toLowerCase()))]

const suspiciousPorts = [
  2002, 5222, 5650, 5900, 5901, 5902, 5938,
  7070, 6783, 6784, 6785, 8040, 8041, 8042, 21115, 21116
];

// True when msedge runs in an interactive session with a visible window or renderer (not Session-0 service).
async function confirmMsedgeUserBrowser() {
  try {
    const ps =
      '$h=Get-CimInstance Win32_Process -Filter "Name=\'msedge.exe\'"|Where-Object{$_.SessionId -gt 0 -and ' +
      '(($_.CommandLine -match \'--type=renderer\') -or ((Get-Process -Id $_.ProcessId -EA SilentlyContinue).MainWindowHandle -gt 0))}|Select -First 1;' +
      'if($h){"1"}'
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], {
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    })
    return stdout.trim() === '1'
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
