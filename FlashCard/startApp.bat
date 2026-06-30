@echo off
cd /d "%~dp0"
setlocal

set "PORT=8000"
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if not errorlevel 1 set "PORT=8010"

set "URL=http://localhost:%PORT%/hiragana.html?v=%RANDOM%"
start "" "%URL%"

where py >nul 2>nul
if not errorlevel 1 (
    py -m http.server %PORT%
) else (
    python -m http.server %PORT%
)

pause
