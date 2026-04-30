"""
Background update checker.

Update flow (atomic, no broken state):
  1. Agent polls /api/agent/check-update every 4 hours (or on WS trigger).
  2. If an update is available, download to TEMP\\EMUpdate\\EmployeeMonitor_new.exe.
  3. Verify SHA-256 checksum AND PE architecture (must match running process).
  4. Write TEMP\\EMUpdate\\UPDATE_READY.lock with the new version string.
  5. Agent calls sys.exit(0); EMWatchdog detects the lock file and atomically
     swaps the exe before restarting — no batch script, no broken state.
"""

import os
import sys
import struct
import hashlib
import tempfile
import threading
import requests
from logger import log
from version import AGENT_VERSION, BUILD_ARCH

_trigger = threading.Event()
_UPDATE_DIR = os.path.join(tempfile.gettempdir(), "EMUpdate")
_UPDATE_EXE = os.path.join(_UPDATE_DIR, "EmployeeMonitor_new.exe")
_UPDATE_LOCK = os.path.join(_UPDATE_DIR, "UPDATE_READY.lock")


def trigger_check() -> None:
    """Force an immediate update check (called from WebSocket handler)."""
    _trigger.set()


# ── Architecture helpers ───────────────────────────────────────────────────────

def _current_arch() -> str:
    """Return '64' or '32' for the running Python interpreter."""
    return "64" if struct.calcsize("P") * 8 == 64 else "32"


def _verify_executable(path: str, expected_arch: str | None = None) -> bool:
    """
    Verify that a downloaded executable is:
    - Large enough to be a real PyInstaller bundle (> 1 MB)
    - The correct CPU architecture (if expected_arch is given)
    - A valid PE file (catches corrupted downloads)

    Returns True if all checks pass.
    """
    try:
        file_size = os.path.getsize(path)
        if file_size < 1_000_000:
            log.error(
                "Downloaded file too small (%d bytes) — likely corrupted or wrong file",
                file_size,
            )
            return False

        # Check PE header (first 2 bytes must be 'MZ')
        with open(path, "rb") as f:
            magic = f.read(2)
        if magic != b"MZ":
            log.error("Downloaded file is not a valid Windows executable (bad MZ header)")
            return False

        # Check PE machine type for architecture
        if expected_arch:
            try:
                with open(path, "rb") as f:
                    f.seek(0x3C)  # offset to PE header pointer
                    pe_offset = int.from_bytes(f.read(4), "little")
                    f.seek(pe_offset + 4)  # machine field is 4 bytes after PE signature
                    machine = int.from_bytes(f.read(2), "little")

                # 0x8664 = x64, 0x014c = x86
                actual_arch = "64" if machine == 0x8664 else "32"
                if actual_arch != expected_arch:
                    log.error(
                        "Architecture mismatch: downloaded exe is %s-bit but we need %s-bit",
                        actual_arch,
                        expected_arch,
                    )
                    return False
                log.debug("Architecture check passed: %s-bit", actual_arch)
            except Exception as e:
                log.warning("Could not verify PE architecture: %s — skipping arch check", e)

        return True
    except Exception as e:
        log.error("Executable verification failed: %s", e)
        return False


def _verify_checksum(path: str, expected: str) -> bool:
    sha256 = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        actual = sha256.hexdigest()
        if actual != expected:
            log.error("Checksum mismatch — expected %s, got %s", expected[:16], actual[:16])
            return False
        return True
    except Exception as e:
        log.error("Checksum verification error: %s", e)
        return False


# ── Download & stage update ───────────────────────────────────────────────────

def _download_and_stage(download_url: str, expected_checksum: str | None = None) -> bool:
    """
    Download the new exe, verify it, and write UPDATE_READY.lock.
    Returns True on success. The watchdog will detect the lock and apply the swap.
    """
    os.makedirs(_UPDATE_DIR, exist_ok=True)

    # If the URL is a ZIP, extract the exe from it
    is_zip = download_url.lower().endswith(".zip")
    tmp_download = os.path.join(_UPDATE_DIR, "update_download.zip" if is_zip else "EmployeeMonitor_new.exe")

    try:
        log.info("Downloading update from %s (arch=%s)", download_url, BUILD_ARCH)
        # Pass architecture so server can serve the correct binary
        r = requests.get(
            download_url,
            params={"arch": BUILD_ARCH},
            timeout=120,
            stream=True,
        )
        r.raise_for_status()

        with open(tmp_download, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)
        log.info("Downloaded %d bytes", os.path.getsize(tmp_download))

        # Extract exe from ZIP if needed
        if is_zip:
            import zipfile
            with zipfile.ZipFile(tmp_download, "r") as z:
                all_names = z.namelist()
                agent_names = [
                    n for n in all_names
                    if n.lower().endswith(".exe") and "watchdog" not in n.lower()
                ]
                if not agent_names:
                    agent_names = [n for n in all_names if n.lower().endswith(".exe")]
                if not agent_names:
                    log.error("No .exe found inside ZIP update archive")
                    return False
                log.info("Extracting %s from ZIP", agent_names[0])
                with z.open(agent_names[0]) as src, open(_UPDATE_EXE, "wb") as dst:
                    dst.write(src.read())

                # Also extract watchdog if present
                watchdog_names = [n for n in all_names if "watchdog" in n.lower() and n.lower().endswith(".exe")]
                if watchdog_names and getattr(sys, "frozen", False):
                    watchdog_dest = os.path.join(os.path.dirname(sys.executable), "EMWatchdog_new.exe")
                    with z.open(watchdog_names[0]) as src, open(watchdog_dest, "wb") as dst:
                        dst.write(src.read())
                    log.info("Watchdog staged at %s", watchdog_dest)

            os.remove(tmp_download)
        else:
            # Already saved directly to _UPDATE_EXE
            if tmp_download != _UPDATE_EXE:
                import shutil
                shutil.move(tmp_download, _UPDATE_EXE)

        # Verify downloaded file
        if expected_checksum and not _verify_checksum(_UPDATE_EXE, expected_checksum):
            log.error("Checksum check failed — discarding download")
            os.remove(_UPDATE_EXE)
            return False

        if not _verify_executable(_UPDATE_EXE, BUILD_ARCH):
            log.error("Executable verification failed — discarding download")
            os.remove(_UPDATE_EXE)
            return False

        return True

    except Exception as e:
        log.error("Update download failed: %s", e)
        for f in [tmp_download, _UPDATE_EXE]:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except OSError:
                pass
        return False


# ── Background update loop ────────────────────────────────────────────────────

def check_and_update(cfg: dict) -> None:
    """Background thread: poll for updates every 4 hours or on WS trigger."""
    from api import check_update

    while True:
        try:
            result = check_update(cfg, AGENT_VERSION)
            if result and result.get("hasUpdate") and result.get("downloadUrl"):
                new_version = result.get("version", "?")
                log.info("Update available: %s → %s", AGENT_VERSION, new_version)
                checksum = result.get("checksum")
                if _download_and_stage(result["downloadUrl"], checksum):
                    # Write lock file so watchdog applies the swap on next restart
                    with open(_UPDATE_LOCK, "w") as f:
                        f.write(new_version)
                    log.info(
                        "Update staged (%s) — agent will restart to apply",
                        new_version,
                    )
                    # Gracefully exit; watchdog will detect lock + restart
                    sys.exit(0)
            else:
                log.debug("No update available (current: %s)", AGENT_VERSION)
        except Exception as e:
            log.error("Update check failed: %s", e)

        _trigger.clear()
        _trigger.wait(timeout=4 * 3600)
