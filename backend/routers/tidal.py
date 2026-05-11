from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from ..services.tidal_service import tidal_service

router = APIRouter(prefix="/tidal", tags=["tidal"])


@router.get("/playlists")
def get_tidal_playlists(search: Optional[str] = Query(default=None)):
    if not tidal_service.is_logged_in():
        raise HTTPException(status_code=401, detail="Niet ingelogd bij Tidal")

    playlists = tidal_service.get_user_playlists()

    if search:
        q = search.lower()
        playlists = [p for p in playlists if q in p["name"].lower()]

    return playlists
