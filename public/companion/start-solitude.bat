@echo off
rem Starts the Solitude companion. The first time, it asks you to log in.
cd /d "%~dp0"
title Solitude companion
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js isn't installed. Get the LTS version from https://nodejs.org then run this again.
  pause
  exit /b 1
)
node solitude-companion.mjs
pause
