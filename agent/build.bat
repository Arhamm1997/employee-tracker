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

:: install.bat ko bhi dist folder mein copy karo
echo Copying install.bat to dist\...
copy /y install.bat dist\install.bat >nul
echo.

echo ============================================
echo   Build Complete!
echo   Files in dist\ folder:
echo     - EmployeeMonitor.exe
echo     - EMWatchdog.exe
echo     - install.bat        <- employees ko yeh dena hai
echo ============================================
echo.
echo Employee ko sirf yeh 3 files deni hain:
echo   1. EmployeeMonitor.exe
echo   2. EMWatchdog.exe
echo   3. install.bat
echo.
echo install.bat double click kare -- UAC allow kare -- done!
pause
