import os
import json
from datetime import datetime
from logger import log

try:
    import winreg
except ImportError:
    winreg = None

SOFTWARE_LIST_PATH = r"C:\ProgramData\EmployeeMonitor\software_list.json"

REG_PATHS = [
    (winreg.HKEY_LOCAL_MACHINE if winreg else None, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    (winreg.HKEY_CURRENT_USER if winreg else None, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    (winreg.HKEY_LOCAL_MACHINE if winreg else None, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
]


def _get_installed_software() -> dict:
    """Return {name: install_date} dict of installed software."""
    if winreg is None:
        return {}

    software = {}
    for hive, path in REG_PATHS:
        if hive is None:
            continue
        try:
            key = winreg.OpenKey(hive, path, 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY)
            for i in range(winreg.QueryInfoKey(key)[0]):
                try:
                    subkey_name = winreg.EnumKey(key, i)
                    subkey = winreg.OpenKey(key, subkey_name)
                    try:
                        name = winreg.QueryValueEx(subkey, "DisplayName")[0]
                        try:
                            install_date = winreg.QueryValueEx(subkey, "InstallDate")[0]
                        except FileNotFoundError:
                            install_date = ""
                        if name and name.strip():
                            software[name.strip()] = install_date
                    except FileNotFoundError:
                        pass
                    finally:
                        winreg.CloseKey(subkey)
                except OSError:
                    pass
            winreg.CloseKey(key)
        except OSError:
            pass

    return software


def _load_saved_list() -> dict:
    try:
        if os.path.exists(SOFTWARE_LIST_PATH):
            with open(SOFTWARE_LIST_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        log.error("Failed to load software list: %s", e)
    return {}


def _save_list(software: dict):
    try:
        os.makedirs(os.path.dirname(SOFTWARE_LIST_PATH), exist_ok=True)
        with open(SOFTWARE_LIST_PATH, "w", encoding="utf-8") as f:
            json.dump(software, f, indent=2)
    except Exception as e:
        log.error("Failed to save software list: %s", e)


def check_new_software() -> list:
    """Compare current installed software with saved list. Returns list of new software names."""
    current = _get_installed_software()
    saved = _load_saved_list()

    new_software = []
    for name in current:
        if name not in saved:
            new_software.append({
                "softwareName": name,
                "installedAt": current[name] or datetime.now().isoformat(),
            })

    if new_software:
        log.info("Detected %d new software installations", len(new_software))

    # Update saved list
    _save_list(current)
    return new_software
