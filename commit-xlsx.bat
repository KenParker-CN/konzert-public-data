@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH.
  echo         Install Node.js 18 or newer, then run: npm install
  goto :done
)

if not exist "node_modules\xlsx" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    goto :done
  )
)

node scripts\commit-xlsx.mjs %*

:done
echo.
pause
