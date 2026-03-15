"""
Print monitor - detects print jobs using Windows WMI (Win32_PrintJob).
Polls every 30 seconds and reports new jobs to the server.
Requires pywin32 (already in requirements).
"""

import threading
from datetime import datetime, timezone
from logger import log

try:
    import win32com.client
    WMI_AVAILABLE = True
except ImportError:
    WMI_AVAILABLE = False
    log.warning("win32com not available - print monitor disabled")

_lock = threading.Lock()
_buffer: list[dict] = []
_seen_job_ids: set[int] = set()
_stop_event = threading.Event()


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _poll_print_jobs() -> None:
    """Query WMI for current print jobs and buffer any new ones."""
    try:
        wmi = win32com.client.GetObject("winmgmts:")
        jobs = wmi.ExecQuery("SELECT * FROM Win32_PrintJob")
        for job in jobs:
            try:
                job_id = int(job.JobId)
            except (TypeError, ValueError):
                continue

            if job_id in _seen_job_ids:
                continue
            _seen_job_ids.add(job_id)

            try:
                pages = int(job.TotalPages or 1)
            except (TypeError, ValueError):
                pages = 1

            # job.Name is typically "PrinterName, JobId"
            printer_name = "Unknown"
            try:
                printer_name = str(job.Name).split(",")[0].strip()
            except Exception:
                pass

            document = "Unknown"
            try:
                document = str(job.Document or "Unknown")
            except Exception:
                pass

            with _lock:
                _buffer.append({
                    "printer": printer_name,
                    "document": document,
                    "pages": pages,
                    "appName": "Print Spooler",
                    "timestamp": _now_iso(),
                })
            log.info("Print job detected: '%s' on '%s' (%d page(s))", document, printer_name, pages)

    except Exception as e:
        log.debug("Print poll error: %s", e)


def _monitor_loop() -> None:
    while not _stop_event.is_set():
        _poll_print_jobs()
        _stop_event.wait(timeout=30)


def get_and_clear() -> list[dict]:
    """Return all buffered print jobs and clear the buffer."""
    with _lock:
        entries = list(_buffer)
        _buffer.clear()
    return entries


def start_print_monitor() -> None:
    if not WMI_AVAILABLE:
        log.warning("Print monitor: win32com unavailable, skipping")
        return
    _stop_event.clear()
    t = threading.Thread(target=_monitor_loop, daemon=True, name="PrintMonitor")
    t.start()
    log.info("Print monitor started")


def stop_print_monitor() -> None:
    _stop_event.set()
    log.info("Print monitor stopped")
