@echo off
setlocal

set "TARGET=C:\ProgramData\NextExam"
set "RCLONE=%TARGET%\rclone.exe"
set "CONF=%TARGET%\rclone.conf"
set "LOG=%TARGET%\rclone.log"
set "MOUNT=%USERPROFILE%\Desktop\NEXT-EXAM-STUDENT"

:retry
if exist "%MOUNT%" rmdir /s /q "%MOUNT%"
"%RCLONE%" mount electron_host: "%MOUNT%" --config "%CONF%" --vfs-cache-mode full --links --no-check-certificate --log-file "%LOG%" --log-level INFO
timeout /t 5 /nobreak >nul
goto retry
