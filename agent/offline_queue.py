"""
Offline activity queue backed by SQLite (WAL mode).

Storage locations (tried in order):
  1. C:\\ProgramData\\EmployeeMonitor\\queue.db   (preferred; requires admin)
  2. %LOCALAPPDATA%\\EmployeeMonitor\\queue.db    (always writable)

The location is resolved once at init_db() and cached for the process lifetime.
"""

import os
import sqlite3
import json
import time
from logger import log

_PRIMARY_DB = r"C:\ProgramData\EmployeeMonitor\queue.db"
_FALLBACK_DB = os.path.join(
    os.getenv("LOCALAPPDATA", os.path.expanduser("~")),
    "EmployeeMonitor",
    "queue.db",
)

_db_path: str | None = None  # resolved once in init_db()


def _resolve_db_path() -> str:
    """Return the first path we can successfully write to."""
    for candidate in (_PRIMARY_DB, _FALLBACK_DB):
        try:
            os.makedirs(os.path.dirname(candidate), exist_ok=True)
            # Quick write-test: open in append mode
            with open(candidate + ".writetest", "ab") as fh:
                fh.write(b"")
            os.remove(candidate + ".writetest")
            return candidate
        except (PermissionError, OSError) as e:
            log.warning(
                "Queue DB path %s is not writable (%s) — trying next location",
                candidate,
                e,
            )
    # Last resort: temp dir (always writable)
    tmp = os.path.join(os.getenv("TEMP", r"C:\Temp"), "EmployeeMonitor", "queue.db")
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    log.warning(
        "All preferred queue DB locations are read-only — using TEMP: %s. "
        "Run the agent as Administrator for persistent storage.",
        tmp,
    )
    return tmp


def _get_conn() -> sqlite3.Connection:
    """Open a WAL-mode connection to the resolved DB path."""
    global _db_path
    if _db_path is None:
        _db_path = _resolve_db_path()

    conn = sqlite3.connect(_db_path, check_same_thread=False, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=5000")  # wait up to 5 s on lock
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables and validate the DB is writable. Call once at startup."""
    global _db_path
    _db_path = _resolve_db_path()

    try:
        conn = _get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS activity_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employeeCode TEXT NOT NULL,
                appName TEXT NOT NULL,
                windowTitle TEXT NOT NULL,
                isIdle INTEGER NOT NULL DEFAULT 0,
                timestamp TEXT NOT NULL,
                synced INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL DEFAULT (strftime('%s','now'))
            );
            CREATE TABLE IF NOT EXISTS screenshot_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employeeCode TEXT NOT NULL,
                imagePath TEXT NOT NULL,
                appName TEXT NOT NULL,
                windowTitle TEXT NOT NULL,
                monitorCount INTEGER NOT NULL DEFAULT 1,
                timestamp TEXT NOT NULL,
                synced INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL DEFAULT (strftime('%s','now'))
            );
            CREATE TABLE IF NOT EXISTS event_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employeeCode TEXT NOT NULL,
                eventType TEXT NOT NULL,
                data_json TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                synced INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL DEFAULT (strftime('%s','now'))
            );
        """)
        conn.commit()
        conn.close()
        log.info("Offline queue DB ready at %s", _db_path)
    except Exception as e:
        log.error(
            "Failed to initialize offline queue DB at %s: %s. "
            "Offline queuing will be disabled for this session.",
            _db_path,
            e,
        )
        _db_path = None  # Disable queuing so callers fail silently


def _try_queue(fn):
    """Decorator: skip silently if DB is not available."""
    def wrapper(*args, **kwargs):
        if _db_path is None:
            return
        try:
            fn(*args, **kwargs)
        except sqlite3.OperationalError as e:
            if "readonly" in str(e).lower():
                log.error(
                    "Queue DB is read-only (%s). "
                    "Fix: run agent as Administrator, or ensure %s is writable.",
                    e,
                    _db_path,
                )
            else:
                log.error("Queue DB error: %s", e)
        except Exception as e:
            log.error("Queue operation failed: %s", e)
    return wrapper


@_try_queue
def queue_activity(
    employee_code: str, app_name: str, window_title: str, is_idle: bool, timestamp: str
) -> None:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO activity_queue (employeeCode, appName, windowTitle, isIdle, timestamp) "
        "VALUES (?,?,?,?,?)",
        (employee_code, app_name, window_title, int(is_idle), timestamp),
    )
    conn.commit()
    conn.close()
    log.debug("Activity queued offline")


@_try_queue
def queue_screenshot(
    employee_code: str,
    image_path: str,
    app_name: str,
    window_title: str,
    monitor_count: int,
    timestamp: str,
) -> None:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO screenshot_queue "
        "(employeeCode, imagePath, appName, windowTitle, monitorCount, timestamp) "
        "VALUES (?,?,?,?,?,?)",
        (employee_code, image_path, app_name, window_title, monitor_count, timestamp),
    )
    conn.commit()
    conn.close()
    log.debug("Screenshot queued offline")


@_try_queue
def queue_event(
    employee_code: str, event_type: str, data: dict, timestamp: str
) -> None:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO event_queue (employeeCode, eventType, data_json, timestamp) "
        "VALUES (?,?,?,?)",
        (employee_code, event_type, json.dumps(data), timestamp),
    )
    conn.commit()
    conn.close()
    log.debug("Event queued offline: %s", event_type)


def get_pending_activities(limit: int = 50) -> list:
    if _db_path is None:
        return []
    try:
        conn = _get_conn()
        rows = conn.execute(
            "SELECT id, employeeCode, appName, windowTitle, isIdle, timestamp "
            "FROM activity_queue WHERE synced=0 ORDER BY id LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        return [
            {
                "id": r["id"],
                "employeeCode": r["employeeCode"],
                "appName": r["appName"],
                "windowTitle": r["windowTitle"],
                "isIdle": bool(r["isIdle"]),
                "timestamp": r["timestamp"],
            }
            for r in rows
        ]
    except Exception as e:
        log.error("Failed to fetch pending activities: %s", e)
        return []


def get_pending_screenshots(limit: int = 10) -> list:
    if _db_path is None:
        return []
    try:
        conn = _get_conn()
        rows = conn.execute(
            "SELECT id, employeeCode, imagePath, appName, windowTitle, monitorCount, timestamp "
            "FROM screenshot_queue WHERE synced=0 ORDER BY id LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        return [
            {
                "id": r["id"],
                "employeeCode": r["employeeCode"],
                "imagePath": r["imagePath"],
                "appName": r["appName"],
                "windowTitle": r["windowTitle"],
                "monitorCount": r["monitorCount"],
                "timestamp": r["timestamp"],
            }
            for r in rows
        ]
    except Exception as e:
        log.error("Failed to fetch pending screenshots: %s", e)
        return []


def get_pending_events(limit: int = 50) -> list:
    if _db_path is None:
        return []
    try:
        conn = _get_conn()
        rows = conn.execute(
            "SELECT id, employeeCode, eventType, data_json, timestamp "
            "FROM event_queue WHERE synced=0 ORDER BY id LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        return [
            {
                "id": r["id"],
                "employeeCode": r["employeeCode"],
                "eventType": r["eventType"],
                "data": json.loads(r["data_json"]),
                "timestamp": r["timestamp"],
            }
            for r in rows
        ]
    except Exception as e:
        log.error("Failed to fetch pending events: %s", e)
        return []


def mark_synced(table: str, record_id: int) -> None:
    if _db_path is None:
        return
    # Allowlist table names to prevent SQL injection
    _ALLOWED_TABLES = {"activity_queue", "screenshot_queue", "event_queue"}
    if table not in _ALLOWED_TABLES:
        log.error("mark_synced: unknown table %r", table)
        return
    try:
        conn = _get_conn()
        conn.execute(f"UPDATE {table} SET synced=1 WHERE id=?", (record_id,))
        conn.commit()
        conn.close()
    except Exception as e:
        log.error("Failed to mark synced: %s", e)


def cleanup_old_synced(max_age_hours: int = 24) -> None:
    if _db_path is None:
        return
    try:
        cutoff = time.time() - (max_age_hours * 3600)
        conn = _get_conn()
        for table in ("activity_queue", "screenshot_queue", "event_queue"):
            conn.execute(
                f"DELETE FROM {table} WHERE synced=1 AND created_at < ?", (cutoff,)
            )
        conn.commit()
        conn.close()
        log.debug("Cleaned up old synced queue records")
    except Exception as e:
        log.error("Queue cleanup failed: %s", e)
