import sys
import os
from logger import log

try:
    import winreg
except ImportError:
    winreg = None
    log.warning("winreg not available - startup registration disabled")

REG_KEY = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
APP_NAME = "EmployeeMonitor"


def add_to_startup(exe_path: str = None):
    if winreg is None:
        return

    if exe_path is None:
        exe_path = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)

    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            REG_KEY,
            0,
            winreg.KEY_SET_VALUE,
        )
        winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, f'"{exe_path}"')
        winreg.CloseKey(key)
        log.info("Added to startup: %s", exe_path)
    except Exception as e:
        log.error("Failed to add to startup: %s", e)


def remove_from_startup():
    if winreg is None:
        return

    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            REG_KEY,
            0,
            winreg.KEY_SET_VALUE,
        )
        winreg.DeleteValue(key, APP_NAME)
        winreg.CloseKey(key)
        log.info("Removed from startup")
    except FileNotFoundError:
        pass
    except Exception as e:
        log.error("Failed to remove from startup: %s", e)


def is_in_startup() -> bool:
    if winreg is None:
        return False

    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            REG_KEY,
            0,
            winreg.KEY_READ,
        )
        winreg.QueryValueEx(key, APP_NAME)
        winreg.CloseKey(key)
        return True
    except FileNotFoundError:
        return False
    except Exception:
        return False