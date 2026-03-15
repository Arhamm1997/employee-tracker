import os
import sys
from logger import log

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError:
    pystray = None
    Image = ImageDraw = None
    log.warning("pystray/Pillow not available - tray icon disabled")

VERSION = "1.0.0"
_icon = None
_connected = False


def _create_icon_image(color: str = "green") -> "Image.Image":
    """Create a simple colored circle icon."""
    fill = "#22c55e" if color == "green" else "#ef4444"
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([4, 4, 60, 60], fill=fill, outline="#1e1e2e", width=2)
    draw.ellipse([20, 20, 44, 44], fill="white")
    return img


def _load_icon_file() -> "Image.Image | None":
    """Try to load monitor.ico from bundle or current dir."""
    locations = []
    if getattr(sys, "frozen", False):
        locations.append(os.path.join(sys._MEIPASS, "monitor.ico"))
    locations.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "monitor.ico"))

    for loc in locations:
        if os.path.exists(loc):
            try:
                return Image.open(loc)
            except Exception:
                pass
    return None


def set_connected(connected: bool):
    global _connected, _icon
    _connected = connected
    if _icon is not None:
        try:
            color = "green" if connected else "red"
            _icon.icon = _load_icon_file() or _create_icon_image(color)
            status = "Connected" if connected else "Disconnected"
            _icon.title = f"Employee Monitor - {status}"
        except Exception as e:
            log.error("Failed to update tray icon: %s", e)


def start_tray():
    global _icon

    if pystray is None or Image is None:
        log.warning("Tray icon unavailable")
        return

    icon_img = _load_icon_file() or _create_icon_image("green")

    menu = pystray.Menu(
        pystray.MenuItem("Employee Monitor", None, enabled=False),
        pystray.MenuItem(
            lambda _: f"Status: {'Connected' if _connected else 'Disconnected'}",
            None,
            enabled=False,
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(f"Version: {VERSION}", None, enabled=False),
    )

    _icon = pystray.Icon(
        name="EmployeeMonitor",
        icon=icon_img,
        title="Employee Monitor - Starting...",
        menu=menu,
    )

    log.info("System tray icon starting")
    _icon.run()
