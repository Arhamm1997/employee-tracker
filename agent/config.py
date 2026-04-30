"""
Config loader/saver with graceful fallback when ProgramData is not writable.

Primary location:  C:\\ProgramData\\EmployeeMonitor\\config.json  (requires admin)
Fallback location: %LOCALAPPDATA%\\EmployeeMonitor\\config.json   (always writable)
"""

import os
import json
from logger import log

_PRIMARY_DIR = r"C:\ProgramData\EmployeeMonitor"
_FALLBACK_DIR = os.path.join(os.getenv("LOCALAPPDATA", os.path.expanduser("~")), "EmployeeMonitor")

# Resolved at first load: whichever location the config actually lives in
_active_config_path: str | None = None


def _config_path() -> str:
    """Return the path where config.json exists, or the primary path if neither."""
    primary = os.path.join(_PRIMARY_DIR, "config.json")
    fallback = os.path.join(_FALLBACK_DIR, "config.json")
    if os.path.isfile(primary):
        return primary
    if os.path.isfile(fallback):
        return fallback
    return primary  # default write target


DEFAULT_CONFIG = {
    "employeeCode": "",
    "agentToken": "",
    "serverUrl": "http://localhost:5001",
    "screenshotInterval": 10,
    "screenshotQuality": 60,
    "idleThreshold": 5,
    "screenshotsEnabled": True,
    "browserHistoryEnabled": True,
    "usbMonitoringEnabled": True,
    "clipboardEnabled": False,
    "blockedSites": [],
    "showTrayIcon": False,
}


def config_exists() -> bool:
    primary = os.path.join(_PRIMARY_DIR, "config.json")
    fallback = os.path.join(_FALLBACK_DIR, "config.json")
    return os.path.isfile(primary) or os.path.isfile(fallback)


def load_config() -> dict:
    path = _config_path()
    try:
        with open(path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        merged = {**DEFAULT_CONFIG, **cfg}
        log.info("Config loaded from %s", path)
        return merged
    except Exception as e:
        log.error("Failed to load config: %s", e)
        return dict(DEFAULT_CONFIG)


def save_config(cfg: dict) -> None:
    """Save config, using primary path first; fall back to LocalAppData on PermissionError."""
    global _active_config_path

    primary = os.path.join(_PRIMARY_DIR, "config.json")
    fallback = os.path.join(_FALLBACK_DIR, "config.json")

    # Try to write to the same location the config was last loaded from
    targets = [_active_config_path] if _active_config_path else []
    if primary not in targets:
        targets.append(primary)
    if fallback not in targets:
        targets.append(fallback)

    for path in targets:
        if path is None:
            continue
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2)
            _active_config_path = path
            log.info("Config saved to %s", path)
            return
        except PermissionError:
            log.warning("Permission denied writing to %s — trying fallback", path)
        except Exception as e:
            log.error("Failed to save config to %s: %s", path, e)

    log.error("Could not save config to any location")


def update_config(updates: dict) -> dict:
    cfg = load_config()
    cfg.update(updates)
    save_config(cfg)
    return cfg


def bootstrap_config(pre_filled: dict) -> None:
    """Write config only if it does not already exist (first-run setup)."""
    if not config_exists():
        save_config({**DEFAULT_CONFIG, **pre_filled})
        log.info("Bootstrap config written.")
    else:
        log.info("Config exists — skipping bootstrap.")
