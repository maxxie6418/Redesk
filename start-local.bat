@echo off
setlocal

set "ROOT=%~dp0"
set "SCRIPT=%ROOT%start-local.ps1"

if not exist "%SCRIPT%" (
  echo Redesk start script not found:
  echo %SCRIPT%
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"

echo.
echo Press any key to close this launcher window.
pause >nul
