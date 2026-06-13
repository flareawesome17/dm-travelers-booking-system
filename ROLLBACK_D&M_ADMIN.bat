@echo off
setlocal
cd /d "%~dp0"
title D^&M Hotel - Rollback
set /p "ROLLBACK_COMMIT=Enter the Git commit hash to deploy: "
if "%ROLLBACK_COMMIT%"=="" (
  echo No commit hash entered. Rollback cancelled.
  pause
  exit /b 1
)
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\rollback-windows.ps1" -Commit "%ROLLBACK_COMMIT%"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
