import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import text, inspect as sa_inspect
from .database import engine
from .models import Base
from .routers import auth, albums, tags, playlists, albumlists, tidal

Base.metadata.create_all(bind=engine)

# Migration: add genres column if missing
with engine.connect() as _conn:
    _cols = [c["name"] for c in sa_inspect(engine).get_columns("albums")]
    if "genres" not in _cols:
        _conn.execute(text("ALTER TABLE albums ADD COLUMN genres JSON"))
        _conn.commit()
    if "audio_modes" not in _cols:
        _conn.execute(text("ALTER TABLE albums ADD COLUMN audio_modes JSON"))
        _conn.commit()
    if "mbid" not in _cols:
        _conn.execute(text("ALTER TABLE albums ADD COLUMN mbid TEXT"))
        _conn.commit()
    if "review_links" not in _cols:
        _conn.execute(text("ALTER TABLE albums ADD COLUMN review_links JSON"))
        _conn.commit()
    if "artist_id" not in _cols:
        _conn.execute(text("ALTER TABLE albums ADD COLUMN artist_id TEXT"))
        _conn.commit()

app = FastAPI(title="Tidal Organizer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(albums.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(playlists.router, prefix="/api")
app.include_router(albumlists.router, prefix="/api")
app.include_router(tidal.router, prefix="/api")

# Serve built React app — works both in dev and as frozen exe
if getattr(sys, "frozen", False):
    frontend_dist = Path(sys._MEIPASS) / "frontend_dist"  # type: ignore[attr-defined]
else:
    frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"

if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
