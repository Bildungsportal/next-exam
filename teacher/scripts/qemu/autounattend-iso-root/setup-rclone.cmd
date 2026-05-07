@echo off
setlocal enabledelayedexpansion

set "TARGET=C:\ProgramData\NextExam"
set "DRIVE="

for %%D in (D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    if exist "%%D:\rclone.exe" if exist "%%D:\winfsp-*.msi" (
        set "DRIVE=%%D:"
        goto :found
    )
)

:found
if "%DRIVE%"=="" (
    echo setup-rclone: CD drive not found
    exit /b 1
)

mkdir "%TARGET%" >nul 2>&1
copy /y "%DRIVE%\rclone.exe" "%TARGET%\rclone.exe" >nul
copy /y "%DRIVE%\winfsp-*.msi" "%TARGET%\" >nul

set "WINFSP_MSI="
for %%F in ("%TARGET%\winfsp-*.msi") do set "WINFSP_MSI=%%~fF"
if "%WINFSP_MSI%"=="" (
    echo setup-rclone: WinFsp MSI not found after copy
    exit /b 1
)

echo Installing WinFsp...
msiexec /i "%WINFSP_MSI%" /quiet /norestart

echo Writing rclone.conf...
> "%TARGET%\rclone.conf" (
    echo [electron_host]
    echo type = webdav
    echo url = http://10.0.2.2:1900/share
    echo vendor = other
)

echo Creating mount script...
> "%TARGET%\mount-rclone.cmd" (
    echo @echo off
    echo setlocal
    echo set "LINK=%PUBLIC%\Desktop\NEXT-EXAM-STUDENT.lnk"
    echo :retry
    echo "%TARGET%\rclone.exe" mount electron_host: Z: --config "%TARGET%\rclone.conf" --vfs-cache-mode full --no-check-certificate --log-file "%TARGET%\rclone.log" --log-level INFO
    echo if exist "Z:\\" ^(
    echo   powershell -NoProfile -ExecutionPolicy Bypass -Command "$$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%PUBLIC%\\Desktop\\NEXT-EXAM-STUDENT.lnk'); $$s.TargetPath='Z:\\'; $$s.WorkingDirectory='Z:\\'; $$s.IconLocation='shell32.dll,3'; $$s.Save()" ^>nul 2^>^&1
    echo ^)
    echo timeout /t 2 /nobreak ^>nul
    echo goto retry
)

echo Registering scheduled task...
schtasks /create /tn "NextExam-RcloneMount" /tr "\"%TARGET%\mount-rclone.cmd\"" /sc onlogon /ru admin /rl HIGHEST /f

echo Starting mount once...
start "" /min "%TARGET%\mount-rclone.cmd"

exit /b 0

