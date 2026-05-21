# Provisions next-exam-kiosk standard user + Multi-App Assigned Access (Windows Kiosk).
# Runs elevated. Inputs: -AppPath <portable exe> [-KioskUser next-exam-kiosk]
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$AppPath,
    [string]$KioskUser = 'next-exam-kiosk',
    [string]$InstallDir = 'C:\NextExam'
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "[next-exam-kiosk] $msg" }

# 0) edition check: Multi-App Assigned Access (MDM_AssignedAccess CSP) is unsupported on Home/Core
$edition = (Get-WindowsEdition -Online).Edition
Write-Step "Windows edition: $edition"
if ($edition -notmatch 'Professional|Enterprise|Education|IoTEnterprise|Pro') {
    throw "Multi-App Assigned Access requires Windows Pro/Edu/Enterprise. Detected: $edition"
}

# 1) copy portable exe to public location accessible by separate kiosk user
if (-not (Test-Path $AppPath)) { throw "AppPath not found: $AppPath" }
if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir | Out-Null }
$TargetExe = Join-Path $InstallDir 'next-exam.exe'
Copy-Item -LiteralPath $AppPath -Destination $TargetExe -Force
Write-Step "copied app -> $TargetExe"

# grant Users group read+execute so the kiosk profile can launch it
$acl = Get-Acl $InstallDir
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    'BUILTIN\Users','ReadAndExecute,ListDirectory','ContainerInherit,ObjectInherit','None','Allow')
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
# ensure member of Users, remove from Administrators if accidentally there
Add-LocalGroupMember -Group 'Users' -Member $KioskUser -ErrorAction SilentlyContinue
Remove-LocalGroupMember -Group 'Administrators' -Member $KioskUser -ErrorAction SilentlyContinue

$sid = (New-Object System.Security.Principal.NTAccount($KioskUser)).Translate([System.Security.Principal.SecurityIdentifier]).Value

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
    $tempKey = 'HKU\NEXTEXAM_KIOSK_HIVE'
    & reg.exe load $tempKey $hivePath | Out-Null

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

    [gc]::Collect()
    Start-Sleep -Milliseconds 500
    & reg.exe unload $tempKey | Out-Null
    Write-Step "patched NTUSER.DAT (taskmgr/winkeys/sticky-keys hardening for $KioskUser)"
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

# 4) Multi-App Assigned Access (single app now; AllowedApps[] is the only place to extend later)
$AllowedApps = @(
    @{ Path = $TargetExe; AutoLaunch = $true }
    # @{ Path = 'C:\Program Files\Bentley\MicroStation\MicroStation.exe'; AutoLaunch = $false }
)

function New-AllowedAppXml($apps) {
    $sb = New-Object System.Text.StringBuilder
    foreach ($app in $apps) {
        $p = [System.Security.SecurityElement]::Escape($app.Path)
        if ($app.AutoLaunch) {
            [void]$sb.AppendLine("        <App DesktopAppPath=`"$p`" rs5:AutoLaunch=`"true`" rs5:AutoLaunchArguments=`"`" />")
        } else {
            [void]$sb.AppendLine("        <App DesktopAppPath=`"$p`" />")
        }
    }
    return $sb.ToString()
}

$appsXml = New-AllowedAppXml $AllowedApps

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

# Apply via MDM_AssignedAccess WMI bridge (CSP path used by Intune/SCM)
$namespace = 'root\cimv2\mdm\dmmap'
$class = 'MDM_AssignedAccess'
$obj = Get-CimInstance -Namespace $namespace -ClassName $class
# encode XML as the CSP expects (entities-escaped string in Configuration property)
$obj.Configuration = [System.Security.SecurityElement]::Escape($config)
Set-CimInstance -CimInstance $obj
Write-Step "applied MDM_AssignedAccess Multi-App configuration (single app: next-exam.exe)"

Write-Step "DONE. Reboot recommended. Logon screen will list '$KioskUser' (no password)."
