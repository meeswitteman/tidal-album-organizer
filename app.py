"""
Desktop launcher: start FastAPI in een thread, open browser, toon tray-icoon.
Voor development: gebruik de Vite dev server en start de backend apart.
"""
import sys
import multiprocessing

# PyInstaller one-file op Windows: freeze_support() MOET als allereerste aanroep staan
# in het if __name__ == "__main__" blok. Hier alvast voor de zekerheid.
multiprocessing.freeze_support()

# Windowed build heeft geen console — redirect stdout/stderr naar een logbestand
# zodat fouten zichtbaar blijven voor debugging.
if getattr(sys, "frozen", False):
    import os
    from pathlib import Path as _Path
    _log = _Path(os.environ.get("APPDATA", _Path.home())) / "TidalOrganizer" / "app.log"
    _log.parent.mkdir(parents=True, exist_ok=True)
    _logfile = open(_log, "w", buffering=1, encoding="utf-8")
    sys.stdout = _logfile
    sys.stderr = _logfile

import asyncio
import threading
import time
import webbrowser

import uvicorn
import httpx
from PIL import Image, ImageDraw
import pystray

from backend.main import app

HOST = "127.0.0.1"
PORT = 8000
URL = f"http://{HOST}:{PORT}"


def run_server():
    # Uvicorn heeft op Windows een SelectorEventLoop nodig; deprecated in 3.15+ maar
    # ProactorEventLoop geeft problemen in threads op oudere versies.
    if sys.platform == "win32":
        try:
            loop = asyncio.SelectorEventLoop()
            asyncio.set_event_loop(loop)
        except Exception:
            pass
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


def wait_for_server(timeout: float = 20.0):
    """Wacht tot de server reageert, maximaal `timeout` seconden."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            httpx.get(f"{URL}/api/auth/status", timeout=1.0)
            return True
        except Exception:
            time.sleep(0.3)
    return False


def make_icon() -> Image.Image:
    """Maak een eenvoudig tray-icoon (lichtblauwe cirkel met witte T)."""
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, size - 1, size - 1], fill="#0AADDC")
    cx = size // 2
    draw.rectangle([cx - 16, 14, cx + 16, 20], fill="white")
    draw.rectangle([cx - 4, 20, cx + 4, 50], fill="white")
    return img


def main():
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    ready = wait_for_server()
    if not ready:
        print("Waarschuwing: server niet bereikbaar na 20s, browser toch openen.")

    webbrowser.open(URL)

    icon_image = make_icon()

    def on_open(_icon, _item):
        webbrowser.open(URL)

    def on_quit(icon, _item):
        icon.stop()
        sys.exit(0)

    tray = pystray.Icon(
        "TidalOrganizer",
        icon_image,
        "Tidal Organizer",
        menu=pystray.Menu(
            pystray.MenuItem("Open Tidal Organizer", on_open, default=True),
            pystray.MenuItem("Afsluiten", on_quit),
        ),
    )
    tray.run()


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
