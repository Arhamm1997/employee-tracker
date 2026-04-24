import sys
import os
import subprocess
from logger import log

try:
    import winreg
except ImportError:
    winreg = None
    log.warning("winreg not available - startup registration disabled")

REG_KEY = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
APP_NAME = "EmployeeMonitor"
WATCHDOG_NAME = "EMWatchdog"
TASK_FOLDER = "EmployeeMonitor"


def _exe_dir(exe_path: str) -> str:
    return os.path.dirname(os.path.abspath(exe_path))


def _register_registry(name: str, path: str) -> None:
    if winreg is None:
        return
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(key, name, 0, winreg.REG_SZ, f'"{path}"')
        winreg.CloseKey(key)
        log.info("Registry startup registered: %s → %s", name, path)
    except Exception as e:
        log.error("Failed to register %s in registry: %s", name, e)


def _delete_registry(name: str) -> None:
    if winreg is None:
        return
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_SET_VALUE)
        winreg.DeleteValue(key, name)
        winreg.CloseKey(key)
    except FileNotFoundError:
        pass
    except Exception as e:
        log.error("Failed to delete %s from registry: %s", name, e)


def _schtasks(*args) -> bool:
    """Run a schtasks command silently. Returns True on success."""
    try:
        result = subprocess.run(
            ["schtasks"] + list(args),
            capture_output=True,
            timeout=15,
        )
        return result.returncode == 0
    except Exception as e:
        log.debug("schtasks error: %s", e)
        return False


def _register_task_scheduler(agent_path: str, watchdog_path: str) -> None:
    """Register Task Scheduler tasks as a bulletproof fallback.

    Two tasks:
    - EMWatchdog runs at every logon (restarts agent if crashed)
    - EmployeeMonitor runs every 5 minutes (starts agent if watchdog missed it)
    Single-instance guard in agent.py ensures no duplicates.
    """
    # Watchdog: run at every user logon
    if os.path.exists(watchdog_path):
        ok = _schtasks(
            "/create", "/f",
            "/tn", f"{TASK_FOLDER}\\{WATCHDOG_NAME}",
            "/tr", f'"{watchdog_path}"',
            "/sc", "ONLOGON",
            "/rl", "HIGHEST",
            "/delay", "0000:30",  # 30s after logon to let desktop settle
        )
        if ok:
            log.info("Task Scheduler: watchdog registered (ONLOGON)")

    # Agent: run every 5 minutes as final fallback
    if os.path.exists(agent_path):
        ok = _schtasks(
            "/create", "/f",
            "/tn", f"{TASK_FOLDER}\\{APP_NAME}",
            "/tr", f'"{agent_path}"',
            "/sc", "MINUTE",
            "/mo", "5",
        )
        if ok:
            log.info("Task Scheduler: agent restart task registered (every 5 min)")


def add_to_startup(exe_path: str = None) -> None:
    if exe_path is None:
        exe_path = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)

    exe_path = os.path.abspath(exe_path)
    directory = _exe_dir(exe_path)
    watchdog_path = os.path.join(directory, f"{WATCHDOG_NAME}.exe")

    # 1. Registry Run key — agent
    _register_registry(APP_NAME, exe_path)

    # 2. Registry Run key — watchdog (so it also starts on boot)
    if os.path.exists(watchdog_path):
        _register_registry(WATCHDOG_NAME, watchdog_path)

    # 3. Task Scheduler — most reliable, survives antivirus registry cleanup
    _register_task_scheduler(exe_path, watchdog_path)


def remove_from_startup() -> None:
    _delete_registry(APP_NAME)
    _delete_registry(WATCHDOG_NAME)
    # Remove Task Scheduler tasks
    _schtasks("/delete", "/f", "/tn", f"{TASK_FOLDER}\\{APP_NAME}")
    _schtasks("/delete", "/f", "/tn", f"{TASK_FOLDER}\\{WATCHDOG_NAME}")
    log.info("Removed from startup (registry + Task Scheduler)")


def is_in_startup() -> bool:
    if winreg is None:
        return False
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_READ)
        winreg.QueryValueEx(key, APP_NAME)
        winreg.CloseKey(key)
        return True
    except FileNotFoundError:
        return False
    except Exception:
        return False
