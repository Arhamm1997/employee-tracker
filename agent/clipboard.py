import time
from logger import log

try:
    import win32clipboard
except ImportError:
    win32clipboard = None
    log.warning("pywin32 not available - clipboard monitoring disabled")

_last_content = ""


def _get_clipboard_text() -> str:
    if win32clipboard is None:
        return ""
    try:
        win32clipboard.OpenClipboard()
        try:
            data = win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
            return str(data) if data else ""
        except TypeError:
            return ""
        finally:
            win32clipboard.CloseClipboard()
    except Exception:
        return ""


def clipboard_monitor_loop(cfg: dict, get_active_app_fn, send_clipboard_fn):
    """Check clipboard every 30 seconds, send if changed."""
    global _last_content

    while True:
        try:
            if not cfg.get("clipboardEnabled", False):
                time.sleep(30)
                continue

            content = _get_clipboard_text()
            if content and content != _last_content:
                _last_content = content
                app_info = get_active_app_fn()
                send_clipboard_fn(cfg, {
                    "employeeCode": cfg["employeeCode"],
                    "content": content[:500],
                    "appName": app_info.get("appName", "Unknown"),
                })
                log.debug("Clipboard change detected and sent")
        except Exception as e:
            log.error("Clipboard monitor error: %s", e)

        time.sleep(30)
