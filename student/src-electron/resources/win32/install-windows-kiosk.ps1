# Provisions next-exam-kiosk standard user + Multi-App Assigned Access (Windows Kiosk).
# Runs elevated. Copies the FULL unpacked Electron app folder to C:\NextExam (not a single .exe).
#
# REQUIRED INPUT (pick one style):
#   -AppDir  = folder that contains resources\ + the launch .exe (recommended)
#   -LaunchExe = file name inside that folder only (e.g. Next-Exam-Student.exe)
#   OR shorthand -AppPath = full path to that launch .exe (parent folder is copied)
#
# STANDALONE USAGE EXAMPLES (elevated PowerShell):
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
    [string]$ExtraAppsFile = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "[next-exam-kiosk] $msg" }

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

# 0) edition check: Multi-App Assigned Access (MDM_AssignedAccess CSP) is unsupported on Home/Core
$edition = (Get-WindowsEdition -Online).Edition
Write-Step "Windows edition: $edition"
if ($edition -notmatch 'Professional|Enterprise|Education|IoTEnterprise|Pro') {
    # exit 10 = renderer maps to friendly edition-unsupported dialog
    Write-Host "ERROR_EDITION_UNSUPPORTED: $edition"
    exit 10
}

# 1) resolve app bundle (full unpack folder + launch exe name)
if ($AppPath -and -not $AppDir) {
    $AppDir = Split-Path -Parent $AppPath
    if (-not $LaunchExe) { $LaunchExe = Split-Path -Leaf $AppPath }
}
if (-not $AppDir -or -not $LaunchExe) {
    throw 'Provide -AppDir and -LaunchExe, or -AppPath pointing at the running Next-Exam-Student.exe inside the unpack folder.'
}
if (-not (Test-Path -LiteralPath $AppDir -PathType Container)) { throw "AppDir not found: $AppDir" }
$sourceLaunch = Join-Path $AppDir $LaunchExe
if (-not (Test-Path -LiteralPath $sourceLaunch -PathType Leaf)) { throw "Launch exe not found: $sourceLaunch" }
$hasResources = (Test-Path -LiteralPath (Join-Path $AppDir 'resources') -PathType Container)
if (-not $hasResources) {
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
    Set-ItemProperty -Path $lsaPath -Name 'LimitBlankPasswordUse' -Value 1 -Type DWord -Force
    Write-Step 'LSA LimitBlankPasswordUse=1 (blank password allowed for console logon)'
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

# 2b) per-user hardening via offline NTUSER.DAT hive load (closes sticky-keys backdoor before first logon)
$hivePath = Join-Path $ProfilePath 'NTUSER.DAT'
if (Test-Path $hivePath) {
    $hiveKey = 'HKU\NEXTEXAM_KIOSK_HIVE'
    $hiveLoaded = $false
    $loadOut = (& reg.exe load $hiveKey $hivePath 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        Write-Step "WARNING: skip NTUSER.DAT patch (profile locked? log off $KioskUser first): $loadOut"
    } else {
    $hiveLoaded = $true
    $polSystem   = "Registry::HKEY_USERS\NEXTEXAM_KIOSK_HIVE\Software\Microsoft\Windows\CurrentVersion\Policies\System"
    $polExplorer = "Registry::HKEY_USERS\NEXTEXAM_KIOSK_HIVE\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer"
    $polEdgeUI   = "Registry::HKEY_USERS\NEXTEXAM_KIOSK_HIVE\Software\Policies\Microsoft\Windows\EdgeUI"
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

    # Accessibility backdoors: 5x Shift / hold Shift / NumLock+Shift launch a SYSTEM cmd from logon screen
    $accSticky = "Registry::HKEY_USERS\NEXTEXAM_KIOSK_HIVE\Control Panel\Accessibility\StickyKeys"
    $accFilter = "Registry::HKEY_USERS\NEXTEXAM_KIOSK_HIVE\Control Panel\Accessibility\Keyboard Response"
    $accToggle = "Registry::HKEY_USERS\NEXTEXAM_KIOSK_HIVE\Control Panel\Accessibility\ToggleKeys"
    New-Item -Path $accSticky -Force | Out-Null
    New-Item -Path $accFilter -Force | Out-Null
    New-Item -Path $accToggle -Force | Out-Null
    Set-ItemProperty -Path $accSticky -Name 'Flags' -Value '506' -Type String
    Set-ItemProperty -Path $accFilter -Name 'Flags' -Value '122' -Type String
    Set-ItemProperty -Path $accToggle -Name 'Flags' -Value '58'  -Type String

    # Drop tablet/vendor first-logon junk (e.g. Wacom setup) from kiosk user Run/RunOnce
    foreach ($rel in @(
        'Software\Microsoft\Windows\CurrentVersion\Run',
        'Software\Microsoft\Windows\CurrentVersion\RunOnce'
    )) {
        $rk = "Registry::HKEY_USERS\NEXTEXAM_KIOSK_HIVE\$rel"
        if (-not (Test-Path -LiteralPath $rk)) { continue }
        $props = Get-ItemProperty -LiteralPath $rk -ErrorAction SilentlyContinue
        if (-not $props) { continue }
        foreach ($p in $props.PSObject.Properties) {
            if ($p.Name -match '^PS') { continue }
            $val = [string]$p.Value
            if ($p.Name -match 'Wacom|Tablet|PenTablet|PenAttention' -or $val -match 'Wacom|Tablet|PenTablet') {
                Remove-ItemProperty -LiteralPath $rk -Name $p.Name -Force -ErrorAction SilentlyContinue
                Write-Step "removed kiosk startup entry: $($p.Name)"
            }
        }
    }

    [gc]::Collect()
    Start-Sleep -Milliseconds 500
    if ($hiveLoaded) {
        $null = cmd.exe /c "reg unload $hiveKey 2>nul"
        Write-Step "patched NTUSER.DAT (taskmgr/winkeys/sticky-keys hardening for $KioskUser)"
    }
    }
} else {
    Write-Step "WARNING: NTUSER.DAT still missing - per-user hardening skipped"
}

# 2c) mandatory profile flag: State=128 makes Windows discard the profile on logout
$profileKey = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$sid"
if (-not (Test-Path $profileKey)) { New-Item -Path $profileKey -Force | Out-Null }
Set-ItemProperty -Path $profileKey -Name 'State' -Value 128 -Type DWord
Write-Step "marked $KioskUser profile State=128 (wipe-on-logout)"

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
        if ($existing.Path -eq $resolved) { return }
    }
    [void]$List.Add([pscustomobject]@{ Path = $resolved; AutoLaunch = [bool]$AutoLaunch })
    Write-Step ('  + kiosk allow' + $(if ($AutoLaunch) { ' (autolaunch)' }) + ": $resolved")
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

if ($ExtraAppsFile -and (Test-Path $ExtraAppsFile)) {
    Write-Step "reading extra apps from $ExtraAppsFile"
    $lines = Get-Content -LiteralPath $ExtraAppsFile -Encoding UTF8
    foreach ($raw in $lines) {
        $line = $raw.Trim()
        if (-not $line) { continue }
        if ($line.StartsWith('#')) { continue }
        if (-not (Test-Path -LiteralPath $line -PathType Leaf)) {
            # exit 11 = renderer maps to friendly "missing path" dialog with the offending path in the transcript
            Write-Host "ERROR_MISSING_APP_PATH: $line"
            exit 11
        }
        Add-KioskAllowedAppPath -List $AllowedApps -ExePath $line
    }
}

function New-AllowedAppXml($apps) {
    $sb = New-Object System.Text.StringBuilder
    foreach ($app in @($apps)) {
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

# Desktop .lnk launchers (AllAppsList still whitelists; java/javaw/disable-shortcuts are not shown).
$deskDir = Join-Path $ProfilePath 'Desktop'
New-Item -ItemType Directory -Path $deskDir -Force | Out-Null
$skipDesktop = @('java.exe', 'javaw.exe', 'disable-shortcuts.exe')
$launcherApps = [System.Collections.ArrayList]::new()
foreach ($app in $AllowedApps) {
    if ($skipDesktop -contains ([IO.Path]::GetFileName($app.Path)).ToLower()) { continue }
    $lnk = Join-Path $deskDir "$([IO.Path]::GetFileNameWithoutExtension($app.Path)).lnk"
    $w = New-Object -ComObject WScript.Shell
    $s = $w.CreateShortcut($lnk)
    $s.TargetPath = $app.Path
    $s.WorkingDirectory = [IO.Path]::GetDirectoryName($app.Path)
    $s.Save()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w)
    [void]$launcherApps.Add([pscustomobject]@{ name = [IO.Path]::GetFileNameWithoutExtension($app.Path); path = $app.Path })
    Write-Step "desktop launcher: $lnk"
}
# Next-Exam in-app launcher bar (student.vue) reads this; independent of Desktop .lnk above
($launcherApps | ConvertTo-Json -Compress) | Set-Content -LiteralPath (Join-Path $InstallDir 'kiosk-launcher-apps.json') -Encoding UTF8
Write-Step "kiosk-launcher-apps.json written ($($launcherApps.Count) apps)"

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

# marker: renderer treats provisioning as complete only after this file exists (partial runs keep install button visible)
Set-Content -LiteralPath (Join-Path $InstallDir '.kiosk-provision-complete') -Value (Get-Date -Format 'o') -Encoding UTF8
Write-Step "DONE. Reboot recommended. Logon screen will list '$KioskUser' (no password)."
