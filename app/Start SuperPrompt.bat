@echo off
rem SuperPrompt - double-click to start. Uses only Windows PowerShell (built in).
setlocal
cd /d "%~dp0"
title SuperPrompt
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\serve.ps1" -Root "%~dp0."
if errorlevel 1 (
  echo.
  echo The local server could not start. Opening the page directly from the folder instead...
  start "" "%~dp0index.html"
  echo.
  pause
)
endlocal
