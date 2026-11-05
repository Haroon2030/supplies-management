@echo off
rem Keeps the web app running: restarts it 2 seconds after any crash.
cd /d "%~dp0frontend"
:loop
echo [%date% %time%] starting web on port 3000
call npx next dev -p 3000
echo [%date% %time%] web stopped, restarting in 2s...
timeout /t 2 /nobreak >nul
goto loop
