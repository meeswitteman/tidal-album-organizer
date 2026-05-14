from pathlib import Path
import os


def get_data_dir() -> Path:
    """Persistent user data directory: %APPDATA%/TidalOrganizer on Windows."""
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home()))
    else:
        base = Path.home() / ".local" / "share"
    data_dir = base / "TidalOrganizer"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir
