@echo off
cd /d "%~dp0"
py update_gallery.py
if errorlevel 1 pause
