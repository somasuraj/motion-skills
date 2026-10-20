@echo off
rem Double-click to __VERB__ __PAGE__ in its own window. Close that window to stop.
cd /d "%~dp0"
title __TITLE__
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_present\serve.ps1" -Page "__PAGE__"
if errorlevel 1 pause
