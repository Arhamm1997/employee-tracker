import time
import ctypes
from ctypes import wintypes
from logger import log

try:
    import win32gui
    import win32process
    import psutil
except ImportError:
    win32gui = win32process = psutil = None
    log.warning("win32gui/psutil not available - tracker will use fallback")

# ─── Idle Detection (using pynput) ────────────────────────────────────────────

_last_activity_time = time.time()


def _record_activity(*_args):
    global _last_activity_time
    _last_activity_time = time.time()


def start_idle_listeners():
    try:
        from pynput import mouse, keyboard

        mouse.Listener(
            on_move=_record_activity,
            on_click=_record_activity,
            on_scroll=_record_activity,
        ).start()

        keyboard.Listener(on_press=_record_activity).start()

        log.info("Idle detection listeners started")
    except Exception as e:
        log.error("Failed to start idle listeners: %s", e)


def is_idle(threshold_minutes: int) -> bool:
    elapsed = time.time() - _last_activity_time
    return elapsed > (threshold_minutes * 60)


# ─── Active Window Detection ─────────────────────────────────────────────────

def get_active_window() -> dict:
    """Return {"appName": ..., "windowTitle": ...} for the current foreground window."""
    try:
        if win32gui is None:
            return {"appName": "Unknown", "windowTitle": "Unknown"}

        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return {"appName": "Desktop", "windowTitle": "Desktop"}

        window_title = win32gui.GetWindowText(hwnd) or "Untitled"

        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        try:
            proc = psutil.Process(pid)
            app_name = proc.name().replace(".exe", "")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            app_name = "Unknown"

        return {"appName": app_name, "windowTitle": window_title}
    except Exception as e:
        log.error("Failed to get active window: %s", e)
        return {"appName": "Unknown", "windowTitle": "Unknown"}


# ─── System Idle Time (alternative via Win32 API) ────────────────────────────

class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]


def get_system_idle_seconds() -> float:
    """Get seconds since last user input using Win32 GetLastInputInfo."""
    try:
        lii = LASTINPUTINFO()
        lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
        ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
        millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
        return millis / 1000.0
    except Exception:
        return 0.0
