"""
EMWatchdog - Lightweight process guardian for the main agent.
Built separately as EMWatchdog.exe via PyInstaller.
Also imported as a module by the main agent to ensure the watchdog is running.

Production-grade features:
  - Atomic update: detects UPDATE_READY.lock and swaps the exe atomically
  - Enforced-shutdown: respects .enforced_shutdown marker (version enforcement)
  - Crash-loop rollback: if new exe crashes >3 times in 1 hour, reverts to backup
"""

import os
import sys
import time
import shutil
import subprocess
import ctypes
from logger import log

AGENT_EXE_NAME = "EmployeeMonitor.exe"
WATCHDOG_EXE_NAME = "EMWatchdog.exe"
CHECK_INTERVAL = 60  # seconds

_STATE_FILE = r"C:\ProgramData\EmployeeMonitor\agent_state.txt"
_ENFORCED_SHUTDOWN_MARKER = r"C:\ProgramData\EmployeeMonitor\.enforced_shutdown"
_UPDATE_LOCK = os.path.join(os.getenv("TEMP", r"C:\Temp"), "EMUpdate", "UPDATE_READY.lock")
_UPDATE_EXE = os.path.join(os.getenv("TEMP", r"C:\Temp"), "EMUpdate", "EmployeeMonitor_new.exe")

_MAX_RESTARTS_PER_HOUR = 3
_restart_timestamps: list = []
_crash_timestamps: list = []  # for crash-loop detection after update


def _read_agent_state() -> str:
    try:
        with open(_STATE_FILE, "r") as f:
            content = f.read().strip()
        parts = content.split("|", 1)
        return parts[1] if len(parts) == 2 else "UNKNOWN"
    except Exception:
        return "UNKNOWN"


def _can_restart() -> bool:
    now = time.time()
    _restart_timestamps[:] = [t for t in _restart_timestamps if now - t < 3600]
    if len(_restart_timestamps) >= _MAX_RESTARTS_PER_HOUR:
        log.warning(
            "Restart limit reached (%d/hour). Will retry next cycle.",
            _MAX_RESTARTS_PER_HOUR,
        )
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


def _start_process(exe_path: str) -> None:
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


# ── Atomic update: agent downloads new exe and writes UPDATE_READY.lock ────────

def _apply_atomic_update(agent_path: str) -> bool:
    """
    Swap EmployeeMonitor.exe with the new downloaded version.
    Keeps a .backup for rollback. Returns True if successful.
    """
    if not os.path.exists(_UPDATE_EXE):
        log.error("Update exe not found at %s", _UPDATE_EXE)
        return False

    backup_path = agent_path + ".backup"
    try:
        # Keep backup of current working version
        if os.path.exists(agent_path):
            shutil.copy2(agent_path, backup_path)
            log.info("Backed up current agent to %s", backup_path)

        # Atomic swap
        shutil.move(_UPDATE_EXE, agent_path)
        log.info("Atomic update applied successfully")

        # Clean up lock file
        if os.path.exists(_UPDATE_LOCK):
            os.remove(_UPDATE_LOCK)

        return True
    except Exception as e:
        log.error("Atomic update failed: %s — rolling back", e)
        if os.path.exists(backup_path):
            try:
                shutil.copy2(backup_path, agent_path)
                log.info("Rollback to backup successful")
            except Exception as re:
                log.error("Rollback also failed: %s", re)
        return False


# ── Crash-loop detection: rollback if new version crashes too many times ───────

def _record_crash() -> None:
    _crash_timestamps.append(time.time())


def _check_crash_loop(agent_path: str) -> None:
    now = time.time()
    _crash_timestamps[:] = [t for t in _crash_timestamps if now - t < 3600]
    if len(_crash_timestamps) >= 3:
        backup_path = agent_path + ".backup"
        if os.path.exists(backup_path):
            log.critical(
                "Crash loop detected (%d crashes in 1h) — rolling back to previous version",
                len(_crash_timestamps),
            )
            try:
                shutil.copy2(backup_path, agent_path)
                _crash_timestamps.clear()
                log.info("Rollback to backup version complete")
                # Report rollback to server (best-effort)
                try:
                    import requests
                    from config import load_config
                    cfg = load_config()
                    requests.post(
                        f"{cfg.get('serverUrl', '')}/api/agent/update-status",
                        headers={"x-agent-token": cfg.get("agentToken", "")},
                        json={"status": "rolled_back", "reason": "crash_loop"},
                        timeout=5,
                    )
                except Exception:
                    pass
            except Exception as e:
                log.error("Crash-loop rollback failed: %s", e)


# ── Main watchdog loop ─────────────────────────────────────────────────────────

def ensure_watchdog_running() -> None:
    """Called by the main agent to ensure the watchdog guardian is running."""
    exe_dir = _get_exe_dir()
    watchdog_path = os.path.join(exe_dir, WATCHDOG_EXE_NAME)
    if not os.path.exists(watchdog_path):
        log.debug("Watchdog exe not found at %s", watchdog_path)
        return
    if not _is_process_running(WATCHDOG_EXE_NAME):
        log.warning("Watchdog not running, starting it...")
        _start_process(watchdog_path)


def watchdog_main() -> None:
    """Entry point when running as standalone EMWatchdog.exe."""
    log.info("Watchdog started, monitoring %s", AGENT_EXE_NAME)

    # Set high priority so the watchdog stays responsive under load
    try:
        proc = psutil.Process(os.getpid())
        proc.nice(psutil.HIGH_PRIORITY_CLASS)
    except Exception:
        pass

    exe_dir = _get_exe_dir()
    agent_path = os.path.join(exe_dir, AGENT_EXE_NAME)

    # Re-register startup entries so they survive antivirus cleanup
    try:
        from startup import add_to_startup
        add_to_startup(agent_path)
    except Exception as e:
        log.debug("Watchdog: startup re-register failed: %s", e)

    while True:
        try:
            if not _is_process_running(AGENT_EXE_NAME):
                state = _read_agent_state()

                # ── Priority 1: check for enforced shutdown (version policy) ──
                if os.path.exists(_ENFORCED_SHUTDOWN_MARKER):
                    log.info(
                        "Agent stopped due to version enforcement — not restarting. "
                        "Will clear marker after 5 minutes."
                    )
                    time.sleep(300)
                    if os.path.exists(_ENFORCED_SHUTDOWN_MARKER):
                        try:
                            os.remove(_ENFORCED_SHUTDOWN_MARKER)
                        except Exception:
                            pass
                    continue

                # ── Priority 2: pending atomic update ──────────────────────────
                if os.path.exists(_UPDATE_LOCK) and os.path.exists(_UPDATE_EXE):
                    new_version = ""
                    try:
                        new_version = open(_UPDATE_LOCK).read().strip()
                    except Exception:
                        pass
                    log.info("Update ready (%s) — applying atomic swap", new_version)
                    success = _apply_atomic_update(agent_path)
                    if success:
                        log.info("Starting updated agent (%s)", new_version)
                        _start_process(agent_path)
                        _crash_timestamps.clear()  # reset crash counter for new version
                    else:
                        log.error("Update apply failed — starting previous version")
                        _start_process(agent_path)
                    _restart_timestamps.append(time.time())
                    time.sleep(CHECK_INTERVAL)
                    continue

                # ── Priority 3: normal crash restart ──────────────────────────
                if state == "INTENTIONAL_SHUTDOWN":
                    log.info("Agent was intentionally shut down — not restarting.")
                elif not _can_restart():
                    log.warning("Too many restarts — skipping. Will retry next cycle.")
                elif os.path.exists(agent_path):
                    log.warning("Agent not running (state=%s) — restarting...", state)
                    _record_crash()
                    _check_crash_loop(agent_path)
                    _restart_timestamps.append(time.time())
                    _start_process(agent_path)
                else:
                    log.error("Agent exe not found at %s", agent_path)

        except Exception as e:
            log.error("Watchdog check error: %s", e)

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    watchdog_main()
