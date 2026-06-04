@echo off
REM Quick Deploy & Test Script for Smart Door Lock
REM Run this to deploy firmware and start dashboard

echo ================================================
echo   Smart Door Lock - Quick Deploy Script
echo ================================================
echo.

echo [1/3] Checking Arduino CLI...
where arduino-cli >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Arduino CLI not found. Upload firmware manually via Arduino IDE.
) else (
    echo     Arduino CLI found!
)
echo.

echo [2/3] Starting Dashboard...
echo     Location: dashboard/
cd dashboard
if not exist "node_modules" (
    echo     Installing dependencies...
    call npm install
)
echo     Starting dev server on http://localhost:3000
echo.
start cmd /k "npm run dev"
echo     Dashboard started in new window!
echo.

echo [3/3] Next Steps:
echo.
echo     FIRMWARE:
echo     1. Open Arduino IDE
echo     2. Load: firmware/SmartDoorLock_Simple/SmartDoorLock_Simple.ino
echo     3. Upload to ESP32
echo     4. Open Serial Monitor (115200 baud)
echo.
echo     DASHBOARD:
echo     1. Open http://localhost:3000 in browser
echo     2. Test responsive: F12 -> Toggle Device Toolbar
echo     3. Test breakpoints: 1200px, 800px, 480px
echo.
echo     TESTING:
echo     - Refer to TEST_FIRMWARE.sh for firmware testing
echo     - Refer to TEST_DASHBOARD.sh for responsive testing
echo.
echo ================================================
echo   Ready to test! Good luck! 🚀
echo ================================================
pause
