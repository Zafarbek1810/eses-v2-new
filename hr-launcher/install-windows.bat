@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo SES HR Launcher o'rnatilmoqda...
echo.

set "LAUNCHER_DIR=%~dp0"
set "START_BAT=%LAUNCHER_DIR%start.bat"

reg add "HKCU\Software\Classes\ses-hr" /ve /d "URL:SES HR Launcher" /f >nul
reg add "HKCU\Software\Classes\ses-hr" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\ses-hr\shell\open\command" /ve /d "\"%START_BAT%\" \"%%1\"" /f >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
powershell -NoProfile -Command "$W=New-Object -ComObject WScript.Shell; $S=$W.CreateShortcut('%STARTUP%\SES-HR-Launcher.lnk'); $S.TargetPath='%START_BAT%'; $S.WorkingDirectory='%LAUNCHER_DIR%'; $S.WindowStyle=7; $S.Description='SES HR avtomatik launcher'; $S.Save()"

call "%START_BAT%"

echo.
echo Tayyor!
echo - ses-hr:// protokoli ro'yxatdan o'tkazildi
echo - Kompyuter yoqilganda launcher avtomatik ishga tushadi
echo - Endi eses.uz da HR ni bosishingiz mumkin
echo.
pause
