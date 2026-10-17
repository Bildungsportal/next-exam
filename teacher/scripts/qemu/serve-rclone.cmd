@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "TARGET=C:\ProgramData\NextExam"
set "RCLONE=%TARGET%\rclone.exe"
set "LOG=%TARGET%\rclone.log"
set "SHARE=C:\Users\admin\Desktop\NEXT-EXAM-STUDENT"
set "SETUPLOG=C:\Windows\Temp\nextexam-setup.log"
echo [%date% %time%] serve-rclone start >> "%SETUPLOG%"

rem Run key + scheduled task both start this script (safety net). Only one rclone can bind :1900;
rem the other keeps retrying and takes over if the serving one dies.
:retry
call :read_session_pass
if errorlevel 1 (
    timeout /t 5 /nobreak >nul
    goto retry
)
if not exist "%SHARE%" mkdir "%SHARE%"
echo [%date% %time%] starting rclone serve webdav >> "%SETUPLOG%"
"%RCLONE%" serve webdav "%SHARE%" --addr :1900 --user nxe --pass !WEBDAV_PASS! --dir-cache-time 1s --log-file "%LOG%" --log-level INFO
timeout /t 15 /nobreak >nul
goto retry

:read_session_pass
rem Host passes the per-session WebDAV password as SMBIOS serial NXEWD-<hex> (guest reads it uppercased).
set "SERIAL="
for /f "delims=" %%S in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(Get-CimInstance Win32_ComputerSystemProduct).IdentifyingNumber; [Console]::Write($s)"') do set "SERIAL=%%S"
echo [%date% %time%] serial_prefix=[!SERIAL:~0,6!] >> "%SETUPLOG%"
if /I not "!SERIAL:~0,6!"=="NXEWD-" echo [%date% %time%] ABORT: bad serial prefix >> "%SETUPLOG%" & exit /b 1
set "WEBDAV_PASS=!SERIAL:~6!"
exit /b 0
