@echo off
cd /d "%~dp0"
echo Starting VAULT at http://127.0.0.1:5173
node scripts\server.mjs
pause
