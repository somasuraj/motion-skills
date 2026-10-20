@echo off
rem Double-click to __VERB__ __PAGE__ from a remote Linux machine: everything runs there, the deck is shown here.
rem The machine and folder are asked the first time and saved in _present\remote.txt.
cd /d "%~dp0"
title __TITLE__ (remote)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_present\remote.ps1" -Page "__PAGE__"
if errorlevel 1 pause
