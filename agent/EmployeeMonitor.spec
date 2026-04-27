# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('monitor.ico', '.')]
binaries = []
hiddenimports = ['win32timezone', 'win32api', 'win32con', 'win32com', 'win32com.client', 'pystray._win32', 'watchdog.observers.winapi', 'watchdog.observers', 'pynput.keyboard._win32', 'pynput.mouse._win32', 'websockets', 'websockets.legacy', 'websockets.legacy.client', 'websockets.legacy.server', 'websockets.connection', 'aioice', 'aioice.stun', 'aiortc', 'aiortc.codecs', 'aiortc.codecs.h264', 'aiortc.codecs.opus', 'aiortc.mediastreams', 'aiortc.sdp', 'aiortc.rtp', 'aiortc.rtcdtlstransport', 'aiortc.rtcicetransport', 'aiortc.rtcpeerconnection', 'numpy', 'numpy.core']
tmp_ret = collect_all('aiortc')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('aioice')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('av')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['agent.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
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
