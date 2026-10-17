@echo off
title TravelHub Pro - Laptop Testing Server
cd /d "%~dp0\.."

echo ========================================================
echo     Starting TravelHub Pro on Windows Laptop
echo     Connect your phone to the same Wi-Fi network!
echo ========================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    pause
    exit /b 1
)

echo Starting production server on http://localhost:3000 ...
call npm run start
pause
