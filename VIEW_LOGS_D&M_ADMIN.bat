@echo off
setlocal
cd /d "%~dp0"
title D^&M Hotel - Logs
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\logs-windows.ps1" -AppOnly -Tail 300
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
