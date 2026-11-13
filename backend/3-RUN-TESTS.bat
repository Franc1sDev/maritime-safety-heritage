@echo off
rem Double-click to run the automated tests against a temporary database (your data is not touched).
cd /d "%~dp0"
if not exist logs mkdir logs
call npm test > logs\tests.log 2>&1
type logs\tests.log | findstr /C:"Tests:" /C:"PASS" /C:"FAIL"
echo Full output: logs\tests.log
pause
