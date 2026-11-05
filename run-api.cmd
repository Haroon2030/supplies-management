@echo off
rem Keeps the API running, but with a brake: waits 10s between restarts and gives up after 5
rem consecutive restarts. An endless fast loop burns the database's connections-per-hour quota.
cd /d "%~dp0backend"
if not exist dist\main.js call npm run build
set TRIES=0
:loop
echo [%date% %time%] starting API on port 4000
node dist\main
set /a TRIES+=1
if %TRIES% GEQ 5 (
  echo [%date% %time%] API stopped %TRIES% times in a row - giving up. Fix the cause, then run start-local.cmd again.
  exit /b 1
)
echo [%date% %time%] API stopped, restarting in 10s... (%TRIES%/5)
timeout /t 10 /nobreak >nul
goto loop
