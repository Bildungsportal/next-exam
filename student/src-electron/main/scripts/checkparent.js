import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import log from 'electron-log';

const execAsync = promisify(exec);

// Expanded browser keywords to catch more variants
const browserKeywords = [
    'chrom', 'chrome.exe',
    'edge', 'msedge.exe',
    'fire', 'firefox.exe',
    'brave', 'brave.exe',
    'opera', 'opera.exe',
    'browser', // Generic browser process
    'iexplore', // Internet Explorer
    'safari', // For macOS
];

/**
 * Get process info on Windows using PowerShell
 */
async function getProcessInfoWindows(pid) {
    try {
        const command = `powershell.exe -NoLogo -NoProfile -Command "& { $proc = Get-CimInstance -Class Win32_Process -Filter 'ProcessId=${pid}'; if ($proc) { $proc.ParentProcessId; $proc.Name } }"`;
        const { stdout } = await execAsync(command, {
            encoding: 'utf8',
            timeout: 3000,
            maxBuffer: 1024 * 64
        });
        
        const lines = stdout.trim().split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length < 2) {
            return null;
        }
        
        const ppid = parseInt(lines[0], 10);
        const name = lines[1].toLowerCase();
        
        if (isNaN(ppid)) {
            return null;
        }
        
        return { ppid, name };
    } catch (error) {
        log.error(`checkparent @ getProcessInfoWindows: Error for PID ${pid}: ${error.message}`);
        return null;
    }
}

/**
 * Get process info on Unix systems (Linux/macOS)
 * Tries /proc first (Linux only, fastest), falls back to ps command
 */
async function getProcessInfoUnix(pid) {
    try {
        // Try /proc first (Linux only, fastest method ~4ms, no process spawn)
        const [statContent, commContent] = await Promise.all([
            readFile(`/proc/${pid}/stat`, 'utf8').catch(() => null),
            readFile(`/proc/${pid}/comm`, 'utf8').catch(() => null)
        ]);
        
        if (statContent) {
            // Parse /proc/pid/stat: pid (comm) state ppid ...
            const statMatch = statContent.match(/^\d+\s+\(([^)]+)\)\s+\S+\s+(\d+)/);
            if (statMatch) {
                const name = (commContent || statMatch[1]).trim().toLowerCase();
                const ppid = parseInt(statMatch[2], 10);
                return { ppid, name };
            }
        }
        
        // Fallback to ps command (works on both Linux and macOS)
        const command = `ps -p ${pid} -o ppid=,comm=`;
        const { stdout } = await execAsync(command, {
            encoding: 'utf8',
            timeout: 2000,
            maxBuffer: 1024 * 64
        });
        
        const parts = stdout.trim().split(/\s+/);
        if (parts.length < 2) {
            return null;
        }
        
        const ppid = parseInt(parts[0], 10);
        const name = parts.slice(1).join(' ').toLowerCase();
        
        if (isNaN(ppid)) {
            return null;
        }
        
        return { ppid, name };
    } catch (error) {
        log.error(`checkparent @ getProcessInfoUnix: Error for PID ${pid}: ${error.message}`);
        return null;
    }
}

/**
 * Get process info based on platform
 */
async function getProcessInfo(pid) {
    const platform = process.platform;
    
    if (platform === 'win32') {
        return await getProcessInfoWindows(pid);
    } else if (platform === 'linux' || platform === 'darwin') {
        return await getProcessInfoUnix(pid); // Linux/macOS: tries /proc, falls back to ps
    }
    
    return null;
}

/**
 * Recursively check parent processes for browser
 */
async function findParentProcess(pid, maxDepth, visitedPids) {
    if (pid === 1 || pid === 0) {
        log.info('checkparent @ findParentProcess: Root PID reached. No web browser found.');
        return false;
    }
    
    if (maxDepth <= 0) {
        return false; // Silent return when max depth reached
    }
    
    if (visitedPids.has(pid)) {
        return false; // Silent return for circular references
    }
    
    visitedPids.add(pid);
    
    // Get process info (getProcessInfo already has its own timeout protection)
    const processInfo = await getProcessInfo(pid);
    
    if (!processInfo) {
        return false;
    }
    
    const { ppid, name } = processInfo;
    
    // Log the process info for debugging
    log.info(`checkparent @ findParentProcess: Checking process: ${name} (PID: ${pid}, PPID: ${ppid})`);
    
    // More thorough browser detection
    if (browserKeywords.some(browser => name.includes(browser))) {
        log.info(`checkparent @ findParentProcess: Browser found: ${name}`);
        return true;
    } else if (name.includes('explorer') || ppid <= 1) {
        log.info(`checkparent @ findParentProcess: Reached system process or explorer`);
        return false;
    } else {
        return await findParentProcess(ppid, maxDepth - 1, visitedPids);
    }
}

/**
 * Check if parent process is a browser
 */
export async function checkParentProcess() {
    try {
        const foundBrowser = await findParentProcess(process.ppid, 6, new Set());
        log.info(`checkparent @ checkParentProcess: Browser detection result: ${foundBrowser}`);
        return { success: true, foundBrowser };
    } catch (error) {
        log.error(`checkparent @ checkParentProcess: Error in browser detection: ${error.message}`);
        return { success: false, foundBrowser: false, error: error.message };
    }
}

