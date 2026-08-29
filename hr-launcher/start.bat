@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js topilmadi. https://nodejs.org dan o'rnating.
  exit /b 1
)

powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://localhost:5198/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel%==0 exit /b 0

if not exist "node_modules\" (
  call npm install
)

start "SES HR Launcher" /MIN cmd /c "node server.js >> hr-launcher.log 2>&1"
exit /b 0
