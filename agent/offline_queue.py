import os
import sqlite3
import json
import time
from logger import log

DB_PATH = r"C:\ProgramData\EmployeeMonitor\queue.db"


def _get_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
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
    conn.close()
    log.info("Offline queue DB initialized")


def queue_activity(employee_code: str, app_name: str, window_title: str, is_idle: bool, timestamp: str):
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO activity_queue (employeeCode, appName, windowTitle, isIdle, timestamp) VALUES (?,?,?,?,?)",
            (employee_code, app_name, window_title, int(is_idle), timestamp),
        )
        conn.commit()
        conn.close()
        log.debug("Activity queued offline")
    except Exception as e:
        log.error("Failed to queue activity: %s", e)


def queue_screenshot(employee_code: str, image_path: str, app_name: str, window_title: str, monitor_count: int, timestamp: str):
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO screenshot_queue (employeeCode, imagePath, appName, windowTitle, monitorCount, timestamp) VALUES (?,?,?,?,?,?)",
            (employee_code, image_path, app_name, window_title, monitor_count, timestamp),
        )
        conn.commit()
        conn.close()
        log.debug("Screenshot queued offline")
    except Exception as e:
        log.error("Failed to queue screenshot: %s", e)


def queue_event(employee_code: str, event_type: str, data: dict, timestamp: str):
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO event_queue (employeeCode, eventType, data_json, timestamp) VALUES (?,?,?,?)",
            (employee_code, event_type, json.dumps(data), timestamp),
        )
        conn.commit()
        conn.close()
        log.debug("Event queued offline: %s", event_type)
    except Exception as e:
        log.error("Failed to queue event: %s", e)


def get_pending_activities(limit: int = 50) -> list:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, employeeCode, appName, windowTitle, isIdle, timestamp FROM activity_queue WHERE synced=0 ORDER BY id LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [{"id": r[0], "employeeCode": r[1], "appName": r[2], "windowTitle": r[3], "isIdle": bool(r[4]), "timestamp": r[5]} for r in rows]


def get_pending_screenshots(limit: int = 10) -> list:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, employeeCode, imagePath, appName, windowTitle, monitorCount, timestamp FROM screenshot_queue WHERE synced=0 ORDER BY id LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [{"id": r[0], "employeeCode": r[1], "imagePath": r[2], "appName": r[3], "windowTitle": r[4], "monitorCount": r[5], "timestamp": r[6]} for r in rows]


def get_pending_events(limit: int = 50) -> list:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, employeeCode, eventType, data_json, timestamp FROM event_queue WHERE synced=0 ORDER BY id LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [{"id": r[0], "employeeCode": r[1], "eventType": r[2], "data": json.loads(r[3]), "timestamp": r[4]} for r in rows]


def mark_synced(table: str, record_id: int):
    try:
        conn = _get_conn()
        conn.execute(f"UPDATE {table} SET synced=1 WHERE id=?", (record_id,))
        conn.commit()
        conn.close()
    except Exception as e:
        log.error("Failed to mark synced: %s", e)


def cleanup_old_synced(max_age_hours: int = 24):
    try:
        cutoff = time.time() - (max_age_hours * 3600)
        conn = _get_conn()
        for table in ("activity_queue", "screenshot_queue", "event_queue"):
            conn.execute(f"DELETE FROM {table} WHERE synced=1 AND created_at < ?", (cutoff,))
        conn.commit()
        conn.close()
        log.debug("Cleaned up old synced queue records")
    except Exception as e:
        log.error("Queue cleanup failed: %s", e)
