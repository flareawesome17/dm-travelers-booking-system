@echo off
setlocal
cd /d "%~dp0"
title D^&M Hotel - Stop
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\stop-windows.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
