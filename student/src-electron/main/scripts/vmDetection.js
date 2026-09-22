/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * VM detection for Linux, Windows, macOS (hypervisor, DMI, sandbox, etc.).
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import log from 'electron-log';

const VENDORS = /(oracle|virtualbox|vmware|kvm|qemu|xen|innotek|parallels|hyper-v|bhyve|red hat|redhat|bochs|bhyve|openstack|cloud|amazon|azure)/i;

/** @type {{ isVM: boolean, reasons: string[], vendor: string | null, hasRun: boolean }} */
let cachedFindings = { isVM: false, reasons: [], vendor: null, hasRun: false };

function extractVendor(text) {
    const m = text.match(VENDORS);
    return m ? m[1] : null;
}

function addFinding(reasons, reason, textForVendor = '') {
    reasons.push(reason);
    log.warn(`vmDetection @ isVirtualMachine: Verdacht auf VM - ${reason}`);
    const v = extractVendor(textForVendor || reason);
    if (v) return v;
    return null;
}

function runDetection() {
    const reasons = [];
    let vendor = null;

    // ---------- Linux ----------
    if (process.platform === 'linux') {
        try {
            const cpuinfo = readFileSync('/proc/cpuinfo', 'utf8');
            if (/^flags.*\bhypervisor\b/m.test(cpuinfo)) {
                vendor = addFinding(reasons, 'hypervisor flag in /proc/cpuinfo') ?? vendor;
            }
        } catch {}

        try {
            const virtType = execSync('systemd-detect-virt', { encoding: 'utf8' }).trim();
            if (virtType && virtType !== 'none') {
                vendor = addFinding(reasons, `VMM erkannt`, virtType) ?? vendor;
            }
        } catch {}
    }

    // ---------- Windows ----------
    if (process.platform === 'win32') {
        try {
            const ps =
                'powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem | ForEach-Object { $_.Manufacturer, $_.Model }) -join \' \'"';
            const basic = execSync(ps, { encoding: 'utf8' }).trim();
            if (VENDORS.test(basic)) {
                vendor = addFinding(reasons, 'Windows Hersteller/Modell passt zu VM', basic) ?? vendor;
            }
        } catch {}

        try {
            const psRobust =
                'powershell -NoProfile -Command "$o=@();' +
                'try{$cs=Get-CimInstance Win32_ComputerSystem;$o+=@($cs.Manufacturer,$cs.Model)}catch{};' +
                'try{$bb=Get-CimInstance Win32_BaseBoard;$o+=@($bb.Manufacturer,$bb.Product)}catch{};' +
                'try{$bios=Get-CimInstance Win32_BIOS;$o+=@($bios.SMBIOSBIOSVersion)}catch{};' +
                'try{$csp=Get-CimInstance Win32_ComputerSystemProduct;$o+=@($csp.Name)}catch{};' +
                'Write-Output (($o -join \' \').Trim())"';
            const robust = execSync(psRobust, { encoding: 'utf8' }).trim();
            if (VENDORS.test(robust)) {
                vendor = addFinding(reasons, 'Windows Hersteller/BIOS-Infos passen zu VM', robust) ?? vendor;
            }
        } catch {}

        try {
            const qemuProcesses = execSync('tasklist /FI "IMAGENAME eq qemu*"', { encoding: 'utf8' });
            if (qemuProcesses.includes('qemu')) {
                vendor = addFinding(reasons, 'QEMU-Prozess unter Windows', 'qemu') ?? vendor;
            }
        } catch {}

        const sandboxIndicators = [];

        try {
            const sandboxIdCheck = 'powershell -NoProfile -Command "try { $val = Get-ItemProperty -Path \'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\CI\\Config\' -Name \'SandboxId\' -ErrorAction SilentlyContinue; if ($val -and $val.SandboxId) { Write-Output $val.SandboxId } } catch {}"';
            const sandboxId = execSync(sandboxIdCheck, { encoding: 'utf8' }).trim();
            if (sandboxId && sandboxId.length > 0) {
                sandboxIndicators.push('SandboxId');
            }
        } catch {}

        try {
            const username = os.userInfo().username;
            if (username === 'WDAGUtilityAccount') {
                sandboxIndicators.push('WDAGUtilityAccount');
            }
        } catch {}

        const sandboxExclusiveIndicators = ['SandboxId', 'WDAGUtilityAccount'];
        const hasSandboxExclusive = sandboxIndicators.some(i => sandboxExclusiveIndicators.includes(i));

        try {
            const macCheck = 'powershell -NoProfile -Command "Get-NetAdapter | Where-Object {$_.Status -eq \'Up\'} | Select-Object -ExpandProperty MacAddress | ForEach-Object { if ($_ -match \'00-15-5d\') { Write-Output \'match\' } }"';
            const macResult = execSync(macCheck, { encoding: 'utf8' }).trim();
            if (macResult === 'match') {
                sandboxIndicators.push('MAC_Address');
            }
        } catch {}

        try {
            const computerName = execSync('powershell -NoProfile -Command "$env:COMPUTERNAME"', { encoding: 'utf8' }).trim();
            if (computerName && computerName.startsWith('DESKTOP-')) {
                sandboxIndicators.push('ComputerName');
            }
        } catch {}

        try {
            const diskCheck = 'powershell -NoProfile -Command "$disks = Get-CimInstance Win32_DiskDrive; foreach ($disk in $disks) { $model = $disk.Model; $serial = $disk.SerialNumber; if ($model -match \'Virtual Disk|WDAG|Sandbox|VHD\' -or $serial -match \'WDAG|Sandbox\') { Write-Output \'match\'; break } }"';
            const diskResult = execSync(diskCheck, { encoding: 'utf8' }).trim();
            if (diskResult === 'match') {
                sandboxIndicators.push('Disk');
            }
        } catch {}

        try {
            const volumeCheck = 'powershell -NoProfile -Command "$volumes = Get-CimInstance Win32_LogicalDisk; foreach ($vol in $volumes) { if ($vol.DriveType -eq 3) { $label = $vol.VolumeName; if ($label -and ($label -match \'WDAG|Sandbox|Windows Sandbox\')) { Write-Output \'match\'; break } } }"';
            const volumeResult = execSync(volumeCheck, { encoding: 'utf8' }).trim();
            if (volumeResult === 'match') {
                sandboxIndicators.push('Volume');
            }
        } catch {}

        if (sandboxIndicators.length >= 2 && hasSandboxExclusive) {
            const reason = `Windows Sandbox detected (${sandboxIndicators.join(', ')})`;
            addFinding(reasons, reason);
        }
    }

    // ---------- macOS ----------
    if (process.platform === 'darwin') {
        try {
            const hwModel = execSync('sysctl -n hw.model', { encoding: 'utf8' });
            if (/^virtual/i.test(hwModel) || VENDORS.test(hwModel)) {
                vendor = addFinding(reasons, 'macOS Hardwaremodell deutet auf VM', hwModel) ?? vendor;
            }
        } catch {}

        try {
            const sp = execSync('system_profiler SPHardwareDataType', { encoding: 'utf8' });
            if (VENDORS.test(sp)) {
                vendor = addFinding(reasons, 'macOS system_profiler meldet VM-Vendor', sp) ?? vendor;
            }
        } catch {}
    }

    cachedFindings = {
        isVM: reasons.length > 0,
        reasons: [...reasons],
        vendor: vendor || null,
        hasRun: true
    };
    return cachedFindings;
}

/**
 * Returns cached VM detection findings. Runs detection on first call.
 * @returns {{ isVM: boolean, reasons: string[], vendor: string | null }}
 */
export function getVMFindings() {
    if (!cachedFindings.hasRun) {
        runDetection();
    }
    const { hasRun, ...result } = cachedFindings;
    return result;
}

/**
 * Detects if the current environment is likely a virtual machine or sandbox.
 * Caches results for getVMFindings().
 * @returns {boolean} true if VM/sandbox detected, false otherwise
 */
export function isVirtualMachine() {
    return getVMFindings().isVM;
}
