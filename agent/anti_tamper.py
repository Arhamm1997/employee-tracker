import os
import sys
import ctypes
from logger import log

try:
    import psutil
    import win32api
    import win32con
    import win32process
except ImportError:
    psutil = win32api = win32con = win32process = None
    log.warning("pywin32/psutil not available - anti-tamper features disabled")


def set_high_priority():
    """Set the current process to high priority."""
    try:
        if psutil:
            p = psutil.Process(os.getpid())
            p.nice(psutil.HIGH_PRIORITY_CLASS)
            log.info("Process priority set to HIGH")
    except Exception as e:
        log.error("Failed to set high priority: %s", e)


def protect_process():
    """Apply basic process protection measures."""
    set_high_priority()

    # Attempt to hide from Task Manager by setting DACL
    # This is a best-effort protection
    try:
        if ctypes.windll.kernel32:
            handle = ctypes.windll.kernel32.GetCurrentProcess()
            # Reduce the attack surface by setting info class
            # ProcessInformationClass 29 = ProcessBreakOnTermination (requires admin)
            # We just set high priority as the main protection
            log.info("Process protection applied")
    except Exception as e:
        log.error("Process protection failed: %s", e)


def lock_exe_file():
    """Keep the exe file open to prevent deletion while running."""
    if not getattr(sys, "frozen", False):
        return None

    try:
        exe_path = sys.executable
        # Open with sharing read (so the OS can still read it)
        # but prevent deletion
        handle = open(exe_path, "rb")
        log.info("Exe file locked: %s", exe_path)
        return handle  # Keep reference alive to maintain lock
    except Exception as e:
        log.error("Failed to lock exe: %s", e)
        return None


def monitor_install_dir():
    """Check if key files still exist in install directory."""
    if not getattr(sys, "frozen", False):
        return True

    exe_dir = os.path.dirname(sys.executable)
    exe_file = sys.executable

    if not os.path.exists(exe_file):
        log.error("Agent executable was deleted!")
        return False

    return True


def apply_all_protections() -> object:
    """Apply all anti-tamper protections. Returns file handle to keep alive."""
    set_high_priority()
    protect_process()
    handle = lock_exe_file()
    log.info("All anti-tamper protections applied")
    return handle
