@echo off
setlocal
cd /d "%~dp0"
title D^&M Hotel - Install
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\install-windows.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
