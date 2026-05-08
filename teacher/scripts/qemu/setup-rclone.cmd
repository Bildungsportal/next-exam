@echo off
setlocal enabledelayedexpansion

set "TARGET=C:\ProgramData\NextExam"
set "LOG=C:\Windows\Temp\nextexam-setup.log"
set "DRIVE="

echo [%date% %time%] setup-rclone start >> "%LOG%"

for %%D in (D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    if exist "%%D:\rclone.exe" if exist "%%D:\setup-rclone.cmd" (
        set "DRIVE=%%D:"
        goto :found
    )
)

echo [%date% %time%] ERROR: CD drive not found >> "%LOG%"
exit /b 1

:found
echo [%date% %time%] found ISO at %DRIVE% >> "%LOG%"

mkdir "%TARGET%" >nul 2>&1
copy /y "%DRIVE%\rclone.exe" "%TARGET%\rclone.exe" >nul
copy /y "%DRIVE%\winfsp-*.msi" "%TARGET%\" >nul
copy /y "%DRIVE%\mount-rclone.cmd" "%TARGET%\mount-rclone.cmd" >nul

set "WINFSP_MSI="
for %%F in (%TARGET%\winfsp-*.msi) do set "WINFSP_MSI=%%~fF"
if "%WINFSP_MSI%"=="" (
    echo [%date% %time%] ERROR: WinFsp MSI not found after copy >> "%LOG%"
    exit /b 1
)

echo [%date% %time%] installing WinFsp: %WINFSP_MSI% >> "%LOG%"
msiexec /i "%WINFSP_MSI%" /quiet /norestart
echo [%date% %time%] msiexec exit=%errorlevel% >> "%LOG%"

echo [%date% %time%] writing rclone.conf >> "%LOG%"
> "%TARGET%\rclone.conf" (
    echo [electron_host]
    echo type = webdav
    echo url = http://10.0.2.2:1900/share
    echo vendor = other
)

echo [%date% %time%] registering autostart (HKLM Run) >> "%LOG%"
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "NextExamRcloneMount" /t REG_SZ /d "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command start-process -WindowStyle Hidden C:\ProgramData\NextExam\mount-rclone.cmd" /f >> "%LOG%" 2>&1

echo [%date% %time%] registering scheduled tasks >> "%LOG%"
schtasks /create /tn "NextExam-RcloneMount" /tr "cmd.exe /c %TARGET%\mount-rclone.cmd" /sc onlogon /ru admin /rp admin /rl HIGHEST /delay 0000:30 /f >> "%LOG%" 2>&1

echo [%date% %time%] starting mount task >> "%LOG%"
schtasks /run /tn "NextExam-RcloneMount" >> "%LOG%" 2>&1

echo [%date% %time%] setup-rclone done >> "%LOG%"
exit /b 0
