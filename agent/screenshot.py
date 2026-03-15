import os
import tempfile
import time
from logger import log

try:
    from PIL import ImageGrab, Image
    from screeninfo import get_monitors
except ImportError:
    ImageGrab = Image = None
    get_monitors = None
    log.warning("Pillow/screeninfo not available - screenshots disabled")


def capture_screenshots(quality: int = 60) -> list[str]:
    """Capture all monitors, save as temp JPEG files. Returns list of file paths."""
    if ImageGrab is None:
        return []

    temp_dir = os.path.join(tempfile.gettempdir(), "em_screenshots")
    os.makedirs(temp_dir, exist_ok=True)
    paths = []

    try:
        monitors = []
        if get_monitors:
            try:
                monitors = get_monitors()
            except Exception:
                monitors = []

        if monitors:
            for i, m in enumerate(monitors):
                try:
                    bbox = (m.x, m.y, m.x + m.width, m.y + m.height)
                    img = ImageGrab.grab(bbox=bbox, all_screens=True)
                    path = os.path.join(temp_dir, f"screen_{i}_{int(time.time())}.jpg")
                    img.save(path, "JPEG", quality=quality)
                    paths.append(path)
                    log.debug("Captured monitor %d: %dx%d", i, m.width, m.height)
                except Exception as e:
                    log.error("Failed to capture monitor %d: %s", i, e)
        else:
            # Fallback: capture primary screen
            img = ImageGrab.grab(all_screens=True)
            path = os.path.join(temp_dir, f"screen_0_{int(time.time())}.jpg")
            img.save(path, "JPEG", quality=quality)
            paths.append(path)
            log.debug("Captured primary screen (fallback)")

    except Exception as e:
        log.error("Screenshot capture failed: %s", e)

    return paths


def cleanup_temp_files(paths: list[str]):
    for p in paths:
        try:
            if os.path.exists(p):
                os.remove(p)
        except Exception:
            pass
