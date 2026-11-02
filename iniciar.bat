@echo off
cd /d "%~dp0"
where npm >nul 2>nul || (echo Necesitas instalar Node.js primero. & start https://nodejs.org & pause & exit /b)
if not exist node_modules (echo Instalando Orbit, solo la primera vez... & call npm install)
call npm start
