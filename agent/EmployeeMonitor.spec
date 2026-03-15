# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['agent.py'],
    pathex=[],
    binaries=[],
    datas=[('monitor.ico', '.')],
    hiddenimports=['win32timezone', 'win32api', 'win32con', 'win32com', 'win32com.client', 'pystray._win32', 'watchdog.observers.winapi', 'watchdog.observers', 'pynput.keyboard._win32', 'pynput.mouse._win32'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='EmployeeMonitor',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['monitor.ico'],
)
