@echo off
setlocal

cd /d "%~dp0"
set "PORT=8787"
set "URL=http://127.0.0.1:%PORT%/"
set "STATE_DIR=%LOCALAPPDATA%\Temp\nihongo-wrangler-state"

where npx >nul 2>nul
if errorlevel 1 (
  echo Node.js va npm chua san sang. Hay cai Node.js LTS, sau do chay lai file nay.
  pause
  exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do set "RUNNING_PID=%%P"
if defined RUNNING_PID (
  echo Ung dung dang chay tai %URL%
  start "" "%URL%"
  exit /b 0
)

if not exist "node_modules\wrangler" (
  echo Dang cai dat dependencies...
  call npm install
  if errorlevel 1 (
    echo Khong the cai dat dependencies.
    pause
    exit /b 1
  )
)

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"

echo Dang khoi dong ung dung local tai %URL%
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process '%URL%'"
call npx wrangler dev --port %PORT% --live-reload=false --persist-to "%STATE_DIR%"

pause
