import os
import sys
import time
import threading
import subprocess
import requests
from logger import log

VERSION = "1.0.7"
UPDATE_DIR = r"C:\ProgramData\EmployeeMonitor"

# Set this event to trigger an immediate update check from outside the loop
_trigger = threading.Event()


def trigger_check():
    """Called externally (e.g. from WS message) to force an immediate update check."""
    _trigger.set()


def check_and_update(cfg: dict):
    """Check for updates on startup, then every 4 hours or when triggered via WS."""
    from api import check_update

    while True:
        try:
            result = check_update(cfg, VERSION)
            if result and result.get("hasUpdate") and result.get("downloadUrl"):
                log.info("Update available: %s -> %s", VERSION, result.get("version"))
                _download_and_apply(result["downloadUrl"])
            else:
                log.debug("No update available (current: %s)", VERSION)
        except Exception as e:
            log.error("Update check failed: %s", e)

        # Wait up to 4 hours, but wake immediately if triggered via WS
        _trigger.clear()
        _trigger.wait(timeout=4 * 3600)


def _download_and_apply(download_url: str):
    update_exe = os.path.join(UPDATE_DIR, "update.exe")
    update_zip = os.path.join(UPDATE_DIR, "update.zip")
    try:
        log.info("Downloading update from %s", download_url)
        r = requests.get(download_url, timeout=120, stream=True)
        r.raise_for_status()

        os.makedirs(UPDATE_DIR, exist_ok=True)
        is_zip = download_url.lower().endswith(".zip")
        download_path = update_zip if is_zip else update_exe

        with open(download_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

        log.info("Update downloaded to %s", download_path)

        # If ZIP — extract EmployeeMonitor.exe and EMWatchdog.exe from it
        if is_zip:
            import zipfile
            with zipfile.ZipFile(update_zip, "r") as z:
                all_files = z.namelist()

                # Extract EmployeeMonitor.exe
                agent_names = [n for n in all_files if n.lower().endswith(".exe") and "employeemonitor" in n.lower()]
                if not agent_names:
                    agent_names = [n for n in all_files if n.lower().endswith(".exe") and "watchdog" not in n.lower()]
                if not agent_names:
                    log.error("No EmployeeMonitor.exe found inside ZIP")
                    return
                log.info("Extracting %s from ZIP", agent_names[0])
                with z.open(agent_names[0]) as src, open(update_exe, "wb") as dst:
                    dst.write(src.read())

                # Extract EMWatchdog.exe if present
                watchdog_names = [n for n in all_files if n.lower().endswith(".exe") and "watchdog" in n.lower()]
                update_watchdog = os.path.join(UPDATE_DIR, "update_watchdog.exe")
                if watchdog_names:
                    log.info("Extracting %s from ZIP", watchdog_names[0])
                    with z.open(watchdog_names[0]) as src, open(update_watchdog, "wb") as dst:
                        dst.write(src.read())
                    log.info("Watchdog extracted to %s", update_watchdog)
                else:
                    update_watchdog = None
                    log.info("No EMWatchdog.exe in ZIP — skipping watchdog update")

            os.remove(update_zip)
            log.info("Extracted files from ZIP")

        # Get current exe path
        if getattr(sys, "frozen", False):
            current_exe = sys.executable
        else:
            log.warning("Not running as frozen exe, skipping auto-update apply")
            return

        # Watchdog is next to the main exe
        current_watchdog = os.path.join(os.path.dirname(current_exe), "EMWatchdog.exe")

        # Create update batch script
        bat_path = os.path.join(UPDATE_DIR, "update.bat")

        # Build watchdog update lines if we have a new watchdog
        watchdog_lines = ""
        if is_zip and update_watchdog and os.path.exists(update_watchdog):
            watchdog_lines = f"""
taskkill /F /IM EMWatchdog.exe >nul 2>&1
timeout /t 1 /nobreak >nul
copy /y "{update_watchdog}" "{current_watchdog}"
del "{update_watchdog}"
"""

        bat_content = f"""@echo off
timeout /t 3 /nobreak >nul
{watchdog_lines}
copy /y "{update_exe}" "{current_exe}"
start "" "{current_exe}"
del "%~f0"
"""
        with open(bat_path, "w") as f:
            f.write(bat_content)

        log.info("Applying update and restarting...")
        subprocess.Popen(
            ["cmd.exe", "/c", bat_path],
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        sys.exit(0)

    except Exception as e:
        log.error("Update download/apply failed: %s", e)
        for f in [update_exe, update_zip]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except OSError:
                    pass