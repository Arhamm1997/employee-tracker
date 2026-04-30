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

_STATE_FILE = r"C:\ProgramData\EmployeeMonitor\agent_state.txt"
_MAX_RESTARTS_PER_HOUR = 3
_restart_timestamps: list = []  # timestamps of recent restarts


def _read_agent_state() -> str:
    """Returns the last written state string, e.g. 'RUNNING' or 'INTENTIONAL_SHUTDOWN'."""
    try:
        with open(_STATE_FILE, "r") as f:
            content = f.read().strip()
        parts = content.split("|", 1)
        return parts[1] if len(parts) == 2 else "UNKNOWN"
    except Exception:
        return "UNKNOWN"


def _can_restart() -> bool:
    """Returns False if we've already restarted too many times in the last hour."""
    now = time.time()
    _restart_timestamps[:] = [t for t in _restart_timestamps if now - t < 3600]
    if len(_restart_timestamps) >= _MAX_RESTARTS_PER_HOUR:
        log.warning("Restart limit reached (%d/hour). Waiting before next restart.", _MAX_RESTARTS_PER_HOUR)
        return False
    return True

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

    # Re-register startup entries on every watchdog launch so they survive
    # antivirus cleanup or manual deletion.
    try:
        from startup import add_to_startup
        add_to_startup(agent_path)
    except Exception as e:
        log.debug("Watchdog: startup re-register failed: %s", e)

    while True:
        try:
            if not _is_process_running(AGENT_EXE_NAME):
                state = _read_agent_state()
                if state == "INTENTIONAL_SHUTDOWN":
                    log.info("Agent was intentionally shut down — not restarting.")
                elif not _can_restart():
                    log.warning("Too many restarts in last hour — skipping restart. Will retry next cycle.")
                elif os.path.exists(agent_path):
                    log.warning("Agent not running (state=%s)! Restarting...", state)
                    _restart_timestamps.append(time.time())
                    _start_process(agent_path)
                else:
                    log.error("Agent exe not found at %s", agent_path)
        except Exception as e:
            log.error("Watchdog check error: %s", e)

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    watchdog_main()
