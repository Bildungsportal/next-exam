import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import log from 'electron-log';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

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
 * Walk parent chain in one PowerShell spawn (avoids ~3s cold-start per PID).
 */
async function walkParentChainWindows(startPid, maxDepth) {
    const ps =
        `$id=${Number(startPid)};$d=${Number(maxDepth)};$seen=@{};` +
        `while($d -gt 0 -and $id -gt 1){` +
        `if($seen.ContainsKey([string]$id)){break};$seen[[string]$id]=1;` +
        `$p=Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue;` +
        `if(-not $p){break};` +
        `Write-Output ("{0}|{1}|{2}" -f $p.ProcessId,$p.ParentProcessId,$p.Name);` +
        `$id=$p.ParentProcessId;$d--` +
        `}`;
    const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', ps],
        { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 64, windowsHide: true }
    );
    return stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [pidStr, ppidStr, ...nameParts] = line.split('|');
            const pid = parseInt(pidStr, 10);
            const ppid = parseInt(ppidStr, 10);
            const name = nameParts.join('|').toLowerCase();
            if (isNaN(pid) || isNaN(ppid) || !name) return null;
            return { pid, ppid, name };
        })
        .filter(Boolean);
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

/** True if process name matches a known browser keyword. */
function isBrowserName(name) {
    return browserKeywords.some((browser) => name.includes(browser));
}

/**
 * Recursively check parent processes for browser (Unix: /proc or ps per step)
 */
async function findParentProcessUnix(pid, maxDepth, visitedPids) {
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
    
    const processInfo = await getProcessInfoUnix(pid);
    
    if (!processInfo) {
        return false;
    }
    
    const { ppid, name } = processInfo;
    
    log.info(`checkparent @ findParentProcess: Checking process: ${name} (PID: ${pid}, PPID: ${ppid})`);
    
    if (isBrowserName(name)) {
        log.info(`checkparent @ findParentProcess: Browser found: ${name}`);
        return true;
    } else if (name.includes('explorer') || ppid <= 1) {
        log.info(`checkparent @ findParentProcess: Reached system process or explorer`);
        return false;
    } else {
        return await findParentProcessUnix(ppid, maxDepth - 1, visitedPids);
    }
}

/** Windows: one CIM walk, then keyword check in JS. */
async function findParentProcessWindows(startPid, maxDepth) {
    try {
        const chain = await walkParentChainWindows(startPid, maxDepth);
        for (const { pid, ppid, name } of chain) {
            log.info(`checkparent @ findParentProcess: Checking process: ${name} (PID: ${pid}, PPID: ${ppid})`);
            if (isBrowserName(name)) {
                log.info(`checkparent @ findParentProcess: Browser found: ${name}`);
                return true;
            }
            if (name.includes('explorer') || ppid <= 1) {
                log.info(`checkparent @ findParentProcess: Reached system process or explorer`);
                return false;
            }
        }
        if (chain.length === 0) {
            log.info('checkparent @ findParentProcess: Empty parent chain (process gone or CIM miss)');
        }
        return false;
    } catch (error) {
        log.error(`checkparent @ findParentProcessWindows: ${error.message}`);
        return false;
    }
}

/**
 * Check if parent process is a browser
 */
export async function checkParentProcess() {
    try {
        const startPid = process.ppid;
        const foundBrowser = process.platform === 'win32'
            ? await findParentProcessWindows(startPid, 6)
            : await findParentProcessUnix(startPid, 6, new Set());
        log.info(`checkparent @ checkParentProcess: Browser detection result: ${foundBrowser}`);
        return { success: true, foundBrowser };
    } catch (error) {
        log.error(`checkparent @ checkParentProcess: Error in browser detection: ${error.message}`);
        return { success: false, foundBrowser: false, error: error.message };
    }
}
