import sys
import os
import subprocess
from logger import log

try:
    import winreg
except ImportError:
    winreg = None
    log.warning("winreg not available - startup registration disabled")

REG_KEY  = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
APP_NAME = "EmployeeMonitor"

SERVICE_NAME    = "EmployeeMonitorSvc"
SERVICE_DISPLAY = "Employee Monitor"
SERVICE_DESC    = "Employee monitoring and security agent"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_exe_path(exe_path: str = None) -> str:
    if exe_path:
        return exe_path
    if getattr(sys, "frozen", False):
        return sys.executable
    return os.path.abspath(__file__)


def _is_admin() -> bool:
    try:
        import ctypes
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def _run_sc(args: list) -> bool:
    """Run a sc.exe command, return True on success."""
    try:
        result = subprocess.run(
            ["sc"] + args,
            capture_output=True,
            text=True,
            timeout=15,
        )
        return result.returncode == 0
    except Exception as e:
        log.error("sc.exe call failed: %s", e)
        return False


def _service_exists() -> bool:
    try:
        result = subprocess.run(
            ["sc", "query", SERVICE_NAME],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode == 0
    except Exception:
        return False


# ── Service management ────────────────────────────────────────────────────────

def install_service(exe_path: str = None) -> bool:
    """Install agent as a Windows Service (SYSTEM account, auto-start).

    Must be called with Administrator rights.
    Returns True if service is ready (installed or already existed).
    """
    path = _get_exe_path(exe_path)

    if _service_exists():
        log.info("Service '%s' already installed", SERVICE_NAME)
        # Update the binary path in case exe moved
        _run_sc(["config", SERVICE_NAME, f"binPath= \"{path}\""])
        return True

    log.info("Installing Windows service: %s", SERVICE_NAME)

    ok = _run_sc([
        "create", SERVICE_NAME,
        f"binPath= \"{path}\"",
        "start=", "auto",
        "DisplayName=", SERVICE_DISPLAY,
    ])

    if not ok:
        log.error("Failed to install service '%s'", SERVICE_NAME)
        return False

    # Set description
    _run_sc(["description", SERVICE_NAME, SERVICE_DESC])

    # Configure failure recovery — restart after 5 s on any failure
    _run_sc([
        "failure", SERVICE_NAME,
        "reset=", "86400",
        "actions=", "restart/5000/restart/5000/restart/5000",
    ])

    log.info("Service '%s' installed successfully", SERVICE_NAME)
    return True


def start_service() -> bool:
    """Start the service if it is not already running."""
    try:
        result = subprocess.run(
            ["sc", "query", SERVICE_NAME],
            capture_output=True, text=True, timeout=10,
        )
        if "RUNNING" in result.stdout:
            log.debug("Service already running")
            return True
    except Exception:
        pass

    log.info("Starting service '%s'", SERVICE_NAME)
    ok = _run_sc(["start", SERVICE_NAME])
    if ok:
        log.info("Service started")
    else:
        log.error("Failed to start service '%s'", SERVICE_NAME)
    return ok


def remove_service() -> bool:
    """Stop and remove the Windows Service."""
    if not _service_exists():
        return True
    _run_sc(["stop", SERVICE_NAME])
    ok = _run_sc(["delete", SERVICE_NAME])
    if ok:
        log.info("Service '%s' removed", SERVICE_NAME)
    return ok


# ── Registry fallback ─────────────────────────────────────────────────────────
# Used when agent is NOT running as a service (e.g. dev / non-admin mode).
# Does NOT give SYSTEM rights — hosts-file blocking will not work in this mode.

def _add_registry_startup(exe_path: str = None):
    if winreg is None:
        return
    path = _get_exe_path(exe_path)
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_SET_VALUE,
        )
        winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, f'"{path}"')
        winreg.CloseKey(key)
        log.info("Registry startup entry added (fallback, limited rights): %s", path)
    except Exception as e:
        log.error("Registry startup failed: %s", e)


def _remove_registry_startup():
    if winreg is None:
        return
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_SET_VALUE,
        )
        winreg.DeleteValue(key, APP_NAME)
        winreg.CloseKey(key)
        log.info("Registry startup entry removed")
    except FileNotFoundError:
        pass
    except Exception as e:
        log.error("Registry startup remove failed: %s", e)


# ── Public API (called by agent.py) ──────────────────────────────────────────

def add_to_startup(exe_path: str = None):
    """Register agent for auto-start.

    Strategy:
      - Admin rights available  → install + start Windows Service (SYSTEM)
      - No admin rights         → fallback to registry (limited, hosts blocking won't work)
    """
    if _is_admin():
        if install_service(exe_path):
            start_service()
            # Remove old registry entry if it exists (cleanup)
            _remove_registry_startup()
            return
        log.warning("Service install failed — falling back to registry startup")

    # Fallback
    _add_registry_startup(exe_path)
    log.warning(
        "Agent registered via registry (no SYSTEM rights). "
        "Website blocking will NOT work after reboot. "
        "Run as Administrator for full functionality."
    )


def remove_from_startup():
    """Remove all startup registrations (service + registry)."""
    remove_service()
    _remove_registry_startup()


def is_in_startup() -> bool:
    """Return True if agent will start on boot (via service or registry)."""
    if _service_exists():
        return True
    if winreg is None:
        return False
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_READ,
        )
        winreg.QueryValueEx(key, APP_NAME)
        winreg.CloseKey(key)
        return True
    except FileNotFoundError:
        return False
    except Exception:
        return False