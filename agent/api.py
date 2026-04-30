"""
Agent → Server HTTP client.

Features added for production reliability:
  - Per-endpoint back-off state: each endpoint tracks its own cool-down independently.
  - Exponential back-off with full-jitter on 429 / 5xx responses.
  - Retry-After header respected (server wins over our own schedule).
  - Minimum inter-request interval per endpoint (prevents heartbeat storms).
  - All sensitive paths (keylog, clipboard) require explicit opt-in via cfg flags.
"""

import time
import random
import threading
import requests
from logger import log
from version import AGENT_VERSION, BUILD_ARCH

# ── Session ───────────────────────────────────────────────────────────────────

_session = requests.Session()
_session.headers.update({"Content-Type": "application/json"})

TIMEOUT = 15

# ── Back-off state ────────────────────────────────────────────────────────────
# Each endpoint key maps to (retry_after_unix_ts, consecutive_429_count).
# Access is protected by a per-key lock so concurrent threads don't stomp each
# other.

_BACKOFF_BASE = 2.0       # seconds for first back-off interval
_BACKOFF_CAP = 300.0      # maximum back-off ceiling (5 minutes)
_MIN_INTERVALS: dict[str, float] = {
    # endpoint_key → minimum seconds between successive calls
    "heartbeat":       10.0,
    "keylog":          30.0,
    "clipboard":       30.0,
    "screenshot":       5.0,
    "error-report":    60.0,
    "check-update":   300.0,
    "_default":         5.0,
}

_backoff_lock = threading.Lock()
# endpoint → {"retry_after": float, "count": int, "last_sent": float}
_backoff: dict[str, dict] = {}


def _endpoint_key(path: str) -> str:
    """Extract a short name from an API path for per-endpoint tracking."""
    return path.strip("/").split("/")[-1] or "_default"


def _is_rate_limited(key: str) -> bool:
    with _backoff_lock:
        state = _backoff.get(key, {})
        now = time.monotonic()
        retry_after = state.get("retry_after", 0.0)
        last_sent = state.get("last_sent", 0.0)
        min_interval = _MIN_INTERVALS.get(key, _MIN_INTERVALS["_default"])

        if now < retry_after:
            remaining = retry_after - now
            log.debug("Rate-limited on %s — %.0fs remaining", key, remaining)
            return True
        if now - last_sent < min_interval:
            return True
        return False


def _record_success(key: str) -> None:
    with _backoff_lock:
        state = _backoff.setdefault(key, {})
        state["count"] = 0
        state["retry_after"] = 0.0
        state["last_sent"] = time.monotonic()


def _record_rate_limit(key: str, retry_after_header: str | None) -> None:
    with _backoff_lock:
        state = _backoff.setdefault(key, {})
        count = state.get("count", 0) + 1
        state["count"] = count
        now = time.monotonic()

        if retry_after_header:
            try:
                wait = float(retry_after_header)
            except ValueError:
                wait = _BACKOFF_BASE * (2 ** count)
        else:
            # Full-jitter exponential back-off
            cap = min(_BACKOFF_CAP, _BACKOFF_BASE * (2 ** count))
            wait = random.uniform(0, cap)

        state["retry_after"] = now + wait
        state["last_sent"] = now
        log.warning(
            "Rate-limited on %s (attempt %d) — backing off %.0fs",
            key,
            count,
            wait,
        )


# ── URL / header helpers ───────────────────────────────────────────────────────

def _url(cfg: dict, path: str) -> str:
    base = cfg.get("serverUrl", "").rstrip("/")
    return f"{base}/api/agent{path}"


def _headers(cfg: dict) -> dict:
    return {"x-agent-token": cfg.get("agentToken", "")}


def _versioned_headers(cfg: dict) -> dict:
    """Headers that include agent version and architecture for server-side tracking."""
    return {
        "x-agent-token": cfg.get("agentToken", ""),
        "x-agent-version": AGENT_VERSION,
        "x-agent-arch": BUILD_ARCH,
    }


# ── Generic request wrapper ───────────────────────────────────────────────────

def _post(cfg: dict, path: str, payload: dict, *, timeout: int = TIMEOUT,
          versioned: bool = False) -> dict | None:
    """
    POST helper with 429 back-off, min-interval throttle, and Retry-After support.
    Returns the parsed JSON on success, None on any failure.
    """
    key = _endpoint_key(path)
    if _is_rate_limited(key):
        return None
    headers = _versioned_headers(cfg) if versioned else _headers(cfg)
    try:
        r = _session.post(_url(cfg, path), headers=headers, json=payload, timeout=timeout)
        if r.status_code == 200:
            _record_success(key)
            return r.json()
        if r.status_code == 429:
            _record_rate_limit(key, r.headers.get("Retry-After"))
            return None
        log.warning("%s failed: %s", path, r.status_code)
        return None
    except requests.ConnectionError:
        log.debug("%s: server unreachable", path)
        return None
    except requests.Timeout:
        log.debug("%s: request timed out", path)
        return None
    except Exception as e:
        log.error("%s error: %s", path, e)
        return None


def _get(cfg: dict, path: str, *, params: dict | None = None,
         extra_headers: dict | None = None, timeout: int = TIMEOUT) -> dict | None:
    key = _endpoint_key(path)
    if _is_rate_limited(key):
        return None
    headers = {**_headers(cfg), **(extra_headers or {})}
    try:
        r = _session.get(_url(cfg, path), headers=headers, params=params, timeout=timeout)
        if r.status_code == 200:
            _record_success(key)
            return r.json()
        if r.status_code == 429:
            _record_rate_limit(key, r.headers.get("Retry-After"))
            return None
        log.warning("%s failed: %s", path, r.status_code)
        return None
    except Exception as e:
        log.error("%s error: %s", path, e)
        return None


# ── Public API functions ───────────────────────────────────────────────────────

def verify_token(cfg: dict) -> dict | None:
    try:
        r = _session.get(
            _url(cfg, "/verify"),
            headers=_headers(cfg),
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("Token verify failed: %s", r.status_code)
        return {"valid": False, "error": "auth", "status": r.status_code}
    except requests.ConnectionError:
        log.error("Server unreachable at %s", cfg.get("serverUrl"))
        return {"valid": False, "error": "unreachable"}
    except requests.Timeout:
        return {"valid": False, "error": "timeout"}
    except Exception as e:
        log.error("Token verify error: %s", e)
        return None


def send_heartbeat(cfg: dict, data: dict) -> dict | None:
    return _post(cfg, "/heartbeat", data, versioned=True)


def upload_screenshot(cfg: dict, file_path: str, metadata: dict) -> dict | None:
    key = "screenshot"
    if _is_rate_limited(key):
        return None
    try:
        with open(file_path, "rb") as f:
            headers = {"x-agent-token": cfg.get("agentToken", "")}
            r = _session.post(
                _url(cfg, "/screenshot"),
                headers=headers,
                files={"screenshot": ("screenshot.jpg", f, "image/jpeg")},
                data=metadata,
                timeout=30,
            )
        if r.status_code == 200:
            _record_success(key)
            return r.json()
        if r.status_code == 429:
            _record_rate_limit(key, r.headers.get("Retry-After"))
            return None
        log.warning("Screenshot upload failed: %s", r.status_code)
        return None
    except Exception as e:
        log.error("Screenshot upload error: %s", e)
        return None


def send_browser_history(cfg: dict, history: list) -> dict | None:
    return _post(cfg, "/browser-history", {"employeeCode": cfg["employeeCode"], "history": history})


def send_usb_event(cfg: dict, event: dict) -> dict | None:
    return _post(cfg, "/usb-event", event)


def send_clipboard(cfg: dict, data: dict) -> dict | None:
    """
    Send clipboard event.

    CONSENT REQUIRED: only called when cfg['clipboardEnabled'] is explicitly True.
    The caller (agent.py) is responsible for the consent check; this function
    adds a second safety check so it cannot be called accidentally.
    """
    if not cfg.get("clipboardEnabled", False):
        log.debug("Clipboard sending skipped — clipboardEnabled=False (opt-in required)")
        return None
    return _post(cfg, "/clipboard", data)


def send_new_software(cfg: dict, data: dict) -> dict | None:
    return _post(cfg, "/new-software", data)


def send_shutdown(cfg: dict) -> dict | None:
    try:
        r = _session.post(
            _url(cfg, "/shutdown"),
            headers=_headers(cfg),
            json={"employeeCode": cfg.get("employeeCode", "")},
            timeout=5,
        )
        return r.json() if r.status_code == 200 else None
    except Exception as e:
        log.error("Shutdown report error: %s", e)
        return None


def get_pending_command(cfg: dict) -> dict | None:
    return _get(cfg, "/command")


def send_keylog(cfg: dict, app_name: str, keys: str) -> dict | None:
    """
    Send a keylog entry.

    CONSENT REQUIRED: only sent when cfg['keylogEnabled'] is explicitly True.
    This function adds a defence-in-depth check on top of the caller check.
    """
    if not cfg.get("keylogEnabled", False):
        log.debug("Keylog sending skipped — keylogEnabled=False (opt-in required)")
        return None
    return _post(cfg, "/keylog", {
        "employeeCode": cfg.get("employeeCode", ""),
        "appName": app_name,
        "keys": keys,
    })


def send_file_activity(cfg: dict, activities: list) -> dict | None:
    return _post(cfg, "/file-activity", {
        "employeeCode": cfg.get("employeeCode", ""),
        "activities": activities,
    })


def send_print_log(cfg: dict, printer: str, document: str, pages: int, app_name: str) -> dict | None:
    return _post(cfg, "/print-log", {
        "employeeCode": cfg.get("employeeCode", ""),
        "printer": printer,
        "document": document,
        "pages": pages,
        "appName": app_name,
    })


def send_live_frame(cfg: dict, jpeg_bytes: bytes) -> dict | None:
    try:
        r = _session.post(
            _url(cfg, "/live-frame"),
            headers={"x-agent-token": cfg.get("agentToken", "")},
            files={"frame": ("frame.jpg", jpeg_bytes, "image/jpeg")},
            data={"employeeCode": cfg.get("employeeCode", "")},
            timeout=10,
        )
        return r.json() if r.status_code == 200 else None
    except Exception as e:
        log.error("Live frame send error: %s", e)
        return None


def send_error_report(cfg: dict, errors: list) -> dict | None:
    if not errors:
        return None
    return _post(cfg, "/error-report", {
        "employeeCode": cfg.get("employeeCode", "UNKNOWN"),
        "errors": errors,
    })


def check_update(cfg: dict, current_version: str) -> dict | None:
    return _get(
        cfg,
        "/check-update",
        extra_headers={
            "x-agent-version": current_version,
            "x-agent-arch": BUILD_ARCH,
        },
    )
