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
copy /y "%DRIVE%\serve-rclone.cmd" "%TARGET%\serve-rclone.cmd" >nul
rem Elevated (task) and non-elevated (Run key) instances must both be able to write rclone.log here.
icacls "%TARGET%" /grant *S-1-5-32-545:(OI)(CI)M >> "%LOG%" 2>&1

echo [%date% %time%] allowing inbound webdav (host reaches guest via QEMU hostfwd) >> "%LOG%"
netsh advfirewall firewall add rule name="NextExam-WebDAV" dir=in action=allow protocol=TCP localport=1900 profile=any >> "%LOG%" 2>&1

echo [%date% %time%] registering autostart (HKLM Run) >> "%LOG%"
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "NextExamRcloneServe" /t REG_SZ /d "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command start-process -WindowStyle Hidden C:\ProgramData\NextExam\serve-rclone.cmd" /f >> "%LOG%" 2>&1

echo [%date% %time%] registering scheduled tasks >> "%LOG%"
schtasks /create /tn "NextExam-RcloneServe" /tr "cmd.exe /c %TARGET%\serve-rclone.cmd" /sc onlogon /ru admin /rp admin /rl HIGHEST /delay 0000:30 /f >> "%LOG%" 2>&1

echo [%date% %time%] starting serve task >> "%LOG%"
schtasks /run /tn "NextExam-RcloneServe" >> "%LOG%" 2>&1

echo [%date% %time%] setup-rclone done >> "%LOG%"
exit /b 0
