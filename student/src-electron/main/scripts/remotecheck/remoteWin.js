import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const suspiciousKeywords = [
  'teamviewer', 'anydesk', 'rustdesk', 'vnc', 'zoom', 'discord', 'skype', 'teams',
  'chromeremotedesktop', 'splashtop', 'dwagent',
  'logmein', 'screenconnect', 'zoho', 'parallels','chatgpt',
  'remoteutilities', 'g2comm', 'pcvisit', 'pcvisit_support', 'pcvisit_customer', 'support 15'
]

const suspiciousPorts = [
  53, 2002, 5222, 5650, 5900, 5901, 5902, 5938,
  7070, 6783, 6784, 6785, 8040, 8041, 8042, 21115, 21116
];

async function checkProcesses() {
  const foundKeywords = []

  try {
    // Execute 'tasklist /fo csv' (structured format, faster than /v, still shows process names)
    const { stdout } = await execAsync('tasklist /fo csv', { 
      encoding: 'utf8',
      timeout: 3000,  // 3 second timeout
      maxBuffer: 1024 * 1024 * 2  // 2MB buffer
    })
    
    const out = stdout.toLowerCase()
    
    for (const keyword of suspiciousKeywords) {
      if (out.includes(keyword)) {
        foundKeywords.push(keyword)
      }
    }
    
    return foundKeywords
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