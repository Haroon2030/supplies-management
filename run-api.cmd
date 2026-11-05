@echo off
rem Keeps the API running: restarts it 2 seconds after any crash.
cd /d "%~dp0backend"
if not exist dist\main.js call npm run build
:loop
echo [%date% %time%] starting API on port 4000
node dist\main
echo [%date% %time%] API stopped, restarting in 2s...
timeout /t 2 /nobreak >nul
goto loop
