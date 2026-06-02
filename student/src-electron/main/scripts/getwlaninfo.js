import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import log from 'electron-log';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Full path to System32 exe (Sysnative for x86 Node on x64). Avoids cmd.exe via exec() in Assigned Access. */
function resolveWindowsSystem32Exe(...segments) {
    const root = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
    const base = process.arch === 'ia32' ? path.join(root, 'Sysnative') : path.join(root, 'System32');
    return path.join(base, ...segments);
}

// Counter for failed attempts - skip execution after 4 consecutive failures
let failureCounter = 0;
const MAX_FAILURES = 3;

// Convert RSSI in dBm to a quality percentage between 0 and 100.
function dbmToQualityPercent(dbm) {
    if (dbm === null || Number.isNaN(dbm)) return null;
    const minDbm = -100;
    const maxDbm = -30;
    const clamped = Math.max(minDbm, Math.min(maxDbm, dbm));
    const percent = ((clamped - minDbm) / (maxDbm - minDbm)) * 100;
    return Math.round(percent);
}

/**
 * Get current WLAN information (SSID, BSSID, Quality)
 * @returns {Promise<{ssid: string|null, bssid: string|null, quality: number|null, message: string|null}>}
 * @description message can be: "error" (on error), "nointerface" (no interface available), "nopermissions" (location permissions missing on Windows), or null (success)
 */
export async function getWlanInfo() {
    // Skip execution if we've had too many consecutive failures
    if (failureCounter >= MAX_FAILURES) {
        return { ssid: null, bssid: null, quality: null, message: 'givingup' };
    }
    
    try {
        const platform = os.platform();
        let result;
        
        switch (platform) {
            case 'linux':
                result = await getWlanInfoLinux();
                break;
            case 'win32':
                result = await getWlanInfoWindows();
                break;
            case 'darwin':
                result = await getWlanInfoMacOS();
                break;
            default:
                failureCounter++;
                return { ssid: null, bssid: null, quality: null, message: 'givingup' };
        }
        
        // Ensure result is always an object
        if (!result || typeof result !== 'object') {
            failureCounter++;
            return { ssid: null, bssid: null, quality: null, message: 'error' };
        }
        
        // Reset counter on successful result (has data)
        if (result.ssid || result.bssid || result.quality !== null) {
            failureCounter = 0;
        } else {
            // Increment counter on failure
            failureCounter++;
        }
        
        return result;
    } catch (error) {
        // Return empty object instead of throwing to prevent app crash
        failureCounter++;
        return { ssid: null, bssid: null, quality: null, message: 'error' };
    }
}

/**
 * Get WLAN info on Linux using nmcli (with fallback to iw/iwconfig)
 */
async function getWlanInfoLinux() {
    try {
        // Try nmcli first (most common on modern Linux)
        // First try to get active device directly (faster than listing all networks)
        try {
            let stdout = null;
            try {
                const result = await execAsync('nmcli -t -f active,ssid,bssid,signal device wifi list', {
                    timeout: 4000,
                    maxBuffer: 1024 * 64
                });
                stdout = result.stdout;
            
            } catch (execError) {
                // Even if execAsync throws an error, check if stdout contains valid data
                // nmcli sometimes returns non-zero exit code but still provides valid output
                if (execError.stdout && execError.stdout.trim().length > 0) {
                    stdout = execError.stdout;
                } else {
                    throw execError;
                }
            }
            
            if (!stdout || stdout.trim().length === 0) {
                throw new Error('No output from nmcli');
            }
            const lines = stdout.trim().split('\n');
            
            // Find active connection
            for (const line of lines) {
                const parts = line.split(':');
                if ((parts[0] === 'yes' || parts[0] === 'ja') && parts.length >= 4) {
                    const ssid = parts[1] || '';
                    // BSSID is a MAC address (6 hex bytes separated by colons, possibly escaped)
                    // Extract BSSID using regex - handle escaped colons (\:) as shown in nmcli output
                    // In regex string, \\: matches a literal backslash followed by colon
                    const bssidMatch = line.match(/[a-f0-9]{2}(?:\\:[a-f0-9]{2}){5}/i);
                    let bssid = null;
                    if (bssidMatch) {
                        // Remove escape backslashes and normalize to uppercase
                        bssid = bssidMatch[0].replace(/\\:/g, ':').toUpperCase();
                    } else {
                        // Fallback: try normal colons
                        const normalMatch = line.match(/[a-f0-9]{2}(?::[a-f0-9]{2}){5}/i);
                        if (normalMatch) {
                            bssid = normalMatch[0].toUpperCase();
                        } else {
                            bssid = parts[2] || '';
                        }
                    }
                    // Signal is the last numeric part
                    const signalStr = parts[parts.length - 1] ? parts[parts.length - 1].trim() : '';
                    const signal = signalStr ? (parseInt(signalStr, 10) || null) : null;
                    
                    return {
                        ssid: ssid || null,
                        bssid: bssid || null,
                        quality: signal,
                        message: null
                    };
                }
            }
        } catch (nmcliError) {
            // Only log if it's a real error (command not found, timeout, etc.), not if just no WLAN active
            const isRealError = nmcliError.code === 'ENOENT' || nmcliError.code === 'ETIMEDOUT' || 
                                (nmcliError.message && !nmcliError.message.includes('No output'));
            if (isRealError) {
                log.error('getWlanInfoLinux: nmcli command failed:', nmcliError.message || nmcliError);
            }
            
            // Fallback to iw (iwconfig is deprecated but still available on some systems)
            try {
                const { stdout: iwStdout } = await execAsync('iw dev | grep -E "^\s*ssid|^\s*link"', {
                    timeout: 2000,
                    maxBuffer: 1024 * 64
                });
                const { stdout: iwlinkStdout } = await execAsync('iw dev | grep -A 5 "^\s*link"', {
                    timeout: 2000,
                    maxBuffer: 1024 * 64
                });
                
                // Extract SSID
                const ssidMatch = iwStdout ? iwStdout.match(/ssid\s+(.+)/) : null;
                const ssid = ssidMatch ? ssidMatch[1].trim() : null;
                
                // Extract BSSID and signal from link info
                const bssidMatch = iwlinkStdout ? iwlinkStdout.match(/addr:\s+([a-f0-9:]{17})/i) : null;
                const bssid = bssidMatch ? bssidMatch[1].toUpperCase() : null;
                
                const signalMatch = iwlinkStdout ? iwlinkStdout.match(/signal:\s+(-?\d+)/) : null;
                const signalDbm = signalMatch ? (parseInt(signalMatch[1], 10) || null) : null;
                const quality = signalDbm !== null ? dbmToQualityPercent(signalDbm) : null;
                
                return {
                    ssid,
                    bssid,
                    quality,
                    message: (ssid || bssid || quality !== null) ? null : 'nointerface'
                };
            } catch (iwError) {
                // Only log if it's a real error
                const isRealError = iwError.code === 'ENOENT' || iwError.code === 'ETIMEDOUT';
                if (isRealError) {
                    log.error('getWlanInfoLinux: iw command failed:', iwError.message || iwError);
                }
                
                // Last fallback: iwconfig (deprecated but widely available)
                try {
                    const { stdout } = await execAsync('iwconfig 2>/dev/null | grep -E "ESSID|Access Point|Signal level"', {
                        timeout: 2000,
                        maxBuffer: 1024 * 64
                    });
                    const lines = stdout.split('\n');
                    
                    let ssid = null;
                    let bssid = null;
                    let signal = null;
                    
                    for (const line of lines) {
                        const ssidMatch = line.match(/ESSID:"([^"]+)"/);
                        if (ssidMatch) ssid = ssidMatch[1];
                        
                        const bssidMatch = line.match(/Access Point:\s+([a-f0-9:]{17})/i);
                        if (bssidMatch) bssid = bssidMatch[1].toUpperCase();
                        
                        const signalMatch = line.match(/Signal level=(-?\d+)/);
                        if (signalMatch) {
                            const parsed = parseInt(signalMatch[1], 10);
                            signal = isNaN(parsed) ? null : parsed;
                        }
                    }
                    
                    return {
                        ssid,
                        bssid,
                        quality: dbmToQualityPercent(signal),
                        message: (ssid || bssid || signal !== null) ? null : 'nointerface'
                    };
                } catch (iwconfigError) {
                    // Only log if all methods failed with real errors (command not found, timeout)
                    const isRealError = iwconfigError.code === 'ENOENT' || iwconfigError.code === 'ETIMEDOUT';
                    if (isRealError) {
                        log.error('getWlanInfoLinux: All methods (nmcli, iw, iwconfig) failed. Last error:', iwconfigError.message || iwconfigError);
                    }
                }
            }
        }
    } catch (error) {
        // Log unexpected errors during WLAN info retrieval
        log.error('getWlanInfoLinux: Unexpected error:', error.message || error);
        return {
            ssid: null,
            bssid: null,
            quality: null,
            message: 'error'
        };
    }
    
    return {
        ssid: null,
        bssid: null,
        quality: null,
        message: 'nointerface'
    };
}

/**
 * Get WLAN info on Windows using netsh
 */
async function getWlanInfoWindows() {
    const netshExe = resolveWindowsSystem32Exe('netsh.exe');
    try {
        const { stdout, stderr } = await execFileAsync(netshExe, ['wlan', 'show', 'interfaces'], {
            timeout: 5000,
            maxBuffer: 1024 * 64,
            windowsHide: true,
        });
        
        // Check stderr for service errors
        const errorOutput = (stderr || '').toLowerCase();
        const output = (stdout || '').toLowerCase();
        const combinedOutput = output + ' ' + errorOutput;
        
        // Check if WLAN service is not running (various language versions)
        if (combinedOutput.includes('wlansvc') || 
            combinedOutput.includes('wlan autoconfig') ||
            combinedOutput.includes('automatisch wlan') ||
            combinedOutput.includes('wlan-konfiguration') ||
            combinedOutput.includes('wird nicht ausgeführt') ||
            combinedOutput.includes('is not running') ||
            combinedOutput.includes('service is not running') ||
            combinedOutput.includes('der dienst') && combinedOutput.includes('wird nicht ausgeführt')) {
            return { ssid: null, bssid: null, quality: null, message: 'nointerface' };
        }
        
        // Check for Windows 11 location permission requirement (various language versions)
        if (combinedOutput.includes('standortberechtigungen') ||
            combinedOutput.includes('standort') && (combinedOutput.includes('benötigen') || combinedOutput.includes('benötigt')) ||
            combinedOutput.includes('location permissions') ||
            combinedOutput.includes('location') && combinedOutput.includes('required') ||
            combinedOutput.includes('positionsdienste') ||
            combinedOutput.includes('datenschutz') && combinedOutput.includes('standort') ||
            combinedOutput.includes('privacy') && combinedOutput.includes('location') ||
            combinedOutput.includes('netzwerkshellbefehle') && combinedOutput.includes('standort')) {
            // Fallback to PowerShell method that doesn't require geolocation permissions
            return await getWlanInfoWindowsPowerShell();
        }
        
        if (!stdout || stdout.trim().length === 0) {
            return { ssid: null, bssid: null, quality: null, message: 'nointerface' };
        }
        
        // Check if there are no interfaces available
        if (stdout.includes('There is no wireless interface') || 
            stdout.includes('Es gibt keine Drahtlos-Schnittstelle') ||
            stdout.match(/No wireless/i)) {
            return { ssid: null, bssid: null, quality: null, message: 'nointerface' };
        }
        
        const lines = stdout.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        let ssid = null;
        let bssid = null;
        let signal = null;
        
        for (const line of lines) {
            // SSID parsing - more flexible, handles various formats
            // Use negative lookbehind to ensure we don't match "BSSID" (which contains "SSID")
            if (line.match(/(?<!B)SSID\s*:/i)) {
                const match = line.match(/(?<!B)SSID\s*:\s*(.+)/i);
                if (match) {
                    const extracted = match[1].trim();
                    // Only set if not empty and not "N/A" or similar
                    if (extracted && extracted.length > 0 && !extracted.match(/^(N\/A|n\/a|none|keine)$/i)) {
                        ssid = extracted;
                    }
                }
            }
            // BSSID parsing - more flexible pattern matching
            else if (line.match(/BSSID\s*:/i)) {
                // Extract MAC address pattern (handles both - and : separators, with or without spaces)
                const match = line.match(/BSSID\s*:\s*([a-f0-9]{2}(?:[-:\s][a-f0-9]{2}){5})/i);
                if (match) {
                    bssid = match[1].replace(/[- ]/g, ':').toUpperCase();
                }
            }
            // Signal parsing - handle various localized formats and patterns
            else if (line.match(/Signal|Signalstärke|Intensité|Señal/i)) {
                // Try percentage pattern first (most common)
                let match = line.match(/:\s*(\d+)\s*%/i);
                if (match) {
                    const parsed = parseInt(match[1], 10);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                        signal = parsed;
                    }
                } else {
                    // Try dBm pattern (negative value)
                    match = line.match(/:\s*(-?\d+)\s*dBm/i);
                    if (match) {
                        const dbm = parseInt(match[1], 10);
                        if (!isNaN(dbm)) {
                            signal = dbmToQualityPercent(dbm);
                        }
                    }
                }
            }
        }
        
        // Normalize empty strings to null
        return {
            ssid: (ssid && ssid.length > 0) ? ssid : null,
            bssid: (bssid && bssid.length > 0) ? bssid : null,
            quality: signal,
            message: null
        };
    } catch (error) {
        // Check if error is due to location permissions (might be in stderr or error message)
        const errorMessage = (error.message || '').toLowerCase();
        const errorStdout = (error.stdout || '').toLowerCase();
        const errorStderr = (error.stderr || '').toLowerCase();
        const combinedErrorOutput = errorMessage + ' ' + errorStdout + ' ' + errorStderr;
        
        // Check for Windows 11 location permission requirement (various language versions)
        if (combinedErrorOutput.includes('standortberechtigungen') ||
            combinedErrorOutput.includes('standort') && (combinedErrorOutput.includes('benötigen') || combinedErrorOutput.includes('benötigt')) ||
            combinedErrorOutput.includes('location permissions') ||
            combinedErrorOutput.includes('location') && combinedErrorOutput.includes('required') ||
            combinedErrorOutput.includes('positionsdienste') ||
            combinedErrorOutput.includes('datenschutz') && combinedErrorOutput.includes('standort') ||
            combinedErrorOutput.includes('privacy') && combinedErrorOutput.includes('location') ||
            combinedErrorOutput.includes('netzwerkshellbefehle') && combinedErrorOutput.includes('standort')) {
            // Fallback to PowerShell method that doesn't require geolocation permissions
            return await getWlanInfoWindowsPowerShell();
        }
        
        // Log error when command execution fails (timeout, permission, etc.)
        log.error('getWlanInfoWindows: Error executing netsh command:', error.message || error);
        return { ssid: null, bssid: null, quality: null, message: 'error' };
    }
}

/**
 * Get WLAN info on Windows using PowerShell (fallback when netsh requires geolocation permissions)
 */
async function getWlanInfoWindowsPowerShell() {
    try {
        // Get SSID using Get-NetConnectionProfile (doesn't require geolocation)
        let ssid = null;
        try {
            // Get the active Wi-Fi connection profile
            const psExe = resolveWindowsSystem32Exe('WindowsPowerShell', 'v1.0', 'powershell.exe');
            const psCmd = '$profile = Get-NetConnectionProfile | Where-Object {$_.InterfaceAlias -like \'*Wi-Fi*\' -or $_.InterfaceAlias -like \'*Wireless*\'} | Select-Object -First 1; if ($profile) { $profile.Name }';
            const { stdout: ssidOutput } = await execFileAsync(psExe, ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
                timeout: 3000,
                maxBuffer: 1024 * 64,
                windowsHide: true,
            });
            const ssidStr = ssidOutput.trim();
            if (ssidStr && ssidStr.length > 0 && !ssidStr.match(/^(N\/A|n\/a|none|keine)$/i)) {
                ssid = ssidStr;
            }
        } catch (ssidError) {
            // SSID extraction failed
        }
        
        // BSSID cannot be easily retrieved without netsh (which requires geolocation permissions)
        // Setting to null as fallback - SSID is the most important information anyway
        const bssid = null;
        
        // Quality set to null when using PowerShell fallback (can't easily get signal strength without netsh)
        // Return nopermissions message so frontend can show the warning
        return {
            ssid: ssid || null,
            bssid: bssid || null,
            quality: null,
            message: 'nopermissions'
        };
    } catch (error) {
        // Log error if PowerShell fallback fails
        log.error('getWlanInfoWindowsPowerShell: PowerShell fallback failed:', error.message || error);
        return { ssid: null, bssid: null, quality: null, message: 'error' };
    }
}

// Resolve the signed wifi-helper binary (CoreWLAN + wifi-info entitlement). Returns null if absent.
function macWifiHelperPath() {
    for (const p of [
        path.join(process.resourcesPath, 'apple', 'wifi-helper'),
        path.join(process.cwd(), 'scripts', 'apple', 'wifi-helper'),
        path.join(__dirname, '../../../../scripts/apple/wifi-helper'),
    ]) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

/**
 * Query the native wifi-helper (only path that returns real SSID/BSSID on macOS 14+).
 * @returns parsed result object or null when helper missing/unusable.
 */
async function getWlanInfoMacOSHelper() {
    const bin = macWifiHelperPath();
    if (!bin) return null;
    try { fs.chmodSync(bin, 0o755); } catch (_) { /* ignore */ }
    try {
        const { stdout } = await execFileAsync(bin, [], { timeout: 6000, maxBuffer: 1024 * 64 });
        const data = JSON.parse(stdout.trim());
        const quality = (typeof data.rssi === 'number') ? dbmToQualityPercent(data.rssi) : null;
        return {
            ssid: data.ssid || null,
            bssid: data.bssid || null,
            quality,
            message: data.message || null,
        };
    } catch (error) {
        log.warn('getWlanInfoMacOS: wifi-helper failed:', error.message || error);
        return null;
    }
}

/**
 * Get WLAN info on macOS using the native wifi-helper, falling back to airport/networksetup
 */
async function getWlanInfoMacOS() {
    // Native CoreWLAN helper is the only reliable SSID source on macOS 14+; use it when available.
    const helperResult = await getWlanInfoMacOSHelper();
    if (helperResult && (helperResult.ssid || helperResult.bssid || helperResult.quality !== null)) {
        return helperResult;
    }

    try {
        // Try airport command first (deprecated but still available on some systems)
        try {
            // Check if airport is available (usually at /System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport)
            const { stdout: airportPath } = await execAsync('which airport 2>/dev/null || echo /System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport', {
                timeout: 1000,
                maxBuffer: 1024 * 64
            });
            const airport = airportPath.trim();
            
            const { stdout } = await execAsync(`${airport} -I`, {
                timeout: 2000,
                maxBuffer: 1024 * 64
            });
            const lines = stdout.split('\n').map(line => line.trim());
            
            let ssid = null;
            let bssid = null;
            let rssiDbm = null;
            let signalPercent = null;
            
            for (const line of lines) {
                if (line.startsWith('SSID:')) {
                    ssid = line.replace('SSID:', '').trim();
                } else if (line.startsWith('BSSID:')) {
                    // Extract MAC address pattern to ensure we get the full BSSID
                    const bssidMatch = line.match(/BSSID:\s*([a-f0-9]{2}(?::[a-f0-9]{2}){5})/i);
                    bssid = bssidMatch ? bssidMatch[1].toUpperCase() : null;
                } else if (line.startsWith('agrCtlRSSI:')) {
                    // RSSI in dBm (negative value)
                    const rssiStr = line.replace('agrCtlRSSI:', '').trim();
                    const rssi = rssiStr ? (parseInt(rssiStr, 10) || null) : null;
                    rssiDbm = rssi;
                } else if (line.startsWith('link auth:')) {
                    // Alternative: signal strength as percentage (if available)
                    const signalMatch = line.match(/(\d+)%/);
                    if (signalMatch && signalPercent === null) {
                        const parsed = parseInt(signalMatch[1], 10);
                        signalPercent = isNaN(parsed) ? null : parsed;
                    }
                }
            }
            
            let quality = null;
            if (signalPercent !== null) {
                quality = signalPercent;
            } else if (rssiDbm !== null) {
                quality = dbmToQualityPercent(rssiDbm);
            }
            
            if (ssid || bssid || quality !== null) {
                return {
                    ssid: ssid || null,
                    bssid: bssid || null,
                    quality,
                    message: null
                };
            }
        } catch (airportError) {
            // Fallback to networksetup - only log if it's a real error (not just no permission)
            if (airportError.code !== 'ENOENT' && airportError.message && !airportError.message.includes('permission')) {
                log.warn('getWlanInfoMacOS: airport command failed:');
            }
        }
        
        // Fallback: networksetup and ipconfig (for newer macOS where airport is not available)  // system_profiler is way to heavy and needs a looooot of time to process
        // this is a simple calculation.. we can't rely on a process that takes 10s to complete and blocks the whole system
        try {
            // Determine WLAN interface using networksetup
            const { stdout: interfaceOutput } = await execAsync('networksetup -listallhardwareports | awk \'/Wi-Fi|AirPort/{getline; print $NF}\'', {
                timeout: 2000,
                maxBuffer: 1024 * 64
            });
            const interfaceName = interfaceOutput.trim();
            
            if (!interfaceName) {
                // No Wi-Fi interface found
                return { ssid: null, bssid: null, quality: null, message: 'nointerface' };
            }
            
            // Get SSID using ipconfig getsummary
            let ssid = null;
            try {
                const { stdout: ssidOutput } = await execAsync(`ipconfig getsummary "${interfaceName}" | awk -F' SSID : ' '/ SSID : / {print $2}'`, {
                    timeout: 2000,
                    maxBuffer: 1024 * 64
                });
                ssid = ssidOutput.trim() || null;
            } catch (ssidError) {
                // SSID extraction failed, continue with BSSID
            }
            
            // Get BSSID using ipconfig getsummary
            let bssid = null;
            try {
                const { stdout: bssidOutput } = await execAsync(`ipconfig getsummary "${interfaceName}" | grep 'BSSID :' | awk '{print $3}'`, {
                    timeout: 2000,
                    maxBuffer: 1024 * 64
                });
                const bssidStr = bssidOutput.trim();
                // Validate BSSID format (MAC address)
                if (bssidStr && /^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/i.test(bssidStr)) {
                    bssid = bssidStr.toUpperCase();
                }
            } catch (bssidError) {
                // BSSID extraction failed
            }
            
            // Quality set to null when using fallback (airport not available, can't get signal strength)
            return {
                ssid: ssid || null,
                bssid: bssid || null,
                quality: null,
                message: null
            };
        } catch (networksetupError) {
            // Log error if networksetup fails with a real error
            log.error('getWlanInfoMacOS: networksetup/ipconfig fallback failed:', networksetupError.message || networksetupError);
            // If fallback completely fails, return error object
            return { ssid: null, bssid: null, quality: null, message: 'error' };
        }
    } catch (error) {
        // Log unexpected errors during WLAN info retrieval
        log.error('getWlanInfoMacOS: Unexpected error:', error.message || error);
        return { ssid: null, bssid: null, quality: null, message: 'error' };
    }
    
    return { ssid: null, bssid: null, quality: null, message: 'nointerface' };
}

export default { getWlanInfo };


