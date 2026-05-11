"""
Desktop launcher: starts FastAPI in a thread, opens pywebview window.
For development, run backend and frontend separately (see README).
"""
import threading
import uvicorn
import webview
from backend.main import app

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

if __name__ == "__main__":
    t = threading.Thread(target=run_server, daemon=True)
    t.start()

    import time
    time.sleep(1.5)  # give uvicorn a moment to start

    webview.create_window(
        "Tidal Organizer",
        "http://127.0.0.1:8000",
        width=1280,
        height=800,
        min_size=(900, 600),
    )
    webview.start()
