@echo off
setlocal

net session >nul 2>&1
if not "%errorlevel%"=="0" (
    powershell.exe -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Tank Loy Daily Report Auto Print
echo.
set "APP_URL=https://credit-billing-supachai.vercel.app"
set "PRINTER_IP=192.168.0.218"
echo System URL: %APP_URL%
echo Epson IP: %PRINTER_IP%
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-tank-loy-auto-print.ps1" -AppUrl "%APP_URL%" -PrinterIp "%PRINTER_IP%"
set INSTALL_EXIT=%errorlevel%

echo.
if "%INSTALL_EXIT%"=="0" (
    echo Installation completed.
) else (
    echo Installation failed with exit code %INSTALL_EXIT%.
)
pause
exit /b %INSTALL_EXIT%
