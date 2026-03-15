import os
import json
from logger import log

CONFIG_DIR = r"C:\ProgramData\EmployeeMonitor"
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")

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
}


def config_exists() -> bool:
    return os.path.isfile(CONFIG_PATH)


def load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        merged = {**DEFAULT_CONFIG, **cfg}
        log.info("Config loaded from %s", CONFIG_PATH)
        return merged
    except Exception as e:
        log.error("Failed to load config: %s", e)
        return dict(DEFAULT_CONFIG)


def save_config(cfg: dict) -> None:
    os.makedirs(CONFIG_DIR, exist_ok=True)
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        log.info("Config saved to %s", CONFIG_PATH)
    except Exception as e:
        log.error("Failed to save config: %s", e)


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
