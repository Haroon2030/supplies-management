@echo off
rem Starts the API and the web app in two minimized windows (each restarts itself if it crashes).
start "procurement-api" /min cmd /c "%~dp0run-api.cmd"
start "procurement-web" /min cmd /c "%~dp0run-web.cmd"
echo Started. Web: http://localhost:3000  API: http://localhost:4000/api
echo To stop: run stop-local.cmd
