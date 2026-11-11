# Provisions next-exam-kiosk standard user + Multi-App Assigned Access (Windows Kiosk).
# Runs elevated. Copies the FULL unpacked Electron app folder to C:\NextExam (not a single .exe).
#
# REQUIRED INPUT (pick one style):
#   -AppDir  = folder that contains resources\ + the launch .exe (recommended)
#   -LaunchExe = file name inside that folder only (e.g. Next-Exam-Student.exe)
#   OR shorthand -AppPath = full path to that launch .exe (parent folder is copied)
#
# STANDALONE USAGE EXAMPLES (elevated PowerShell):
#   .\install-windows-kiosk.ps1
#   .\install-windows-kiosk.ps1 -ExtraAppsFile "C:\Users\Lehrer\kiosk-allowed-apps.txt"
#   .\install-windows-kiosk.ps1 -FirewallRulesScript "C:\Users\Lehrer\EXAM-STUDENT\firewall-rules.ps1"
#   .\install-windows-kiosk.ps1 -AppDir "$env:TEMP\next-exam-student" -LaunchExe "Next-Exam-Student.exe"
#   .\install-windows-kiosk.ps1 -AppDir "C:\Program Files\Next-Exam-Student" -LaunchExe "Next-Exam-Student.exe"
#   .\install-windows-kiosk.ps1 -AppPath "$env:TEMP\next-exam-student\Next-Exam-Student.exe"
#   .\install-windows-kiosk.ps1 -AppDir "C:\path\to\unpacked-app" -LaunchExe "Next-Exam-Student.exe" -ExtraAppsFile "C:\path\to\meine-apps.txt"
#
# Where to find AppDir:
#   Portable (while app runs): %TEMP%\next-exam-student\  (quasar unpackDirName)
#   MSI install:               C:\Program Files\Next-Exam-Student\
#   NOT valid:                 Downloads\Next-Exam-Student_*.exe  (NSIS launcher only, no resources\)
#
# next-exam in-app setup passes -AppDir/-LaunchExe automatically from process.execPath.
# Headless (no -AppDir): auto-fallback %TEMP%\\next-exam-student, then C:\\Program Files\\Next-Exam-Student (MSI).
#
# OPTIONAL APP WHITELIST (-ExtraAppsFile):
#   Plaintext file, one absolute path per line. Each path = additional desktop app the
#   kiosk user may launch beside the main Next-Exam exe. Next-Exam itself is always allowed and
#   auto-launches; entries here do NOT auto-launch.
#
#   File location used by next-exam (passed in by the renderer):
#     %USERPROFILE%\EXAM-STUDENT\kiosk-allowed-apps.txt
#   When -ExtraAppsFile is omitted (e.g. running this script directly), the same path is
#   auto-detected via the owner of the running explorer.exe (interactive user, not the admin).
#   File is OPTIONAL. If absent, only the main Next-Exam exe is whitelisted.
#
#   Rules:
#     - one absolute path per line (spaces ok, no quotes)
#     - blank lines ignored
#     - lines starting with '#' are comments
#     - paths that do not exist abort setup with exit code 11 (renderer shows hint)
#
#   Example kiosk-allowed-apps.txt:
#     # extra apps for next-exam kiosk
#     C:\Program Files\Bentley\MicroStation\MicroStation.exe
#     C:\Windows\System32\calc.exe
#
# OPTIONAL FIREWALL HOOK (-FirewallRulesScript):
#   PowerShell script applied near end of provisioning (same elevated admin token as this script).
#   Default probe (same folder as kiosk-allowed-apps.txt):
#     %USERPROFILE%\EXAM-STUDENT\firewall-rules.ps1
#   Optional; non-zero exit logs WARNING only (kiosk provisioning still completes).
#
# EXIT CODES (consumed by windowsKioskSetup.js):
#     0   success
#     10  EDITION_UNSUPPORTED (Home/Core; needs Pro/Edu/Enterprise)
#     11  MISSING_APP_PATH (entry in ExtraAppsFile does not exist)
#     12  INVALID_APP_BUNDLE (AppDir is not an unpacked Electron tree)
#     13  MDM_APPLY_FAILED (Assigned Access CSP apply failed or timed out; see C:\NextExam\mdm-staging\*.log)
#     9999 unexpected exception (transcript in temp log)
[CmdletBinding()]
param(
    [string]$AppPath = '',
    [string]$AppDir = '',
    [string]$LaunchExe = '',
    [string]$KioskUser = 'next-exam-kiosk',
    [string]$InstallDir = 'C:\NextExam',
    # optional plaintext file with one absolute exe path per line; blank/# lines ignored
    [string]$ExtraAppsFile = '',
    # optional elevated hook script (e.g. EXAM-STUDENT\firewall-rules.ps1); full path
    [string]$FirewallRulesScript = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "[next-exam-kiosk] $msg" }

# NTUSER hive hardening (taskmgr/winkeys/sticky-keys) for offline profile hives.
function Add-NextExamKioskNtuserHardening([string]$HiveRoot) {
    $polSystem   = "$HiveRoot\Software\Microsoft\Windows\CurrentVersion\Policies\System"
    $polExplorer = "$HiveRoot\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer"
    $polEdgeUI   = "$HiveRoot\Software\Policies\Microsoft\Windows\EdgeUI"
    New-Item -Path $polSystem -Force | Out-Null
    New-Item -Path $polExplorer -Force | Out-Null
    New-Item -Path $polEdgeUI -Force | Out-Null
    Set-ItemProperty -Path $polSystem   -Name 'DisableTaskMgr'         -Value 1 -Type DWord
    Set-ItemProperty -Path $polSystem   -Name 'DisableLockWorkstation' -Value 1 -Type DWord
    Set-ItemProperty -Path $polSystem   -Name 'DisableChangePassword'  -Value 1 -Type DWord
    Set-ItemProperty -Path $polSystem   -Name 'HideFastUserSwitching'  -Value 1 -Type DWord
    Set-ItemProperty -Path $polExplorer -Name 'NoWinKeys'              -Value 1 -Type DWord
    Set-ItemProperty -Path $polExplorer -Name 'NoRun'                  -Value 1 -Type DWord
    Set-ItemProperty -Path $polExplorer -Name 'HideRecommendedSection' -Value 1 -Type DWord
    Set-ItemProperty -Path $polExplorer -Name 'NoStartMenuMorePrograms'  -Value 1 -Type DWord
    Set-ItemProperty -Path $polEdgeUI   -Name 'AllowEdgeSwipe'         -Value 0 -Type DWord
    Set-ItemProperty -Path $polEdgeUI   -Name 'DisableCharmsHint'      -Value 1 -Type DWord
    Set-ItemProperty -Path $polEdgeUI   -Name 'DisableTLcorner'        -Value 1 -Type DWord
    $accSticky = "$HiveRoot\Control Panel\Accessibility\StickyKeys"
    $accFilter = "$HiveRoot\Control Panel\Accessibility\Keyboard Response"
    $accToggle = "$HiveRoot\Control Panel\Accessibility\ToggleKeys"
    New-Item -Path $accSticky -Force | Out-Null
    New-Item -Path $accFilter -Force | Out-Null
    New-Item -Path $accToggle -Force | Out-Null
    Set-ItemProperty -Path $accSticky -Name 'Flags' -Value '506' -Type String
    Set-ItemProperty -Path $accFilter -Name 'Flags' -Value '122' -Type String
    Set-ItemProperty -Path $accToggle -Name 'Flags' -Value '58'  -Type String
    # 100% scaling: Win8DpiScaling=1 lets LogPixels drive all displays (0 = per-monitor, breaks offline hive fonts)
    $desktop = "$HiveRoot\Control Panel\Desktop"
    New-Item -Path $desktop -Force | Out-Null
    Set-ItemProperty -Path $desktop -Name 'LogPixels'      -Value 96         -Type DWord
    Set-ItemProperty -Path $desktop -Name 'Win8DpiScaling' -Value 1         -Type DWord
    Set-ItemProperty -Path $desktop -Name 'DpiScalingVer'  -Value 0x00001018 -Type DWord
    Remove-ItemProperty -Path $desktop -Name 'DesktopDPIOverride' -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $desktop -Name 'FontSmoothing'             -Value '2'    -Type String
    Set-ItemProperty -Path $desktop -Name 'FontSmoothingType'         -Value 2      -Type DWord
    Set-ItemProperty -Path $desktop -Name 'FontSmoothingGamma'          -Value 1500   -Type DWord
    Set-ItemProperty -Path $desktop -Name 'FontSmoothingOrientation'    -Value 1      -Type DWord
    Set-ItemProperty -Path $desktop -Name 'FontSmoothingContrast'       -Value 2200   -Type DWord
    foreach ($rel in @(
        'Software\Microsoft\Windows\CurrentVersion\Run',
        'Software\Microsoft\Windows\CurrentVersion\RunOnce'
    )) {
        $rk = "$HiveRoot\$rel"
        if (-not (Test-Path -LiteralPath $rk)) { continue }
        $props = Get-ItemProperty -LiteralPath $rk -ErrorAction SilentlyContinue
        if (-not $props) { continue }
        foreach ($p in $props.PSObject.Properties) {
            if ($p.Name -match '^PS') { continue }
            $val = [string]$p.Value
            if ($p.Name -match 'Wacom|Tablet|PenTablet|PenAttention' -or $val -match 'Wacom|Tablet|PenTablet') {
                Remove-ItemProperty -LiteralPath $rk -Name $p.Name -Force -ErrorAction SilentlyContinue
                Write-Step "removed Default User startup entry: $($p.Name)"
            }
        }
    }
}

# Redirect Desktop/Documents/Downloads/Pictures/Music/Videos to EXAM-STUDENT in offline NTUSER (Known Folders).
function Add-NextExamKioskKnownFolderRedirects([string]$HiveRoot, [string]$ExamStudentPath) {
    $userShell = "$HiveRoot\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
    $shellFolders = "$HiveRoot\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"
    New-Item -Path $userShell -Force | Out-Null
    New-Item -Path $shellFolders -Force | Out-Null
    $expandTarget = '%USERPROFILE%\EXAM-STUDENT'
    foreach ($g in @(
        '{B4BF4253-8F59-4A32-8558-EBCBAB75C11F}', # Desktop
        '{F42EE2D3-909F-4907-8871-4CB22F31667B}', # Documents
        '{374DE290-123F-4565-9164-39C4925E467B}', # Downloads
        '{33E28130-4E1E-4676-837A-9846C755B074}', # Pictures
        '{4BD8D571-6D19-48D9-A611-9729E11DEE96}', # Music
        '{18989B1D-99B5-455B-ABBC-AEA9D8B76B9B}'  # Videos
    )) {
        Set-ItemProperty -Path $userShell -Name $g -Value $expandTarget -Type ExpandString
    }
    foreach ($entry in @{
        'Desktop'     = $ExamStudentPath
        'Personal'    = $ExamStudentPath
        'Downloads'   = $ExamStudentPath
        'My Pictures' = $ExamStudentPath
        'My Music'    = $ExamStudentPath
        'My Video'    = $ExamStudentPath
    }.GetEnumerator()) {
        Set-ItemProperty -Path $shellFolders -Name $entry.Key -Value $entry.Value -Type String
    }
    Write-Step "known folders -> $ExamStudentPath (Desktop/Documents/Downloads/Pictures/Music/Videos)"
}

# Purge DirectWrite font caches after offline DPI/ClearType hive edits (stale 125% metrics).
function Clear-NextExamFontCaches([string]$KioskProfilePath) {
    $targets = @(
        (Join-Path $env:WINDIR 'ServiceProfiles\LocalService\AppData\Local\FontCache*')
    )
    if ($env:LOCALAPPDATA) {
        $targets += (Join-Path $env:LOCALAPPDATA 'FontCache*')
    }
    if ($KioskProfilePath) {
        $targets += (Join-Path $KioskProfilePath 'AppData\Local\FontCache*')
    }
    foreach ($t in $targets) {
        Remove-Item -LiteralPath $t -Force -Recurse -ErrorAction SilentlyContinue
    }
}

# Load an offline NTUSER.DAT, run hardening + known-folder redirects, unload.
function Invoke-OfflineNtuserHardening([string]$NtuserPath, [string]$HiveAlias, [string]$ExamStudentPath) {
    if (-not (Test-Path -LiteralPath $NtuserPath)) { return $false }
    $hiveKey = "HKU\$HiveAlias"
    $loadOut = (& reg.exe load $hiveKey $NtuserPath 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        Write-Step "WARNING: skip NTUSER hardening for $NtuserPath : $loadOut"
        return $false
    }
    try {
        $hiveRoot = "Registry::HKEY_USERS\$HiveAlias"
        Add-NextExamKioskNtuserHardening -HiveRoot $hiveRoot
        if ($ExamStudentPath) {
            Add-NextExamKioskKnownFolderRedirects -HiveRoot $hiveRoot -ExamStudentPath $ExamStudentPath
        }
        [gc]::Collect()
        Start-Sleep -Milliseconds 500
        Write-Step "patched NTUSER.DAT hardening: $NtuserPath"
        return $true
    } finally {
        $null = cmd.exe /c "reg unload $hiveKey 2>nul"
    }
}

# Run optional EXAM-STUDENT firewall-rules.ps1 hook (already elevated; failure is non-fatal).
function Invoke-NextExamKioskFirewallRulesScript([string]$ScriptPath) {
    if (-not $ScriptPath -or -not (Test-Path -LiteralPath $ScriptPath -PathType Leaf)) { return }
    Write-Step "running firewall rules script: $ScriptPath"
    try {
        & $ScriptPath
        if ($LASTEXITCODE -ne 0) {
            Write-Step "WARNING: firewall-rules.ps1 exited $LASTEXITCODE (kiosk provisioning still complete)"
        }
    } catch {
        Write-Step "WARNING: firewall-rules.ps1 failed: $($_.Exception.Message)"
    }
}

# Scheduled task: at boot, wipe leftover kiosk user files (profile shell+NTUSER kept).
# Primary wipe path is next-exam itself in will-quit (electron-main.js). This task is a backup
# for crash/kill cases. -AtStartup is rock-solid: no audit policy / event subscription needed,
# and at boot no one is logged in so files are never locked.
function Register-KioskUserHomeWipeAtStartup([string]$InstallDir, [string]$KioskUser, [string]$ProfilePath) {
    $taskName = 'NextExam-KioskWipeUserHome'
    $scriptPath = Join-Path $InstallDir 'kiosk-wipe-user-home.ps1'
    $content = @"
# Backup wipe: next-exam-kiosk home contents (NTUSER kept so profile shell survives).
param([string]`$ProfilePath = '$ProfilePath')
`$ErrorActionPreference = 'SilentlyContinue'
`$keep = @('NTUSER.DAT','ntuser.dat.LOG1','ntuser.dat.LOG2','ntuser.ini','desktop.ini','ntuser.pol')
if (-not (Test-Path -LiteralPath `$ProfilePath)) { exit 0 }
Get-ChildItem -LiteralPath `$ProfilePath -Force | ForEach-Object {
    if (`$keep -contains `$_.Name) { return }
    Remove-Item -LiteralPath `$_.FullName -Recurse -Force
}
"@
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($scriptPath, $content, $utf8NoBom)
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    $action = New-ScheduledTaskAction -Execute (Join-Path $env:windir 'System32\WindowsPowerShell\v1.0\powershell.exe') `
        -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
    Write-Step "startup wipe task $taskName -> backup cleanup of $ProfilePath (profile shell kept)"
}

# True when MemberName is already in the builtin group identified by well-known SID.
function Test-LocalGroupHasMember([string]$GroupSidString, [string]$MemberName) {
    $groupSid = New-Object System.Security.Principal.SecurityIdentifier($GroupSidString)
    $groupName = ($groupSid.Translate([System.Security.Principal.NTAccount]).Value).Split('\')[1]
    $want = "$env:COMPUTERNAME\$MemberName"
    $members = @(Get-LocalGroupMember -Group $groupName -ErrorAction SilentlyContinue)
    foreach ($m in $members) {
        if ($m.Name -eq $want -or $m.Name -eq $MemberName) { return $true }
    }
    return $false
}

# Win32 1378 / MemberExists = already in group; must be idempotent for re-runs.
function Add-LocalGroupMemberIdempotent([System.Security.Principal.SecurityIdentifier]$GroupSid, [string]$MemberName, [string]$GroupLabel) {
    if (Test-LocalGroupHasMember -GroupSidString $GroupSid.Value -MemberName $MemberName) {
        Write-Step "group: $MemberName already in $GroupLabel (ok)"
        return
    }
    try {
        Add-LocalGroupMember -SID $GroupSid -Member $MemberName -ErrorAction Stop
        Write-Step "group: $MemberName -> $GroupLabel (Add-LocalGroupMember -SID)"
    } catch [Microsoft.PowerShell.Commands.MemberExistsException] {
        Write-Step "group: $MemberName already in $GroupLabel (ok)"
    } catch {
        $errText = $_.Exception.Message
        if ($errText -match '1378|already a member|bereits') {
            Write-Step "group: $MemberName already in $GroupLabel (ok)"
            return
        }
        $groupName = $GroupLabel.Split('\')[1]
        $prevPref = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $null = & net.exe localgroup $groupName $MemberName /add 2>&1
        $exit = $LASTEXITCODE
        $ErrorActionPreference = $prevPref
        if ($exit -eq 0 -or $exit -eq 1378) {
            Write-Step "group: $MemberName -> $groupName (net localgroup, exit $exit)"
            return
        }
        throw "failed to add $MemberName to $groupName (exit $exit): $errText"
    }
}

# Add/remove group membership by well-known SID (never -Group with a SID string; use -SID).
function Set-LocalGroupMemberByWellKnownSid([string]$MemberName, [string]$GroupSidString, [switch]$Remove) {
    $groupSid = New-Object System.Security.Principal.SecurityIdentifier($GroupSidString)
    $groupLabel = $groupSid.Translate([System.Security.Principal.NTAccount]).Value
    if ($Remove) {
        if (-not (Test-LocalGroupHasMember -GroupSidString $GroupSidString -MemberName $MemberName)) { return }
        try {
            Remove-LocalGroupMember -SID $groupSid -Member $MemberName -ErrorAction Stop
        } catch {
            $groupName = $groupLabel.Split('\')[1]
            $null = & net.exe localgroup $groupName $MemberName /delete 2>&1
        }
        return
    }
    Add-LocalGroupMemberIdempotent -GroupSid $groupSid -MemberName $MemberName -GroupLabel $groupLabel
}

# New-LocalUser -NoPassword still leaves "change password at next logon"; normalize via net+WinNT flags.
function Set-LocalUserPasswordlessLogon([string]$UserName) {
    $null = cmd.exe /c ('net user "' + $UserName + '" /passwordreq:no /passwordchg:no')
    if ($LASTEXITCODE -ne 0) { throw "net user password flags failed (exit $LASTEXITCODE)" }
    $null = cmd.exe /c ('net user "' + $UserName + '" ""')
    if ($LASTEXITCODE -ne 0) { throw "net user clear password failed (exit $LASTEXITCODE)" }
    $adsPath = "WinNT://$env:COMPUTERNAME/$UserName,user"
    $locUser = [ADSI]$adsPath
    $locUser.PasswordExpired = 0
    $flags = [int]$locUser.UserFlags.Value
    $locUser.UserFlags.Value = ($flags -bor 0x20)
    $locUser.SetInfo()
    Set-LocalUser -Name $UserName -PasswordNeverExpires $true -ErrorAction SilentlyContinue
    $lu = Get-LocalUser -Name $UserName -ErrorAction Stop
    Write-Step "passwordless logon ok (PasswordRequired=$($lu.PasswordRequired))"
}

# Encode Assigned Access XML the way the MDM Bridge CSP expects (HtmlEncode per Microsoft docs).
function Get-MdmAssignedAccessEncodedConfig([string]$ConfigXml) {
    Add-Type -AssemblyName System.Web
    return [System.Web.HttpUtility]::HtmlEncode($ConfigXml)
}

# Resolve MDM_AssignedAccess instance (filter first, else first instance in namespace).
function Get-MdmAssignedAccessInstance() {
    $ns = 'root\cimv2\mdm\dmmap'
    $filter = "InstanceID='AssignedAccess' AND ParentID='./Vendor/MSFT/'"
    $obj = Get-CimInstance -Namespace $ns -ClassName MDM_AssignedAccess -Filter $filter -ErrorAction SilentlyContinue
    if (-not $obj) {
        $all = @(Get-CimInstance -Namespace $ns -ClassName MDM_AssignedAccess -ErrorAction SilentlyContinue)
        if ($all.Count -gt 0) { $obj = $all[0] }
    }
    if (-not $obj) { throw 'MDM_AssignedAccess instance not found (MDM Bridge / Assigned Access CSP unavailable)' }
    return $obj
}

# Staging under C:\NextExam so SYSTEM scheduled task can read/write (admin %TEMP% is not writable by SYSTEM).
function Initialize-MdmStagingDir([string]$InstallDir) {
    $staging = Join-Path $InstallDir 'mdm-staging'
    if (-not (Test-Path $staging)) { New-Item -ItemType Directory -Path $staging -Force | Out-Null }
    $systemSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
    $acl = Get-Acl $staging
    $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
        $systemSid,'Modify','ContainerInherit,ObjectInherit','None','Allow')))
    Set-Acl -Path $staging -AclObject $acl
    return $staging
}

# Apply MDM config as current elevated admin (this script already runs via UAC).
function Apply-MdmAssignedAccessAsAdmin([string]$ConfigXml) {
    $encoded = Get-MdmAssignedAccessEncodedConfig -ConfigXml $ConfigXml
    $obj = Get-MdmAssignedAccessInstance
    Set-CimInstance -InputObject $obj -Property @{ Configuration = $encoded } -ErrorAction Stop
}

# Fallback: MDM CSP is owned by SYSTEM; run helper task with files in InstallDir\mdm-staging.
function Apply-MdmAssignedAccessAsSystem([string]$ConfigXml, [string]$StagingDir) {
    $stamp = [guid]::NewGuid().ToString('N')
    $taskName = "NextExam-Kiosk-MDM-$stamp"
    $configPath = Join-Path $StagingDir "assigned-access-$stamp.xml"
    $helperPath = Join-Path $StagingDir "mdm-helper-$stamp.ps1"
    $resultPath = Join-Path $StagingDir "mdm-result-$stamp.txt"
    $logPath = Join-Path $StagingDir "mdm-helper-$stamp.log"
    foreach ($p in @($resultPath, $logPath)) { if (Test-Path $p) { Remove-Item -LiteralPath $p -Force } }
    Set-Content -LiteralPath $configPath -Value $ConfigXml -Encoding UTF8
    $helper = @'
param([string]$ConfigPath, [string]$ResultPath, [string]$LogPath)
$ErrorActionPreference = 'Stop'
function Log([string]$m) { Add-Content -LiteralPath $LogPath -Value $m -Encoding UTF8 }
try {
    Log 'mdm helper start'
    Add-Type -AssemblyName System.Web
    $encoded = [System.Web.HttpUtility]::HtmlEncode((Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8))
    $ns = 'root\cimv2\mdm\dmmap'
    $filter = "InstanceID='AssignedAccess' AND ParentID='./Vendor/MSFT/'"
    $obj = Get-CimInstance -Namespace $ns -ClassName MDM_AssignedAccess -Filter $filter -ErrorAction SilentlyContinue
    if (-not $obj) {
        $all = @(Get-CimInstance -Namespace $ns -ClassName MDM_AssignedAccess -ErrorAction SilentlyContinue)
        if ($all.Count -gt 0) { $obj = $all[0] }
    }
    if (-not $obj) { throw 'MDM_AssignedAccess instance not found' }
    Log 'mdm Set-CimInstance begin'
    Set-CimInstance -InputObject $obj -Property @{ Configuration = $encoded } -ErrorAction Stop
    Log 'mdm Set-CimInstance ok'
    Set-Content -LiteralPath $ResultPath -Value '0' -Encoding ASCII -NoNewline
} catch {
    Log ('mdm error: ' + $_.Exception.Message)
    Set-Content -LiteralPath $ResultPath -Value ("1`n" + $_.Exception.Message) -Encoding UTF8
    exit 1
}
'@
    Set-Content -LiteralPath $helperPath -Value $helper -Encoding UTF8
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
        $taskArgs = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -ConfigPath "{1}" -ResultPath "{2}" -LogPath "{3}"' -f $helperPath, $configPath, $resultPath, $logPath
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArgs
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
        Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Settings $settings -Force | Out-Null
        Start-ScheduledTask -TaskName $taskName
        $deadline = (Get-Date).AddSeconds(90)
        do {
            Start-Sleep -Milliseconds 400
            if (Test-Path -LiteralPath $resultPath) {
                $result = (Get-Content -LiteralPath $resultPath -Raw).Trim()
                if ($result -eq '0') { return }
                $detail = $result
                if (Test-Path -LiteralPath $logPath) { $detail += "`n" + (Get-Content -LiteralPath $logPath -Raw) }
                throw "SYSTEM MDM apply failed: $detail"
            }
        } while ((Get-Date) -lt $deadline)
        $tail = if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Raw } else { '(no helper log)' }
        throw "SYSTEM MDM apply timed out. Helper log:`n$tail"
    } finally {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    }
}

function Get-LatestMdmHelperLogTail([string]$StagingDir) {
    $files = @(Get-ChildItem -LiteralPath $StagingDir -Filter 'mdm-helper-*.log' -ErrorAction SilentlyContinue)
    if ($files.Count -eq 0) { return $null, $null }
    $latest = $files | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $lines = @(Get-Content -LiteralPath $latest.FullName -ErrorAction SilentlyContinue | Select-Object -Last 3)
    return $latest.FullName, ($lines -join '; ')
}

function Apply-MdmAssignedAccessConfiguration([string]$ConfigXml, [string]$InstallDir) {
    $staging = Initialize-MdmStagingDir -InstallDir $InstallDir
    try {
        Write-Step 'applying MDM Assigned Access (elevated admin)...'
        Apply-MdmAssignedAccessAsAdmin -ConfigXml $ConfigXml
        Write-Step 'MDM apply succeeded (admin token)'
        return 'admin'
    } catch {
        $adminErr = $_.Exception.Message
        Write-Step ('MDM via admin not available (' + $adminErr + '); using SYSTEM task (expected on some builds)')
    }
    Write-Step ('applying MDM Assigned Access via SYSTEM scheduled task (staging: ' + $staging + ')...')
    Apply-MdmAssignedAccessAsSystem -ConfigXml $ConfigXml -StagingDir $staging
    $logPath, $logTail = Get-LatestMdmHelperLogTail -StagingDir $staging
    if ($null -ne $logPath) {
        Write-Step ('MDM apply succeeded (SYSTEM task). Log: ' + $logPath + ': ' + $logTail)
    } else {
        Write-Step 'MDM apply succeeded (SYSTEM task)'
    }
    return 'system'
}

function Test-NextExamElectronBundleDir([string]$Dir) {
    if (-not $Dir -or -not (Test-Path -LiteralPath $Dir -PathType Container)) { return $false }
    return Test-Path -LiteralPath (Join-Path $Dir 'resources') -PathType Container
}

function Find-NextExamLaunchExeInDir([string]$Dir) {
    foreach ($name in @('Next-Exam-Student.exe', 'next-exam.exe')) {
        if (Test-Path -LiteralPath (Join-Path $Dir $name) -PathType Leaf) { return $name }
    }
    return $null
}

# Resolve copy source: explicit params first, then portable unpack, then MSI Program Files.
function Resolve-NextExamAppBundleSource([string]$AppDirIn, [string]$LaunchExeIn, [string]$AppPathIn) {
    $resolvedDir = $AppDirIn
    $resolvedExe = $LaunchExeIn
    if ($AppPathIn -and -not $resolvedDir) {
        $resolvedDir = Split-Path -Parent $AppPathIn
        if (-not $resolvedExe) { $resolvedExe = Split-Path -Leaf $AppPathIn }
    }
    $candidates = [System.Collections.ArrayList]::new()
    if ($resolvedDir) {
        [void]$candidates.Add(@{ Dir = $resolvedDir; Exe = $resolvedExe; Label = 'param' })
    }
    [void]$candidates.Add(@{ Dir = (Join-Path $env:TEMP 'next-exam-student'); Exe = 'Next-Exam-Student.exe'; Label = 'portable-temp' })
    [void]$candidates.Add(@{ Dir = 'C:\Program Files\Next-Exam-Student'; Exe = 'Next-Exam-Student.exe'; Label = 'msi-program-files' })
    foreach ($c in $candidates) {
        if (-not (Test-NextExamElectronBundleDir $c.Dir)) { continue }
        $exe = $c.Exe
        if (-not $exe -or -not (Test-Path -LiteralPath (Join-Path $c.Dir $exe) -PathType Leaf)) {
            $exe = Find-NextExamLaunchExeInDir $c.Dir
            if (-not $exe) { continue }
        }
        Write-Step "app bundle source ($($c.Label)): $($c.Dir) ($exe)"
        return @{ AppDir = $c.Dir; LaunchExe = $exe }
    }
    return $null
}

# 0) edition check: Multi-App Assigned Access (MDM_AssignedAccess CSP) is unsupported on Home/Core
$edition = (Get-WindowsEdition -Online).Edition
Write-Step "Windows edition: $edition"
if ($edition -notmatch 'Professional|Enterprise|Education|IoTEnterprise|Pro') {
    # exit 10 = renderer maps to friendly edition-unsupported dialog
    Write-Host "ERROR_EDITION_UNSUPPORTED: $edition"
    exit 10
}

# 1) resolve app bundle (full unpack folder + launch exe name)
$bundle = Resolve-NextExamAppBundleSource -AppDirIn $AppDir -LaunchExeIn $LaunchExe -AppPathIn $AppPath
if (-not $bundle) {
    Write-Host 'ERROR_INVALID_APP_BUNDLE: no Next-Exam bundle found (pass -AppDir/-LaunchExe, or install MSI / run portable once).'
    exit 12
}
$AppDir = $bundle.AppDir
$LaunchExe = $bundle.LaunchExe
$sourceLaunch = Join-Path $AppDir $LaunchExe
if (-not (Test-Path -LiteralPath $sourceLaunch -PathType Leaf)) { throw "Launch exe not found: $sourceLaunch" }
if (-not (Test-NextExamElectronBundleDir $AppDir)) {
    Write-Host 'ERROR_INVALID_APP_BUNDLE: AppDir must be the unpacked Next-Exam folder (contains resources\), not the portable launcher in Downloads.'
    exit 12
}

if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir | Out-Null }
# replace prior partial copy so whitelist paths stay valid
Get-ChildItem -LiteralPath $InstallDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $AppDir '*') -Destination $InstallDir -Recurse -Force
$TargetExe = Join-Path $InstallDir $LaunchExe
if (-not (Test-Path -LiteralPath $TargetExe)) { throw "Copy failed, launch exe missing: $TargetExe" }
$bundledJre = Join-Path $InstallDir 'resources\app.asar.unpacked\public\minimal-jre-11-win\bin\java.exe'
if (-not (Test-Path -LiteralPath $bundledJre)) {
    Write-Host 'ERROR_INVALID_APP_BUNDLE: missing bundled JRE at resources\app.asar.unpacked\public\minimal-jre-11-win\bin\java.exe'
    exit 12
}
Set-Content -LiteralPath (Join-Path $InstallDir '.kiosk-launch-exe.txt') -Value $LaunchExe -Encoding UTF8 -NoNewline
Write-Step "copied app bundle $AppDir -> $InstallDir (launch $LaunchExe)"

# grant Users group read+execute so the kiosk profile can launch it (SID: locale-independent; "Users"/"Benutzer" names fail on non-EN Windows)
$usersSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-545')
$acl = Get-Acl $InstallDir
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $usersSid,'ReadAndExecute,ListDirectory','ContainerInherit,ObjectInherit','None','Allow')
$acl.AddAccessRule($rule)
Set-Acl -Path $InstallDir -AclObject $acl

# 2) create kiosk local user (idempotent), no password, member of Users only
$existing = Get-LocalUser -Name $KioskUser -ErrorAction SilentlyContinue
if (-not $existing) {
    New-LocalUser -Name $KioskUser -NoPassword -AccountNeverExpires -UserMayNotChangePassword `
        -FullName 'Next Exam Kiosk' -Description 'Next-Exam temporary kiosk user' | Out-Null
    Write-Step "created local user $KioskUser"
} else {
    Write-Step "local user $KioskUser already exists"
}
$lsaPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa'
if ((Get-ItemProperty -Path $lsaPath -Name 'LimitBlankPasswordUse' -ErrorAction SilentlyContinue).LimitBlankPasswordUse -ne 1) {
    # LimitBlankPasswordUse=1 is the SECURE default: blank-password accounts may sign in at the
    # console only; network/RDP/SMB logons with blank password are blocked. Required so the kiosk
    # user can auto-logon locally without exposing the box over the network.
    Set-ItemProperty -Path $lsaPath -Name 'LimitBlankPasswordUse' -Value 1 -Type DWord -Force
    Write-Step 'LSA LimitBlankPasswordUse=1 (console logon only; blocks network blank-password logon)'
}
Set-LocalUserPasswordlessLogon -UserName $KioskUser
# Builtin Users group S-1-5-32-545 (DE: Benutzer); membership via Add-LocalGroupMember -SID
Set-LocalGroupMemberByWellKnownSid -MemberName $KioskUser -GroupSidString 'S-1-5-32-545'
Set-LocalGroupMemberByWellKnownSid -MemberName $KioskUser -GroupSidString 'S-1-5-32-544' -Remove

$sid = (New-Object System.Security.Principal.NTAccount("$env:COMPUTERNAME\$KioskUser")).Translate([System.Security.Principal.SecurityIdentifier]).Value

# 2a) materialize profile directory + NTUSER.DAT WITHOUT requiring an interactive logon (userenv!CreateProfile)
$ProfilePath = "C:\Users\$KioskUser"
if (-not (Test-Path (Join-Path $ProfilePath 'NTUSER.DAT'))) {
    Write-Step "creating user profile for $KioskUser via userenv!CreateProfile"
    $sig = @'
[DllImport("userenv.dll", CharSet=CharSet.Unicode, SetLastError=true)]
public static extern int CreateProfile(
    [MarshalAs(UnmanagedType.LPWStr)] string pszUserSid,
    [MarshalAs(UnmanagedType.LPWStr)] string pszUserName,
    [Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszProfilePath,
    uint cchProfilePath);
'@
    try {
        $pApi = Add-Type -MemberDefinition $sig -Name 'ProfileApi' -Namespace 'Win32' -PassThru -ErrorAction Stop
    } catch {
        $pApi = [Win32.ProfileApi] # already loaded in this session
    }
    $sb = New-Object System.Text.StringBuilder(260)
    [void]$pApi::CreateProfile($sid, $KioskUser, $sb, $sb.Capacity)
    Start-Sleep -Seconds 1
}

# 2b) Harden kiosk profile NTUSER (persistent profile — avoids temp-profile + "setting up" on every logon).
$examStudentPath = Join-Path $ProfilePath 'EXAM-STUDENT'
if (-not (Test-Path -LiteralPath $examStudentPath)) {
    New-Item -ItemType Directory -Path $examStudentPath -Force | Out-Null
}
$kioskNtuser = Join-Path $ProfilePath 'NTUSER.DAT'
Invoke-OfflineNtuserHardening -NtuserPath $kioskNtuser -HiveAlias 'NEXTEXAM_KIOSK_HIVE' -ExamStudentPath $examStudentPath | Out-Null
Clear-NextExamFontCaches -KioskProfilePath $ProfilePath
Write-Step 'cleared FontCache (LocalService, installer, kiosk profile)'

# 2c) Persistent profile + ProfileList entry. State=128 is REQUIRED for Multi-App AssignedAccess
# kiosk - without it Windows treats the account as a regular user (OOBE, normal desktop, no kiosk shell).
# User-file wiping happens via (a) next-exam will-quit fs.rmSync, (b) Register-KioskUserHomeWipeAtStartup backup task.
$profileKey = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$sid"
if (-not (Test-Path $profileKey)) { New-Item -Path $profileKey -Force | Out-Null }
Set-ItemProperty -Path $profileKey -Name 'ProfileImagePath' -Value $ProfilePath -Type ExpandString
Set-ItemProperty -Path $profileKey -Name 'State' -Value 128 -Type DWord
Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList' -ErrorAction SilentlyContinue |
    Where-Object { $_.PSChildName -like "$sid*" -and $_.PSChildName -ne $sid } |
    ForEach-Object { Remove-Item -LiteralPath $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue }
Write-Step "persistent profile $ProfilePath State=128 (required for AssignedAccess kiosk shell); user files wiped by next-exam (will-quit) + NextExam-KioskWipeUserHome backup"

# 3) Removable storage lockdown for this user (per-user policy under SID)
$rsRoot = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices\$sid"
if (-not (Test-Path $rsRoot)) { New-Item -Path $rsRoot -Force | Out-Null }
# Deny_All blocks read+write for all removable storage classes for this user
Set-ItemProperty -Path $rsRoot -Name 'Deny_All' -Value 1 -Type DWord
# also seed common class GUIDs explicitly (CD/DVD, floppy, removable disks, WPD, tape)
$classes = @(
    '{53f56308-b6bf-11d0-94f2-00a0c91efb8b}', # disks
    '{53f5630d-b6bf-11d0-94f2-00a0c91efb8b}', # cd/dvd
    '{53f56311-b6bf-11d0-94f2-00a0c91efb8b}', # floppy
    '{53f56312-b6bf-11d0-94f2-00a0c91efb8b}', # tape
    '{6AC27878-A6FA-4155-BA85-F98F491D4F33}', # wpd phones
    '{F33FDC04-D1AC-4E8E-9A30-19BBD4B108AE}'  # wpd
)
foreach ($g in $classes) {
    $k = Join-Path $rsRoot $g
    if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
    Set-ItemProperty -Path $k -Name 'Deny_Read'    -Value 1 -Type DWord
    Set-ItemProperty -Path $k -Name 'Deny_Write'   -Value 1 -Type DWord
    Set-ItemProperty -Path $k -Name 'Deny_Execute' -Value 1 -Type DWord
}
Write-Step "removable storage denied for $KioskUser"

# Child exes Next-Exam spawns must be on the Assigned Access allow list (else spawn fails with UNKNOWN in kiosk only).
function Add-KioskAllowedAppPath([System.Collections.ArrayList]$List, [string]$ExePath, [switch]$AutoLaunch) {
    if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) { return }
    $resolved = (Resolve-Path -LiteralPath $ExePath).Path
    foreach ($existing in $List) {
        if ($existing.Path -and $existing.Path -eq $resolved) { return }
    }
    [void]$List.Add([pscustomobject]@{ Path = $resolved; AppUserModelId = ''; AutoLaunch = [bool]$AutoLaunch })
    Write-Step ('  + kiosk allow' + $(if ($AutoLaunch) { ' (autolaunch)' }) + ": $resolved")
}

function Add-KioskAllowedAppUserModelId([System.Collections.ArrayList]$List, [string]$AppUserModelId) {
    if (-not $AppUserModelId) { return }
    foreach ($existing in $List) {
        if ($existing.AppUserModelId -eq $AppUserModelId) { return }
    }
    [void]$List.Add([pscustomobject]@{ Path = ''; AppUserModelId = $AppUserModelId; AutoLaunch = $false })
    Write-Step "  + kiosk allow (aumid): $AppUserModelId"
}

# Win11 System32\calc.exe is a stub; allow the real UWP Calculator for Assigned Access + launcher.
function Add-KioskCalculatorApps([System.Collections.ArrayList]$List) {
    $calcPkg = Get-ChildItem -Path (Join-Path $env:ProgramFiles 'WindowsApps') -Filter 'Calculator.exe' -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match 'Microsoft\.WindowsCalculator' } | Select-Object -First 1
    if ($calcPkg) {
        Add-KioskAllowedAppPath -List $List -ExePath $calcPkg.FullName
    } else {
        Write-Step 'WARNING: Windows Calculator package not found — calc may not launch in kiosk'
    }
    Add-KioskAllowedAppUserModelId -List $List -AppUserModelId 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App'
}

function Add-KioskAllowedAppFromLine([System.Collections.ArrayList]$List, [string]$Line) {
    if ([IO.Path]::GetFileName($Line).Equals('calc.exe', [StringComparison]::OrdinalIgnoreCase)) {
        Add-KioskCalculatorApps -List $List
        return
    }
    Add-KioskAllowedAppPath -List $List -ExePath $Line
}

# 4) Multi-App Assigned Access - next-exam first (AutoLaunch), then optional extras from ExtraAppsFile
$AllowedApps = [System.Collections.ArrayList]::new()
Add-KioskAllowedAppPath -List $AllowedApps -ExePath $TargetExe -AutoLaunch
$jreBin = Join-Path $InstallDir 'resources\app.asar.unpacked\public\minimal-jre-11-win\bin'
foreach ($jreName in @('java.exe', 'javaw.exe')) {
    Add-KioskAllowedAppPath -List $AllowedApps -ExePath (Join-Path $jreBin $jreName)
}
$disableShortcuts = Join-Path $InstallDir 'resources\app.asar.unpacked\public\disable-shortcuts.exe'
Add-KioskAllowedAppPath -List $AllowedApps -ExePath $disableShortcuts
Add-KioskAllowedAppPath -List $AllowedApps -ExePath (Join-Path $env:windir 'System32\netsh.exe')
Add-KioskAllowedAppPath -List $AllowedApps -ExePath (Join-Path $env:windir 'System32\WindowsPowerShell\v1.0\powershell.exe')
Add-KioskAllowedAppPath -List $AllowedApps -ExePath (Join-Path $env:windir 'System32\reg.exe')
Add-KioskAllowedAppPath -List $AllowedApps -ExePath (Join-Path $env:windir 'System32\whoami.exe')

# fallback: when -ExtraAppsFile not passed in, try the interactive user's EXAM-STUDENT folder.
# elevated $env:USERPROFILE points at the admin, not the teacher who launched next-exam, so we
# look up the owner of explorer.exe (= the active interactive user) and probe their profile path.
if (-not $ExtraAppsFile) {
    try {
        $explorer = Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" | Select-Object -First 1
        if ($explorer) {
            $ownerInfo = Invoke-CimMethod -InputObject $explorer -MethodName GetOwner
            if ($ownerInfo.ReturnValue -eq 0 -and $ownerInfo.User) {
                $candidate = Join-Path "C:\Users\$($ownerInfo.User)" 'EXAM-STUDENT\kiosk-allowed-apps.txt'
                if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                    $ExtraAppsFile = $candidate
                    Write-Step "auto-detected extra apps file: $ExtraAppsFile"
                }
            }
        }
    } catch {
        Write-Step "WARNING: could not auto-detect EXAM-STUDENT folder: $($_.Exception.Message)"
    }
}

if (-not $FirewallRulesScript) {
    $fwDir = if ($ExtraAppsFile) { Split-Path -Parent $ExtraAppsFile } else { $null }
    if (-not $fwDir) {
        try {
            $explorer = Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" | Select-Object -First 1
            if ($explorer) {
                $ownerInfo = Invoke-CimMethod -InputObject $explorer -MethodName GetOwner
                if ($ownerInfo.ReturnValue -eq 0 -and $ownerInfo.User) {
                    $fwDir = Join-Path "C:\Users\$($ownerInfo.User)" 'EXAM-STUDENT'
                }
            }
        } catch {
            Write-Step "WARNING: could not auto-detect firewall-rules.ps1: $($_.Exception.Message)"
        }
    }
    if ($fwDir) {
        $fwCandidate = Join-Path $fwDir 'firewall-rules.ps1'
        if (Test-Path -LiteralPath $fwCandidate -PathType Leaf) {
            $FirewallRulesScript = $fwCandidate
            Write-Step "auto-detected firewall rules script: $FirewallRulesScript"
        }
    }
}

if ($ExtraAppsFile -and (Test-Path $ExtraAppsFile)) {
    Write-Step "reading extra apps from $ExtraAppsFile"
    $lines = Get-Content -LiteralPath $ExtraAppsFile -Encoding UTF8
    foreach ($raw in $lines) {
        $line = $raw.Trim()
        if (-not $line) { continue }
        if ($line.StartsWith('#')) { continue }
        if ([IO.Path]::GetFileName($line).Equals('calc.exe', [StringComparison]::OrdinalIgnoreCase)) {
            Add-KioskCalculatorApps -List $AllowedApps
            continue
        }
        if (-not (Test-Path -LiteralPath $line -PathType Leaf)) {
            # exit 11 = renderer maps to friendly "missing path" dialog with the offending path in the transcript
            Write-Host "ERROR_MISSING_APP_PATH: $line"
            exit 11
        }
        Add-KioskAllowedAppFromLine -List $AllowedApps -Line $line
    }
}

function New-AllowedAppXml($apps) {
    $sb = New-Object System.Text.StringBuilder
    foreach ($app in @($apps)) {
        if ($app.AppUserModelId) {
            $id = [System.Security.SecurityElement]::Escape([string]$app.AppUserModelId)
            [void]$sb.AppendLine("        <App AppUserModelId=`"$id`" />")
            continue
        }
        if (-not $app.Path) { continue }
        $p = [System.Security.SecurityElement]::Escape([string]$app.Path)
        if ($app.AutoLaunch) {
            [void]$sb.AppendLine("        <App DesktopAppPath=`"$p`" rs5:AutoLaunch=`"true`" rs5:AutoLaunchArguments=`"`" />")
        } else {
            [void]$sb.AppendLine("        <App DesktopAppPath=`"$p`" />")
        }
    }
    return $sb.ToString()
}

$appsXml = New-AllowedAppXml $AllowedApps

# In-app launcher list for student.vue (no desktop .lnk — not shown under Assigned Access).
# netsh/powershell are AllowedApps for next-exam internals only, never as student-facing buttons.
$skipLauncherUi = @('java.exe', 'javaw.exe', 'disable-shortcuts.exe', 'netsh.exe', 'powershell.exe', 'reg.exe', 'whoami.exe')
# Must be a PS array for ConvertTo-Json — piping ArrayList yields invalid "{...},{...}" without "[" wrapper.
$launcherList = @(
    foreach ($app in $AllowedApps) {
        if ($skipLauncherUi -contains ([IO.Path]::GetFileName($app.Path)).ToLower()) { continue }
        if ($app.Path -eq $TargetExe) { continue }
        [pscustomobject]@{ name = [IO.Path]::GetFileNameWithoutExtension($app.Path); path = $app.Path }  # skips aumid-only rows (empty Path)
    }
)
$launcherJsonPath = Join-Path $InstallDir 'kiosk-launcher-apps.json'
$launcherJson = if (@($launcherList).Count -eq 0) {
    '{"apps":[]}'
} else {
    ConvertTo-Json -InputObject @{ apps = @($launcherList) } -Compress -Depth 5
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($launcherJsonPath, $launcherJson, $utf8NoBom)
Write-Step "kiosk-launcher-apps.json written ($(@($launcherList).Count) apps)"

# Multi-App Assigned Access XML (rs5 namespace = Win10 1809+; supported on Win10/11 Pro/Edu/Ent)
$config = @"
<?xml version="1.0" encoding="utf-8" ?>
<AssignedAccessConfiguration
    xmlns="http://schemas.microsoft.com/AssignedAccess/2017/config"
    xmlns:rs5="http://schemas.microsoft.com/AssignedAccess/201810/config">
  <Profiles>
    <Profile Id="{9A2A490F-10F6-4764-974A-43B19E722C23}">
      <AllAppsList>
        <AllowedApps>
$appsXml
        </AllowedApps>
      </AllAppsList>
      <rs5:FileExplorerNamespaceRestrictions>
        <rs5:AllowedNamespace Name="Downloads"/>
      </rs5:FileExplorerNamespaceRestrictions>
      <StartLayout>
        <![CDATA[<LayoutModificationTemplate xmlns:defaultlayout="http://schemas.microsoft.com/Start/2014/FullDefaultLayout" xmlns:start="http://schemas.microsoft.com/Start/2014/StartLayout" Version="1" xmlns="http://schemas.microsoft.com/Start/2014/LayoutModification">
  <LayoutOptions StartTileGroupCellWidth="6" />
  <DefaultLayoutOverride>
    <StartLayoutCollection>
      <defaultlayout:StartLayout GroupCellWidth="6" />
    </StartLayoutCollection>
  </DefaultLayoutOverride>
</LayoutModificationTemplate>
]]>
      </StartLayout>
      <Taskbar ShowTaskbar="false"/>
    </Profile>
  </Profiles>
  <Configs>
    <Config>
      <Account>$env:COMPUTERNAME\$KioskUser</Account>
      <DefaultProfile Id="{9A2A490F-10F6-4764-974A-43B19E722C23}"/>
    </Config>
  </Configs>
</AssignedAccessConfiguration>
"@

# Apply via MDM_AssignedAccess WMI bridge (CSP); admin first, SYSTEM+staging fallback
try {
    $mdmVia = Apply-MdmAssignedAccessConfiguration -ConfigXml $config -InstallDir $InstallDir
    Write-Step "Assigned Access policy written (via $mdmVia). Kiosk launch: $TargetExe"
} catch {
    Write-Host "ERROR_MDM_APPLY_FAILED: $($_.Exception.Message)"
    exit 13
}

try {
    Register-KioskUserHomeWipeAtStartup -InstallDir $InstallDir -KioskUser $KioskUser -ProfilePath $ProfilePath
} catch {
    Write-Step "WARNING: logoff wipe task not registered (kiosk login/AA still OK): $($_.Exception.Message)"
}

Invoke-NextExamKioskFirewallRulesScript -ScriptPath $FirewallRulesScript

# marker: renderer treats provisioning as complete only after this file exists (partial runs keep install button visible)
Set-Content -LiteralPath (Join-Path $InstallDir '.kiosk-provision-complete') -Value (Get-Date -Format 'o') -Encoding UTF8
Set-Content -LiteralPath (Join-Path $InstallDir '.kiosk-account-sid') -Value $sid -Encoding UTF8 -NoNewline
Write-Step "DONE. Reboot recommended. Logon screen will list '$KioskUser' (no password)."
