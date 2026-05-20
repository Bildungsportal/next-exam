param([switch]$InstallOnly)

# Apply Windows "best performance" visuals (minimize/move/menu fades off); run after display is up.
function Apply-NxDisableAnimations {
    $desk = 'HKCU:\Control Panel\Desktop'
    New-Item -Path $desk -Force | Out-Null
    Set-ItemProperty -Path $desk -Name UserPreferencesMask -Value ([byte[]](0x90, 0x12, 0x03, 0x80, 0x10, 0x00, 0x00, 0x00)) -Type Binary
    Set-ItemProperty -Path $desk -Name MenuShowDelay -Value '0'
    Set-ItemProperty -Path $desk -Name DragFullWindows -Value '0'
    Set-ItemProperty -Path $desk -Name MinAnimate -Value '0'
    Set-ItemProperty -Path $desk -Name Wallpaper -Value '' -ErrorAction SilentlyContinue
    Set-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name MouseTrails -Value '0' -ErrorAction SilentlyContinue
    $colors = 'HKCU:\Control Panel\Colors'
    New-Item -Path $colors -Force | Out-Null
    Set-ItemProperty -Path $colors -Name Background -Value '58 110 165' -ErrorAction SilentlyContinue
    $vf = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects'
    New-Item -Path $vf -Force | Out-Null
    Set-ItemProperty -Path $vf -Name VisualFXSetting -Value 2 -Type DWord
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name EnableTransparency -Value 0 -Type DWord -ErrorAction SilentlyContinue
    $acc = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Accessibility'
    New-Item -Path $acc -Force | Out-Null
    Set-ItemProperty -Path $acc -Name AnimationEffects -Value 0 -Type DWord -Force
    $dwm = 'HKCU:\Software\Microsoft\Windows\DWM'
    New-Item -Path $dwm -Force | Out-Null
    Set-ItemProperty -Path $dwm -Name EnableAeroPeek -Value 0 -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $dwm -Name AnimationsEnabled -Value 0 -Type DWord -ErrorAction SilentlyContinue
    $adv = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
    foreach ($name in @('ListviewAlphaSelect', 'TaskbarAnimations', 'TaskbarMn')) {
        Set-ItemProperty -Path $adv -Name $name -Value 0 -Type DWord -ErrorAction SilentlyContinue
    }
    $spiLoaded = $false
    try {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)]
public struct ANIMATIONINFO {
    public uint cbSize;
    public int iMinAnimate;
}
public static class NxSpi {
    public const int SPIF_UPDATEINIFILE = 0x01;
    public const int SPIF_SENDCHANGE = 0x02;
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SystemParametersInfo(int action, int param, ref ANIMATIONINFO pvParam, int winIni);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SystemParametersInfo(int action, int param, int pvParam, int winIni);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, int msg, IntPtr wParam, string lParam, int flags, int timeout, out IntPtr result);
}
'@ -ErrorAction Stop
        $spiLoaded = $true
    } catch {
        $spiLoaded = [bool]([type]::GetType('NxSpi'))
    }
    if ($spiLoaded) {
        $flags = [NxSpi]::SPIF_UPDATEINIFILE -bor [NxSpi]::SPIF_SENDCHANGE
        $anim = New-Object ANIMATIONINFO
        $anim.cbSize = [uint32][Runtime.InteropServices.Marshal]::SizeOf([ANIMATIONINFO])
        $anim.iMinAnimate = 0
        [void][NxSpi]::SystemParametersInfo(0x0049, [int]$anim.cbSize, [ref]$anim, $flags)
        foreach ($spi in @(0x0025, 0x1003, 0x1005, 0x1007, 0x1009, 0x101B, 0x101D, 0x1025, 0x1027, 0x201F)) {
            [void][NxSpi]::SystemParametersInfo($spi, 0, 0, $flags)
        }
        $nullResult = [IntPtr]::Zero
        [void][NxSpi]::SendMessageTimeout([IntPtr]0xffff, 0x001A, [IntPtr]::Zero, 'Environment', 2, 5000, [ref]$nullResult)
        [void][NxSpi]::SendMessageTimeout([IntPtr]0xffff, 0x001A, [IntPtr]::Zero, 'VisualEffects', 2, 5000, [ref]$nullResult)
    }
}

# Register logon task; longer delay on golden-image install so viogpudo/EDID finish first.
function Register-NxPerfLogonTask {
    param([string]$LogonDelay = 'PT1M')
    $script = 'C:\ProgramData\NextExam\nx-disable-animations.ps1'
    if (-not (Test-Path -LiteralPath $script)) { return }
    $args = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $args
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $trigger.Delay = $LogonDelay
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName 'NextExamDisableAnimations' -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
}

$installPath = 'C:\ProgramData\NextExam\nx-disable-animations.ps1'
if ($MyInvocation.MyCommand.Path -and (Test-Path -LiteralPath $MyInvocation.MyCommand.Path)) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $installPath) -Force | Out-Null
    Copy-Item -LiteralPath $MyInvocation.MyCommand.Path -Destination $installPath -Force
}

if ($InstallOnly) {
    Register-NxPerfLogonTask -LogonDelay 'PT5M'
    exit 0
}

Apply-NxDisableAnimations
Register-NxPerfLogonTask -LogonDelay 'PT1M'
