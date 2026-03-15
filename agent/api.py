import requests
from logger import log

_session = requests.Session()
_session.headers.update({"Content-Type": "application/json"})

TIMEOUT = 15


def _url(cfg: dict, path: str) -> str:
    base = cfg.get("serverUrl", "").rstrip("/")
    return f"{base}/api/agent{path}"


def _headers(cfg: dict) -> dict:
    return {"x-agent-token": cfg.get("agentToken", "")}


def verify_token(cfg: dict) -> dict | None:
    try:
        r = _session.get(
            _url(cfg, "/verify"),
            headers=_headers(cfg),
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("Token verify failed: %s %s", r.status_code, r.text)
        return {"valid": False, "error": "auth", "status": r.status_code}
    except requests.ConnectionError:
        log.error("Server unreachable at %s", cfg.get("serverUrl"))
        return {"valid": False, "error": "unreachable"}
    except requests.Timeout:
        log.error("Server timeout at %s", cfg.get("serverUrl"))
        return {"valid": False, "error": "timeout"}
    except Exception as e:
        log.error("Token verify error: %s", e)
        return None


def send_heartbeat(cfg: dict, data: dict) -> dict | None:
    try:
        r = _session.post(
            _url(cfg, "/heartbeat"),
            headers=_headers(cfg),
            json=data,
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("Heartbeat failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("Heartbeat error: %s", e)
        return None


def upload_screenshot(cfg: dict, file_path: str, metadata: dict) -> dict | None:
    try:
        with open(file_path, "rb") as f:
            r = _session.post(
                _url(cfg, "/screenshot"),
                headers={
                    "x-agent-token": cfg.get("agentToken", ""),
                    "Content-Type": None,  # Clear JSON default, let requests set multipart automatically
                },
                files={"screenshot": ("screenshot.jpg", f, "image/jpeg")},
                data=metadata,
                timeout=30,
            )
        if r.status_code == 200:
            return r.json()
        log.warning("Screenshot upload failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("Screenshot upload error: %s", e)
        return None


def send_browser_history(cfg: dict, history: list) -> dict | None:
    try:
        r = _session.post(
            _url(cfg, "/browser-history"),
            headers=_headers(cfg),
            json={"employeeCode": cfg["employeeCode"], "history": history},
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("Browser history send failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("Browser history error: %s", e)
        return None


def send_usb_event(cfg: dict, event: dict) -> dict | None:
    try:
        r = _session.post(
            _url(cfg, "/usb-event"),
            headers=_headers(cfg),
            json=event,
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("USB event send failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("USB event error: %s", e)
        return None


def send_clipboard(cfg: dict, data: dict) -> dict | None:
    try:
        r = _session.post(
            _url(cfg, "/clipboard"),
            headers=_headers(cfg),
            json=data,
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("Clipboard send failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("Clipboard error: %s", e)
        return None


def send_new_software(cfg: dict, data: dict) -> dict | None:
    try:
        r = _session.post(
            _url(cfg, "/new-software"),
            headers=_headers(cfg),
            json=data,
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("New software send failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("New software error: %s", e)
        return None


def send_shutdown(cfg: dict) -> dict | None:
    """Report graceful shutdown/logoff to the server."""
    try:
        r = _session.post(
            _url(cfg, "/shutdown"),
            headers=_headers(cfg),
            json={"employeeCode": cfg.get("employeeCode", "")},
            timeout=5,
        )
        if r.status_code == 200:
            return r.json()
        return None
    except Exception as e:
        log.error("Shutdown report error: %s", e)
        return None


def get_pending_command(cfg: dict) -> dict | None:
    """Poll for a pending remote command (lock, shutdown, start_live, stop_live)."""
    try:
        r = _session.get(
            _url(cfg, "/command"),
            headers=_headers(cfg),
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        return None
    except Exception as e:
        log.error("Get command error: %s", e)
        return None


def send_keylog(cfg: dict, app_name: str, keys: str) -> dict | None:
    """Send a single keylog entry (one app session) to the server."""
    try:
        r = _session.post(
            _url(cfg, "/keylog"),
            headers=_headers(cfg),
            json={
                "employeeCode": cfg.get("employeeCode", ""),
                "appName": app_name,
                "keys": keys,
            },
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("Keylog send failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("Keylog send error: %s", e)
        return None


def send_file_activity(cfg: dict, activities: list) -> dict | None:
    """Send a batch of file activity events to the server."""
    try:
        r = _session.post(
            _url(cfg, "/file-activity"),
            headers=_headers(cfg),
            json={
                "employeeCode": cfg.get("employeeCode", ""),
                "activities": activities,
            },
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("File activity send failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("File activity send error: %s", e)
        return None


def send_print_log(cfg: dict, printer: str, document: str, pages: int, app_name: str) -> dict | None:
    """Send a single print job entry to the server."""
    try:
        r = _session.post(
            _url(cfg, "/print-log"),
            headers=_headers(cfg),
            json={
                "employeeCode": cfg.get("employeeCode", ""),
                "printer": printer,
                "document": document,
                "pages": pages,
                "appName": app_name,
            },
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("Print log send failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("Print log send error: %s", e)
        return None


def send_live_frame(cfg: dict, jpeg_bytes: bytes) -> dict | None:
    """Upload a JPEG frame for real-time live screen viewing."""
    try:
        r = _session.post(
            _url(cfg, "/live-frame"),
            headers={"x-agent-token": cfg.get("agentToken", "")},
            files={"frame": ("frame.jpg", jpeg_bytes, "image/jpeg")},
            data={"employeeCode": cfg.get("employeeCode", "")},
            timeout=10,
        )
        if r.status_code == 200:
            return r.json()
        return None
    except Exception as e:
        log.error("Live frame send error: %s", e)
        return None


def send_error_report(cfg: dict, errors: list) -> dict | None:
    """Send buffered WARNING/ERROR log entries to the backend error log."""
    if not errors:
        return None
    try:
        r = _session.post(
            _url(cfg, "/error-report"),
            headers=_headers(cfg),
            json={
                "employeeCode": cfg.get("employeeCode", "UNKNOWN"),
                "errors": errors,
            },
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.debug("Error report send failed: %s", r.status_code)
        return None
    except Exception as e:
        log.debug("Error report send error: %s", e)
        return None


def check_update(cfg: dict, current_version: str) -> dict | None:
    try:
        r = _session.get(
            _url(cfg, "/check-update"),
            headers={
                **_headers(cfg),
                "x-agent-version": current_version,
            },
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("Update check failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("Update check error: %s", e)
        return None
