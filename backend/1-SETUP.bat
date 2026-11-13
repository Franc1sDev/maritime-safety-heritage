@echo off
rem Double-click once: installs packages, creates the database and .env, loads sample content.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-windows.ps1"
