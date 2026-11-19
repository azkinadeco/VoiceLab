@echo off
title ElevenVoice AI Lab - Desktop Launcher
echo ========================================================
echo        Starting ElevenVoice AI Lab Desktop App...
echo ========================================================

:: Check if Chrome or Edge is installed to run as standalone app
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
    exit
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000
    exit
)

:: Fallback to default browser
start http://localhost:3000
exit
