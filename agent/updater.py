import os
import sys
import time
import subprocess
import requests
from logger import log

VERSION = "1.0.0"
UPDATE_DIR = r"C:\ProgramData\EmployeeMonitor"


def check_and_update(cfg: dict):
    """Check for updates on startup and every 4 hours."""
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

        # Wait 4 hours before next check
        time.sleep(4 * 3600)


def _download_and_apply(download_url: str):
    update_exe = os.path.join(UPDATE_DIR, "update.exe")
    try:
        log.info("Downloading update from %s", download_url)
        r = requests.get(download_url, timeout=120, stream=True)
        r.raise_for_status()

        os.makedirs(UPDATE_DIR, exist_ok=True)
        with open(update_exe, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

        log.info("Update downloaded to %s", update_exe)

        # Get current exe path
        if getattr(sys, "frozen", False):
            current_exe = sys.executable
        else:
            log.warning("Not running as frozen exe, skipping auto-update apply")
            return

        # Create update batch script
        bat_path = os.path.join(UPDATE_DIR, "update.bat")
        bat_content = f"""@echo off
timeout /t 3 /nobreak > nul
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
        if os.path.exists(update_exe):
            try:
                os.remove(update_exe)
            except OSError:
                pass