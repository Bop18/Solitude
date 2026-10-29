@echo off
rem Makes the Solitude companion start (minimised) whenever Windows starts.
rem Run start-solitude.bat once first, so you're logged in.
set "HERE=%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LAUNCHER=%STARTUP%\Solitude companion.bat"
echo @echo off> "%LAUNCHER%"
echo cd /d "%HERE%">> "%LAUNCHER%"
echo start "Solitude companion" /min node solitude-companion.mjs>> "%LAUNCHER%"
echo Done! The Solitude companion will now start with Windows.
echo To undo, delete "Solitude companion.bat" from:
echo %STARTUP%
pause
