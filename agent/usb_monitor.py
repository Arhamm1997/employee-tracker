import time
from logger import log

try:
    import win32file
    import win32api
except ImportError:
    win32file = win32api = None
    log.warning("pywin32 not available - USB monitoring disabled")

# win32file.DRIVE_REMOVABLE == 2
DRIVE_REMOVABLE = 2

_previous_drives: set = set()


def _get_removable_drives() -> set:
    if win32api is None:
        return set()
    try:
        drives = win32api.GetLogicalDriveStrings().split("\x00")
        drives = [d for d in drives if d]
        removable = set()
        for d in drives:
            try:
                if win32file.GetDriveType(d) == DRIVE_REMOVABLE:
                    try:
                        vol_info = win32api.GetVolumeInformation(d)
                        label = vol_info[0] or d
                    except Exception:
                        label = d
                    removable.add((d, label))
            except Exception:
                pass
        return removable
    except Exception as e:
        log.error("Failed to enumerate drives: %s", e)
        return set()


def init_usb_monitor():
    global _previous_drives
    _previous_drives = _get_removable_drives()
    log.info("USB monitor initialized with %d removable drives", len(_previous_drives))


def check_usb_changes() -> list:
    """Returns list of {"deviceName", "deviceType", "action"} events."""
    global _previous_drives
    current = _get_removable_drives()
    events = []

    # New drives
    for drive, label in current - _previous_drives:
        events.append({
            "deviceName": f"{label} ({drive})",
            "deviceType": "usb",
            "action": "connected",
        })
        log.info("USB connected: %s (%s)", label, drive)

    # Removed drives
    for drive, label in _previous_drives - current:
        events.append({
            "deviceName": f"{label} ({drive})",
            "deviceType": "usb",
            "action": "disconnected",
        })
        log.info("USB disconnected: %s (%s)", label, drive)

    _previous_drives = current
    return events


def usb_monitor_loop(cfg: dict, send_event_fn):
    """Continuous loop checking USB every 10 seconds."""
    init_usb_monitor()
    while True:
        try:
            if cfg.get("usbMonitoringEnabled", True):
                events = check_usb_changes()
                for event in events:
                    event["employeeCode"] = cfg["employeeCode"]
                    send_event_fn(cfg, event)
        except Exception as e:
            log.error("USB monitor error: %s", e)
        time.sleep(10)
