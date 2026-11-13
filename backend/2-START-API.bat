@echo off
rem Double-click to run the website and API on http://localhost:4000 (close this window to stop it).
cd /d "%~dp0"
if not exist .env (echo Run 1-SETUP.bat first. & pause & exit /b 1)
echo Building...
call npm run build >nul 2>&1 || (echo Build failed. Run: npm run build & pause & exit /b 1)
call npm run migrate
start "" http://localhost:4000/
call npm start
pause
