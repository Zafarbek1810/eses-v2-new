@echo off
cd /d "%~dp0.."
echo Hikvision relay ishga tushmoqda...
echo Kamera: %HIKVISION_HOST%
call npm run relay
pause
