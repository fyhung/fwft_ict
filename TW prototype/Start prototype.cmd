@echo off
cd /d "%~dp0"
start "TW prototype" powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Prototype.ps1"
