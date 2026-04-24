import os
import logging
from datetime import datetime, timezone

LOG_DIR = r"C:\ProgramData\EmployeeMonitor\logs"

# ─── Error Buffer ─────────────────────────────────────────────────────────────
# Stores WARNING and ERROR entries so agent.py can flush them to the backend.

_error_buffer: list[dict] = []

class _ErrorBufferHandler(logging.Handler):
    """Collects WARNING+ log records into _error_buffer for backend reporting."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            _error_buffer.append({
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                "level": record.levelname,
                "message": self.format(record),
            })
        except Exception:
            pass


def flush_error_buffer() -> list[dict]:
    """Return all buffered errors and clear the buffer."""
    entries = _error_buffer.copy()
    _error_buffer.clear()
    return entries


def setup_logger(name: str = "EmployeeMonitor") -> logging.Logger:
    import sys
    os.makedirs(LOG_DIR, exist_ok=True)

    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    # Import inside function to avoid circular import when PyInstaller bundles
    # logging.handlers -> stdlib queue -> agent's queue module -> logger (circular)
    from logging.handlers import TimedRotatingFileHandler

    # Use exe name as log prefix so agent and watchdog don't share a file
    # (TimedRotatingFileHandler holds an exclusive lock on Windows)
    if getattr(sys, "frozen", False):
        prefix = os.path.splitext(os.path.basename(sys.executable))[0]
    else:
        prefix = name
    log_file = os.path.join(LOG_DIR, f"{prefix}_{datetime.now():%Y-%m-%d}.log")
    file_handler = TimedRotatingFileHandler(
        log_file, when="midnight", backupCount=7, encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    )
    logger.addHandler(file_handler)

    # Error buffer handler (WARNING and above)
    buf_handler = _ErrorBufferHandler(level=logging.WARNING)
    buf_handler.setFormatter(
        logging.Formatter("%(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    )
    logger.addHandler(buf_handler)

    return logger

log = setup_logger()
