"""
File activity monitor — tracks create/modify/delete/rename events in common
user directories (Desktop, Documents, Downloads, Pictures).

Uses the watchdog pip package. The previous local watchdog.py has been renamed
to agent_watchdog.py so there is no longer a naming conflict.
"""

import os
import threading
from datetime import datetime, timezone
from logger import log

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler, FileSystemEvent
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    log.warning("watchdog package not available - file monitor disabled")

_lock = threading.Lock()
_buffer: list[dict] = []
_observer = None

WATCH_DIRS = [
    os.path.expanduser("~/Desktop"),
    os.path.expanduser("~/Documents"),
    os.path.expanduser("~/Downloads"),
    os.path.expanduser("~/Pictures"),
]

_IGNORE_EXTENSIONS = {
    ".tmp", ".temp", ".~tmp", ".lnk", ".ini", ".db", ".log",
    ".bak", ".crdownload", ".part", ".partial",
}
_IGNORE_PREFIXES = {"~$", ".$", ".~"}


def _should_ignore(path: str) -> bool:
    name = os.path.basename(path)
    ext = os.path.splitext(name)[1].lower()
    if ext in _IGNORE_EXTENSIONS:
        return True
    for prefix in _IGNORE_PREFIXES:
        if name.startswith(prefix):
            return True
    return False


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _add_event(action: str, file_path: str) -> None:
    if _should_ignore(file_path):
        return
    with _lock:
        _buffer.append({
            "action": action,
            "filePath": file_path[:500],
            "appName": "Explorer",
            "timestamp": _now_iso(),
        })


if WATCHDOG_AVAILABLE:
    class _Handler(FileSystemEventHandler):
        def on_created(self, event: "FileSystemEvent") -> None:
            if not event.is_directory:
                _add_event("created", event.src_path)

        def on_modified(self, event: "FileSystemEvent") -> None:
            if not event.is_directory:
                _add_event("modified", event.src_path)

        def on_deleted(self, event: "FileSystemEvent") -> None:
            if not event.is_directory:
                _add_event("deleted", event.src_path)

        def on_moved(self, event: "FileSystemEvent") -> None:
            if not event.is_directory:
                dest = getattr(event, "dest_path", "")
                _add_event("renamed", f"{event.src_path} → {dest}")


def get_and_clear() -> list[dict]:
    """Return all buffered file events and clear the buffer."""
    with _lock:
        entries = list(_buffer)
        _buffer.clear()
    return entries


def start_file_monitor() -> None:
    global _observer
    if not WATCHDOG_AVAILABLE:
        log.warning("File monitor: watchdog unavailable, skipping")
        return
    if _observer is not None:
        return
    try:
        handler = _Handler()
        _observer = Observer()
        watched = 0
        for d in WATCH_DIRS:
            if os.path.isdir(d):
                _observer.schedule(handler, d, recursive=True)
                watched += 1
        if watched == 0:
            log.warning("File monitor: no watch directories found")
            return
        _observer.daemon = True
        _observer.start()
        log.info("File monitor started (%d directories)", watched)
    except Exception as e:
        log.error("Failed to start file monitor: %s", e)


def stop_file_monitor() -> None:
    global _observer
    if _observer and _observer.is_alive():
        try:
            _observer.stop()
            _observer.join(timeout=3)
        except Exception:
            pass
        _observer = None
    log.info("File monitor stopped")
