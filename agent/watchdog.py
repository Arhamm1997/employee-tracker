"""
EMWatchdog - Lightweight process that monitors the main agent.
Built separately as EMWatchdog.exe via PyInstaller.
Also used as a module by the main agent to monitor the watchdog.
"""

import os
import sys
import time
import subprocess
import ctypes
from logger import log

AGENT_EXE_NAME = "EmployeeMonitor.exe"
WATCHDOG_EXE_NAME = "EMWatchdog.exe"
CHECK_INTERVAL = 60  # seconds — agent needs up to 120s network wait on startup

try:
    import psutil
except ImportError:
    psutil = None


def _is_process_running(name: str) -> bool:
    if psutil is None:
        return False
    for proc in psutil.process_iter(["name"]):
        try:
            if proc.info["name"] and proc.info["name"].lower() == name.lower():
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return False


def _start_process(exe_path: str):
    try:
        subprocess.Popen(
            [exe_path],
            creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS,
        )
        log.info("Started process: %s", exe_path)
    except Exception as e:
        log.error("Failed to start %s: %s", exe_path, e)


def _get_exe_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def ensure_watchdog_running():
    """Called by the main agent to ensure the watchdog is running."""
    exe_dir = _get_exe_dir()
    watchdog_path = os.path.join(exe_dir, WATCHDOG_EXE_NAME)

    if not os.path.exists(watchdog_path):
        log.debug("Watchdog exe not found at %s", watchdog_path)
        return

    if not _is_process_running(WATCHDOG_EXE_NAME):
        log.warning("Watchdog not running, starting it...")
        _start_process(watchdog_path)


def watchdog_main():
    """Entry point when running as standalone watchdog exe."""
    log.info("Watchdog started, monitoring %s", AGENT_EXE_NAME)

    # Set high priority
    try:
        proc = psutil.Process(os.getpid())
        proc.nice(psutil.HIGH_PRIORITY_CLASS)
    except Exception:
        pass

    exe_dir = _get_exe_dir()
    agent_path = os.path.join(exe_dir, AGENT_EXE_NAME)

    while True:
        try:
            if not _is_process_running(AGENT_EXE_NAME):
                log.warning("Agent not running! Restarting...")
                if os.path.exists(agent_path):
                    _start_process(agent_path)
                else:
                    log.error("Agent exe not found at %s", agent_path)
        except Exception as e:
            log.error("Watchdog check error: %s", e)

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    watchdog_main()
