@echo off
cd /d "%~dp0"
if not exist "node_modules\" (
  echo Installeer eerst de afhankelijkheden met npm ci.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  call npm run build
  if errorlevel 1 exit /b 1
)
echo Open http://127.0.0.1:4173 in je browser.
call npm start
