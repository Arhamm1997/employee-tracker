@echo off
echo ============================================
echo   Employee Monitor Agent - Build Script
echo ============================================
echo.

echo Stopping running agent processes...
taskkill /F /IM EmployeeMonitor.exe >nul 2>&1
taskkill /F /IM EMWatchdog.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Cleaning previous temp build...
if exist "dist_new" rmdir /s /q "dist_new"
if exist "EmployeeMonitor.zip" del /f /q "EmployeeMonitor.zip"
echo.

echo Installing dependencies...
pip install -r requirements.txt -q
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)
echo.

echo Building EmployeeMonitor.exe...
python -m PyInstaller --noconfirm --onefile --windowed ^
    --distpath dist_new ^
    --icon=monitor.ico ^
    --name="EmployeeMonitor" ^
    --add-data "monitor.ico;." ^
    --hidden-import=win32timezone ^
    --hidden-import=win32api ^
    --hidden-import=win32con ^
    --hidden-import=win32com ^
    --hidden-import=win32com.client ^
    --hidden-import=pystray._win32 ^
    --hidden-import=watchdog.observers.winapi ^
    --hidden-import=watchdog.observers ^
    --hidden-import=pynput.keyboard._win32 ^
    --hidden-import=pynput.mouse._win32 ^
    --hidden-import=websockets ^
    --hidden-import=websockets.legacy ^
    --hidden-import=websockets.legacy.client ^
    --hidden-import=websockets.legacy.server ^
    --hidden-import=websockets.connection ^
    --hidden-import=aioice ^
    --hidden-import=aioice.stun ^
    --hidden-import=aiortc ^
    --hidden-import=aiortc.codecs ^
    --hidden-import=aiortc.codecs.h264 ^
    --hidden-import=aiortc.codecs.opus ^
    --hidden-import=aiortc.mediastreams ^
    --hidden-import=aiortc.sdp ^
    --hidden-import=aiortc.rtp ^
    --hidden-import=aiortc.rtcdtlstransport ^
    --hidden-import=aiortc.rtcicetransport ^
    --hidden-import=aiortc.rtcpeerconnection ^
    --hidden-import=numpy ^
    --hidden-import=numpy.core ^
    --collect-all aiortc ^
    --collect-all aioice ^
    --collect-all av ^
    agent.py
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build EmployeeMonitor.exe
    exit /b 1
)
echo.

echo Building EMWatchdog.exe...
python -m PyInstaller --noconfirm --onefile --windowed ^
    --distpath dist_new ^
    --name="EMWatchdog" ^
    --hidden-import=win32timezone ^
    --hidden-import=win32api ^
    --hidden-import=win32con ^
    watchdog.py
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build EMWatchdog.exe
    exit /b 1
)
echo.

echo Creating EmployeeMonitor.zip...
powershell -Command "Compress-Archive -Path 'dist_new\EmployeeMonitor.exe','dist_new\EMWatchdog.exe' -DestinationPath 'EmployeeMonitor.zip' -Force"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to create ZIP
    exit /b 1
)

echo Cleaning temp build folder...
rmdir /s /q "dist_new"

echo.
echo ============================================
echo   Build Complete!
echo   Upload this file to Master Admin:
echo   %CD%\EmployeeMonitor.zip
echo ============================================
