"""
Structured logger with:
  - File rotation (daily, 7-day retention)
  - ProgramData → LocalAppData fallback
  - WARNING+ buffering for backend error reporting
  - Deduplication: identical messages at WARNING+ are suppressed after the first
    occurrence within a rolling 5-minute window (prevents log storms)
"""

import os
import time
import logging
from datetime import datetime, timezone
from threading import Lock

_PRIMARY_LOG_DIR = r"C:\ProgramData\EmployeeMonitor\logs"
_DEDUP_WINDOW_SECS = 300   # suppress identical messages for 5 minutes
_DEDUP_MAX_ENTRIES = 500   # cap the dedup cache to avoid memory growth

# ─── Error Buffer ─────────────────────────────────────────────────────────────

_error_buffer: list[dict] = []


def flush_error_buffer() -> list[dict]:
    """Return and clear all buffered WARNING+ records (sent to backend periodically)."""
    entries = _error_buffer.copy()
    _error_buffer.clear()
    return entries


# ─── Dedup filter ─────────────────────────────────────────────────────────────

class _DedupFilter(logging.Filter):
    """
    Suppress repeated identical messages within a rolling time window.

    The first occurrence is always logged. Subsequent identical messages within
    _DEDUP_WINDOW_SECS are counted silently. When the window expires the message
    is emitted once more with the suppressed count so nothing is lost.
    """

    def __init__(self, window: float = _DEDUP_WINDOW_SECS) -> None:
        super().__init__()
        self._window = window
        # key → {"first_ts": float, "count": int, "last_record": LogRecord}
        self._cache: dict[str, dict] = {}
        self._lock = Lock()

    def filter(self, record: logging.LogRecord) -> bool:
        # Only deduplicate WARNING and above; let DEBUG/INFO through unfiltered
        if record.levelno < logging.WARNING:
            return True

        key = f"{record.levelno}:{record.getMessage()}"
        now = time.monotonic()

        with self._lock:
            # Prune stale entries to cap memory use
            if len(self._cache) > _DEDUP_MAX_ENTRIES:
                cutoff = now - self._window
                self._cache = {
                    k: v for k, v in self._cache.items() if v["first_ts"] >= cutoff
                }

            entry = self._cache.get(key)
            if entry is None:
                # First occurrence — always log it
                self._cache[key] = {"first_ts": now, "count": 1, "last_record": record}
                return True

            elapsed = now - entry["first_ts"]
            if elapsed > self._window:
                # Window expired — emit a summary then reset
                count = entry["count"]
                if count > 1:
                    summary = logging.makeLogRecord({
                        "name": record.name,
                        "levelno": record.levelno,
                        "levelname": record.levelname,
                        "msg": "[x%d in %.0fs] %s",
                        "args": (count, elapsed, record.getMessage()),
                        "pathname": record.pathname,
                        "lineno": record.lineno,
                        "funcName": record.funcName,
                    })
                    # Emit summary via the parent logger bypassing this filter
                    for handler in record.name and logging.getLogger(record.name).handlers or []:
                        handler.emit(summary)
                self._cache[key] = {"first_ts": now, "count": 1, "last_record": record}
                return True

            # Still within window — suppress
            entry["count"] += 1
            return False


# ─── Error buffer handler ──────────────────────────────────────────────────────

class _ErrorBufferHandler(logging.Handler):
    """Collects WARNING+ records for backend reporting."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            _error_buffer.append({
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                "level": record.levelname,
                "message": self.format(record),
            })
            # Cap buffer size
            if len(_error_buffer) > 200:
                del _error_buffer[:50]
        except Exception:
            pass


# ─── Logger factory ───────────────────────────────────────────────────────────

def setup_logger(name: str = "EmployeeMonitor") -> logging.Logger:
    import sys
    from logging.handlers import TimedRotatingFileHandler

    prefix = (
        os.path.splitext(os.path.basename(sys.executable))[0]
        if getattr(sys, "frozen", False)
        else name
    )

    def _make_file_handler(log_dir: str) -> TimedRotatingFileHandler:
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, f"{prefix}_{datetime.now():%Y-%m-%d}.log")
        return TimedRotatingFileHandler(
            log_file, when="midnight", backupCount=7, encoding="utf-8"
        )

    try:
        file_handler = _make_file_handler(_PRIMARY_LOG_DIR)
    except (PermissionError, OSError):
        fallback = os.path.join(
            os.getenv("LOCALAPPDATA", os.path.expanduser("~")),
            "EmployeeMonitor",
            "logs",
        )
        file_handler = _make_file_handler(fallback)

    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter(
            "[%(asctime)s] [%(levelname)s] [agent]\n  %(message)s\n",
            datefmt="%d %b %Y %H:%M:%S",
        )
    )

    # Dedup filter applies to WARNING+ on the file handler
    dedup = _DedupFilter()
    file_handler.addFilter(dedup)
    logger.addHandler(file_handler)

    # Error buffer handler (WARNING and above, also deduplicated)
    buf_handler = _ErrorBufferHandler(level=logging.WARNING)
    buf_handler.addFilter(dedup)
    buf_handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(buf_handler)

    return logger


log = setup_logger()
