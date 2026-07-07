@echo off
setlocal

rem Always run from the repository root, even when opened from another folder.
cd /d "%~dp0"

set "PORT=8000"
set "URL=http://127.0.0.1:%PORT%/"

echo ========================================
echo   Nihongo Study - Local Web Server
echo ========================================
echo.
echo Root : %CD%
echo URL  : %URL%
echo.

rem Prefer the Windows Python launcher.
where py >nul 2>&1
if not errorlevel 1 (
    echo Starting server with Python launcher...
    start "Nihongo Local Server" cmd /k "cd /d ""%~dp0"" ^&^& py -3 -m http.server %PORT% --bind 127.0.0.1"
    goto :OPEN_BROWSER
)

rem Fall back to python.exe when the launcher is unavailable.
where python >nul 2>&1
if not errorlevel 1 (
    echo Starting server with python.exe...
    start "Nihongo Local Server" cmd /k "cd /d ""%~dp0"" ^&^& python -m http.server %PORT% --bind 127.0.0.1"
    goto :OPEN_BROWSER
)

rem Final fallback: use Wrangler when Node.js is installed.
where npx >nul 2>&1
if not errorlevel 1 (
    echo Python was not found. Starting with Wrangler...
    if not exist "node_modules\wrangler\bin\wrangler.js" (
        echo Installing project dependencies...
        call npm install
        if errorlevel 1 goto :INSTALL_ERROR
    )

    start "Nihongo Wrangler Server" cmd /k "cd /d ""%~dp0"" ^&^& npx wrangler dev --local --port %PORT%"
    goto :OPEN_BROWSER
)

echo ERROR: Python and Node.js were not found.
echo Install Python 3 or Node.js, then run this file again.
echo.
pause
exit /b 1

:OPEN_BROWSER
rem Give the local server a moment to start before opening the website.
timeout /t 2 /nobreak >nul
start "" "%URL%"
exit /b 0

:INSTALL_ERROR
echo.
echo ERROR: npm install failed.
echo Check the internet connection and Node.js installation.
echo.
pause
exit /b 1
