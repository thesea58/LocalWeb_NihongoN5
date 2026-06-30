<<<<<<< ours
@echo off
cd /d "%~dp0"
start "" http://localhost:8000
python -m http.server 8000
=======
@echo off
cd /d "%~dp0"
start "" http://localhost:8000
python -m http.server 8000
>>>>>>> theirs
pause