@echo off
setlocal
cd /d "%~dp0"
title D^&M Hotel - Start
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\start-windows.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
