/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * VM detection for Linux, Windows, macOS (hypervisor, DMI, sandbox, etc.).
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import log from 'electron-log';

const VENDORS = /(oracle|virtualbox|vmware|kvm|qemu|xen|innotek|parallels|microsoft|hyper-v|bhyve|red hat|redhat|bochs|bhyve|openstack|cloud|amazon|google|azure)/i;

function warnAndReturn(reason) {
    log.warn(`vmDetection @ isVirtualMachine: Verdacht auf VM - ${reason}`);
    return true;
}

/**
 * Detects if the current environment is likely a virtual machine or sandbox.
 * @returns {boolean} true if VM/sandbox detected, false otherwise
 */
export function isVirtualMachine() {
    // ---------- Linux ----------
    if (process.platform === 'linux') {
        try {
            const cpuinfo = readFileSync('/proc/cpuinfo', 'utf8');
            if (/^flags.*\bhypervisor\b/m.test(cpuinfo)) return warnAndReturn('hypervisor flag in /proc/cpuinfo');
        } catch {}

        try {
            const files = [
                '/sys/class/dmi/id/sys_vendor',
                '/sys/class/dmi/id/product_name',
                '/sys/class/dmi/id/product_version',
                '/sys/class/dmi/id/board_vendor',
                '/sys/class/dmi/id/bios_vendor',
                '/sys/class/dmi/id/chassis_vendor'
            ];
            const dmi = files.map(p => { try { return readFileSync(p, 'utf8'); } catch { return ''; } }).join(' ');
            if (VENDORS.test(dmi)) return warnAndReturn('DMI-Vendor-Match');
        } catch {}

        try {
            execSync('systemd-detect-virt -q', { stdio: 'ignore' });
            return warnAndReturn('systemd-detect-virt meldet Virtualisierung');
        } catch {}

        try {
            const ps = execSync('ps aux | grep -i qemu', { encoding: 'utf8' });
            if (ps.includes('qemu') && !ps.includes('grep')) {
                return warnAndReturn('QEMU-Prozess läuft');
            }
        } catch {}
    }

    // ---------- Windows ----------
    if (process.platform === 'win32') {
        try {
            const ps =
                'powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem | ForEach-Object { $_.Manufacturer, $_.Model }) -join \' \'"';
            const basic = execSync(ps, { encoding: 'utf8' }).trim();
            if (VENDORS.test(basic)) return warnAndReturn('Windows Hersteller/Modell passt zu VM');
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
            if (VENDORS.test(robust)) return warnAndReturn('Windows Hersteller/BIOS-Infos passen zu VM');
        } catch {}

        try {
            const qemuProcesses = execSync('tasklist /FI "IMAGENAME eq qemu*"', { encoding: 'utf8' });
            if (qemuProcesses.includes('qemu')) return warnAndReturn('QEMU-Prozess unter Windows');
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

        // SandboxId and WDAGUtilityAccount exist only inside the sandbox; MAC_Address/ComputerName can be true on host when Sandbox/Hyper-V is enabled
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
            return warnAndReturn(`Windows Sandbox detected (${sandboxIndicators.join(', ')})`);
        }
    }

    // ---------- macOS ----------
    if (process.platform === 'darwin') {
        try {
            const hwModel = execSync('sysctl -n hw.model', { encoding: 'utf8' });
            if (/^virtual/i.test(hwModel) || VENDORS.test(hwModel)) return warnAndReturn('macOS Hardwaremodell deutet auf VM');
        } catch {}

        try {
            const sp = execSync('system_profiler SPHardwareDataType', { encoding: 'utf8' });
            if (VENDORS.test(sp)) return warnAndReturn('macOS system_profiler meldet VM-Vendor');
        } catch {}
    }

    return false;
}
