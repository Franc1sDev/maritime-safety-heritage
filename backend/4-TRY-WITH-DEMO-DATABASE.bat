@echo off
rem Double-click to try the website and API with a private temporary database (no PostgreSQL setup needed).
rem Data is kept in .demo-db between runs. Close this window to stop.
cd /d "%~dp0"
if not exist node_modules (echo Installing packages, this takes a few minutes... & call npm install --no-audit --no-fund || (echo npm install failed. & pause & exit /b 1))
echo Building...
call npm run build >nul 2>&1 || (echo Build failed. Run: npm run build & pause & exit /b 1)
start "" cmd /c "timeout /t 25 >nul & start http://localhost:4000/"
call npm run demo
pause
