@echo off
rem Stops both servers (ports 3000 and 4000) and their restart loops.
taskkill /f /fi "WINDOWTITLE eq procurement-api*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq procurement-web*" >nul 2>&1
for %%P in (3000 4000) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do taskkill /f /pid %%I >nul 2>&1
)
echo Stopped.
