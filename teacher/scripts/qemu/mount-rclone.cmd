@echo off
setlocal

set "TARGET=C:\ProgramData\NextExam"
set "RCLONE=%TARGET%\rclone.exe"
set "CONF=%TARGET%\rclone.conf"
set "LOG=%TARGET%\rclone.log"

:retry
"%RCLONE%" mount electron_host: Z: --config "%CONF%" --vfs-cache-mode full --no-check-certificate --log-file "%LOG%" --log-level INFO
rem rclone mount blocks until it exits - if we get here it crashed, wait then retry
timeout /t 5 /nobreak >nul
goto retry
