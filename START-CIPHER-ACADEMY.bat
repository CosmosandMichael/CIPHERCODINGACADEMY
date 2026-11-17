@echo off
title CIPHER CODE ACADEMY
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo Created .env from .env.example.
  echo Please edit .env and set the administrator password and SESSION_SECRET.
  notepad .env
)
if not exist node_modules (
  echo Installing dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check your Node.js installation and internet connection.
    pause
    exit /b 1
  )
)
echo Starting CIPHER CODE ACADEMY...
start "" http://localhost:3000
npm start
pause
