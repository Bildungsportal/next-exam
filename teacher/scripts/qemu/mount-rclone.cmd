@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "TARGET=C:\ProgramData\NextExam"
set "RCLONE=%TARGET%\rclone.exe"
set "CONF=%TARGET%\rclone-session.conf"
set "LOG=%TARGET%\rclone.log"
set "MOUNT=C:\Users\admin\Desktop\NEXT-EXAM-STUDENT"
set "SETUPLOG=C:\Windows\Temp\nextexam-setup.log"
echo [%date% %time%] mount-rclone start >> "%SETUPLOG%"

rem Exit if rclone is already running.
tasklist /FI "IMAGENAME eq rclone.exe" 2>nul | find /I "rclone.exe" >nul && (echo [%date% %time%] EXIT: rclone already running >> "%SETUPLOG%" & exit /b 0)

:retry
call :write_session_config
if errorlevel 1 (
    timeout /t 5 /nobreak >nul
    goto retry
)
echo [%date% %time%] waiting for host webdav tcp >> "%SETUPLOG%"
call :wait_for_guestfwd_webdav
echo [%date% %time%] starting rclone mount >> "%SETUPLOG%"
if exist "%MOUNT%" rmdir /s /q "%MOUNT%"
"%RCLONE%" mount electron_host: "%MOUNT%" --config "%CONF%" --vfs-cache-mode full --links --no-check-certificate --log-file "%LOG%" --log-level INFO
timeout /t 15 /nobreak >nul
goto retry

:write_session_config
set "SERIAL="
set "WEBDAV_PASS_OBSCURED="
for /f "delims=" %%S in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(Get-CimInstance Win32_ComputerSystemProduct).IdentifyingNumber; [Console]::Write($s)"') do set "SERIAL=%%S"
echo [%date% %time%] serial_prefix=[!SERIAL:~0,6!] >> "%SETUPLOG%"
if /I not "!SERIAL:~0,6!"=="NXEWD-" echo [%date% %time%] ABORT: bad serial prefix >> "%SETUPLOG%" & exit /b 1
set "WEBDAV_PASS=!SERIAL:~6!"
for /f "delims=" %%P in ('%RCLONE% obscure !WEBDAV_PASS!') do set "WEBDAV_PASS_OBSCURED=%%P"
if not defined WEBDAV_PASS_OBSCURED echo [%date% %time%] ABORT: obscure produced nothing >> "%SETUPLOG%" & exit /b 1
echo [%date% %time%] session config ok >> "%SETUPLOG%"
> "%CONF%" (
    echo [electron_host]
    echo type = webdav
    echo url = http://10.0.2.2:1900/share
    echo vendor = other
    echo user = nxe
    echo pass = !WEBDAV_PASS_OBSCURED!
)
exit /b 0

:wait_for_guestfwd_webdav
rem Poll until slirp guestfwd accepts TCP (virtio stack/DHCP/NLA often not ready at first logon).
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $h='10.0.2.2'; $p=1900; $until=(Get-Date).AddSeconds(600); while ((Get-Date) -lt $until) { try { $c = New-Object System.Net.Sockets.TcpClient; $iar = $c.BeginConnect($h, $p, $null, $null); if ($iar.AsyncWaitHandle.WaitOne(3000, $false)) { $c.EndConnect($iar); $c.Close(); exit 0 } $c.Close() } catch {} ; Start-Sleep -Seconds 2 } exit 0 }"
exit /b 0
