@echo off
title TravelHub Pro - Password Reset
cd /d "%~dp0\.."

echo ========================================================
echo       TravelHub Pro - Reset User / Vault Password
echo ========================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    pause
    exit /b 1
)

node scripts/reset-password.mjs
pause
