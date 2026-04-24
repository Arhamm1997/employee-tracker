@echo off
echo ============================================
echo   Employee Monitor Agent - Build Script
echo ============================================
echo.

echo Installing dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

echo Building EmployeeMonitor.exe...
pyinstaller ^
    --onefile ^
    --windowed ^
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
    pause
    exit /b 1
)
echo.

echo Building EMWatchdog.exe...
pyinstaller ^
    --onefile ^
    --windowed ^
    --name="EMWatchdog" ^
    --hidden-import=win32timezone ^
    watchdog.py
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build EMWatchdog.exe
    pause
    exit /b 1
)
echo.

echo ============================================
echo   Build Complete!
echo   Files located in dist\ folder:
echo     - EmployeeMonitor.exe
echo     - EMWatchdog.exe
echo ============================================
pause