@echo off
rem Waits for Z: to appear then creates a desktop shortcut. Runs once at logon.
:wait
if not exist "Z:\" (
    timeout /t 2 /nobreak >nul
    goto wait
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:PUBLIC+'\Desktop\NEXT-EXAM-STUDENT.lnk'); $s.TargetPath='Z:\'; $s.WorkingDirectory='Z:\'; $s.IconLocation='shell32.dll,3'; $s.Save()"
