@echo off
setlocal

set "TARGET=C:\ProgramData\NextExam"
set "RCLONE=%TARGET%\rclone.exe"
set "CONF=%TARGET%\rclone.conf"
set "LOG=%TARGET%\rclone.log"
set "MOUNT=C:\Users\admin\Desktop\NEXT-EXAM-STUDENT"

rem Exit if rclone is already running.
tasklist /FI "IMAGENAME eq rclone.exe" 2>nul | find /I "rclone.exe" >nul && exit /b 0

call :wait_for_guestfwd_webdav

:retry
if exist "%MOUNT%" rmdir /s /q "%MOUNT%"
"%RCLONE%" mount electron_host: "%MOUNT%" --config "%CONF%" --vfs-cache-mode full --links --no-check-certificate --log-file "%LOG%" --log-level INFO
timeout /t 15 /nobreak >nul
goto retry

:wait_for_guestfwd_webdav
rem Poll until slirp guestfwd accepts TCP (virtio stack/DHCP/NLA often not ready at first logon).
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $h='10.0.2.2'; $p=1900; $until=(Get-Date).AddSeconds(600); while ((Get-Date) -lt $until) { try { $c = New-Object System.Net.Sockets.TcpClient; $iar = $c.BeginConnect($h, $p, $null, $null); if ($iar.AsyncWaitHandle.WaitOne(3000, $false)) { $c.EndConnect($iar); $c.Close(); exit 0 } $c.Close() } catch {} ; Start-Sleep -Seconds 2 } exit 0 }"
exit /b 0
