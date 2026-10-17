@echo off
setlocal enabledelayedexpansion
title Vesper Sanctuary - GitHub Release & Push Tool
color 0A

echo ====================================================================
echo      🚀 VESPER SANCTUARY - 1-CLICK GITHUB PUSH TOOL
echo      Author: Kartikeya Saini
echo ====================================================================
echo.

:: 1. Verify Git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Git is not installed or not in your system PATH!
    echo Please install Git from https://git-scm.com/downloads and try again.
    echo.
    pause
    exit /b 1
)

:: Change to project root directory
cd /d "%~dp0\.."

echo [1/5] Verifying Git repository status...
if not exist ".git" (
    echo [i] Initializing new Git repository...
    git init
    git branch -M main
) else (
    echo [✓] Git repository already initialized.
)

:: 2. Check or configure GitHub Remote URL
echo.
echo [2/5] Checking remote origin...
git remote get-url origin >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo Please enter your GitHub Repository URL.
    echo Example: https://github.com/YourUsername/vesper.git
    set /p REPO_URL="Enter GitHub Repo URL: "
    if "!REPO_URL!"=="" (
        color 0C
        echo [ERROR] No GitHub URL provided. Push aborted.
        pause
        exit /b 1
    )
    git remote add origin !REPO_URL!
    echo [✓] Added remote origin: !REPO_URL!
) else (
    for /f "delims=" %%u in ('git remote get-url origin') do set CURRENT_REMOTE=%%u
    echo [✓] Existing remote origin found: !CURRENT_REMOTE!
    echo.
    set /p CHANGE_REMOTE="Do you want to use this remote? (Y/N): "
    if /i "!CHANGE_REMOTE!"=="N" (
        set /p NEW_URL="Enter new GitHub Repo URL: "
        git remote set-url origin !NEW_URL!
        echo [✓] Updated remote origin: !NEW_URL!
    )
)

:: 3. Stage files (ignoring all test media, databases, and secrets)
echo.
echo [3/5] Staging files safely (excluding media, databases, and .env)...
git add .

echo.
echo [4/5] Creating release commit...
git commit -m "feat: Vesper Sanctuary v1.0.0 - Self-Hosted Travel Media Hub by Kartikeya Saini"

:: 4. Push to GitHub main branch
echo.
echo [5/5] Pushing to GitHub (main branch)...
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ====================================================================
    echo   🎉 SUCCESS! Vesper Sanctuary is now published to GitHub!
    echo   Crafted by Kartikeya Saini
    echo ====================================================================
) else (
    echo.
    echo [!] If authentication is required, make sure you are logged into GitHub
    echo     or have configured a Personal Access Token / SSH key.
)

echo.
pause
