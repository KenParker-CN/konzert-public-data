@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "CONVERTER=%SCRIPT_DIR%scripts\convert-xlsx-to-csv.mjs"
set "OUTPUT_DIR=%SCRIPT_DIR%..\data\catalogues"

if not exist "%SCRIPT_DIR%node_modules\xlsx" (
  echo Missing XLSX converter dependency.
  echo Run npm install in this folder first, then retry.
  exit /b 1
)

node "%CONVERTER%" --output-dir "%OUTPUT_DIR%" %*
if errorlevel 1 exit /b %errorlevel%

echo.
echo CSV files updated in "%OUTPUT_DIR%".
endlocal
