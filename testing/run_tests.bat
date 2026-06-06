@echo off
REM Smart Door Lock - Testing Tool Launcher
REM Quick launcher untuk Windows

echo ===============================================
echo   Smart Door Lock - Motion Detection Testing
echo ===============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python tidak terinstall atau tidak ada di PATH!
    echo Silakan install Python dari: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo [OK] Python detected
echo.

REM Check if requirements are installed
echo Checking dependencies...
pip show pyserial >nul 2>&1
if errorlevel 1 (
    echo [!] Dependencies belum terinstall
    echo.
    echo Installing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Gagal install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
    echo.
)

REM Main menu
:menu
cls
echo ===============================================
echo   Smart Door Lock - Testing Tool Launcher
echo ===============================================
echo.
echo Pilih test yang mau dijalankan:
echo.
echo   1. Range Test (Jarak) - 30 menit
echo   2. Angle Test (Sudut) - 20 menit
echo   3. Object Discrimination - 15 menit
echo   4. General Logging
echo   5. Analyze Results
echo   6. Open Test Data Folder
echo   7. Open Quick Start Guide
echo   0. Exit
echo.
set /p choice="Pilihan (0-7): "

if "%choice%"=="0" exit /b 0
if "%choice%"=="1" goto range_test
if "%choice%"=="2" goto angle_test
if "%choice%"=="3" goto object_test
if "%choice%"=="4" goto general_test
if "%choice%"=="5" goto analyze
if "%choice%"=="6" goto open_folder
if "%choice%"=="7" goto open_guide

echo Invalid choice!
timeout /t 2 >nul
goto menu

:range_test
cls
echo ===============================================
echo   RANGE TEST (Jarak Deteksi)
echo ===============================================
echo.
set /p port="Enter COM port (default: COM3): "
if "%port%"=="" set port=COM3
echo.
echo Starting range test...
echo Duration: 30 minutes
echo Port: %port%
echo.
echo INSTRUKSI:
echo - Test di jarak: 0.5m, 1m, 1.5m, 2m, 3m, 4m, 5m, 6m, 7m, 8m
echo - Ulangi 3x per jarak
echo - Gerakan standar: tangan kanan, kiri, jalan, jongkok
echo.
pause
python data_logger.py range_test 30 %port%
echo.
pause
goto menu

:angle_test
cls
echo ===============================================
echo   ANGLE TEST (Sudut Deteksi)
echo ===============================================
echo.
set /p port="Enter COM port (default: COM3): "
if "%port%"=="" set port=COM3
echo.
echo Starting angle test...
echo Duration: 20 minutes
echo Port: %port%
echo.
echo INSTRUKSI:
echo - Gunakan jarak optimal dari range test
echo - Test sudut: -90, -60, -30, 0, +30, +60, +90 derajat
echo - Ulangi 3x per sudut
echo.
pause
python data_logger.py angle_test 20 %port%
echo.
pause
goto menu

:object_test
cls
echo ===============================================
echo   OBJECT DISCRIMINATION TEST
echo ===============================================
echo.
set /p port="Enter COM port (default: COM3): "
if "%port%"=="" set port=COM3
echo.
echo Starting object discrimination test...
echo Duration: 15 minutes
echo Port: %port%
echo.
echo INSTRUKSI:
echo - Test dengan: Human, Chair, Box, Bottle, Backpack
echo - Ulangi 5x per objek
echo - CATAT objek apa yang sedang di-test (manual)
echo.
pause
python data_logger.py object_discrimination 15 %port%
echo.
pause
goto menu

:general_test
cls
echo ===============================================
echo   GENERAL LOGGING
echo ===============================================
echo.
set /p port="Enter COM port (default: COM3): "
if "%port%"=="" set port=COM3
set /p duration="Duration in minutes (Enter for unlimited): "
echo.
if "%duration%"=="" (
    echo Starting unlimited logging...
    python data_logger.py general "" %port%
) else (
    echo Starting logging for %duration% minutes...
    python data_logger.py general %duration% %port%
)
echo.
pause
goto menu

:analyze
cls
echo ===============================================
echo   ANALYZE RESULTS
echo ===============================================
echo.
if not exist "test_data" (
    echo [ERROR] test_data folder not found!
    echo Belum ada data untuk dianalisis.
    echo.
    pause
    goto menu
)
echo Available test data files:
echo.
dir /b test_data\*.csv 2>nul
echo.
echo Running analyzer (interactive mode)...
echo.
python analyze_results.py
echo.
pause
goto menu

:open_folder
cls
if not exist "test_data" mkdir test_data
explorer test_data
goto menu

:open_guide
cls
if exist "QUICK_START.md" (
    start QUICK_START.md
) else (
    echo QUICK_START.md not found!
    pause
)
goto menu
