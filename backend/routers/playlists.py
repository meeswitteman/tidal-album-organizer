from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from ..database import get_db
from ..models import Album, Playlist
from ..schemas import PlaylistCreate, PlaylistFromTidal, MergeFromTidal, MergeResult, PlaylistResponse
from ..services.tidal_service import tidal_service

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.get("", response_model=List[PlaylistResponse])
def list_playlists(db: Session = Depends(get_db)):
    return db.query(Playlist).order_by(Playlist.created_at.desc()).all()


@router.post("", response_model=PlaylistResponse, status_code=201)
def create_playlist(body: PlaylistCreate, db: Session = Depends(get_db)):
    if not tidal_service.is_logged_in():
        raise HTTPException(status_code=401, detail="Not logged in to Tidal")

    albums = db.query(Album).filter(Album.id.in_(body.album_ids)).all()
    if not albums:
        raise HTTPException(status_code=400, detail="No valid albums selected")

    # Collect all track IDs from selected albums
    all_track_ids: List[int] = []
    for album in albums:
        try:
            tracks = tidal_service.get_album_tracks(album.id)
            all_track_ids.extend(int(t["id"]) for t in tracks)
        except Exception:
            continue

    if not all_track_ids:
        raise HTTPException(status_code=400, detail="Could not load tracks for selected albums")

    # Create playlist in Tidal
    tidal_pl = tidal_service.create_playlist(body.name, body.description)
    tidal_service.add_tracks_to_playlist(tidal_pl["id"], all_track_ids)

    # Save locally
    playlist = Playlist(
        id=tidal_pl["id"],
        name=body.name,
        description=body.description,
        track_count=len(all_track_ids),
        tidal_url=tidal_pl["tidal_url"],
        created_at=datetime.utcnow(),
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return playlist


@router.post("/from-tidal-playlist", response_model=PlaylistResponse, status_code=201)
def create_from_tidal_playlist(body: PlaylistFromTidal, db: Session = Depends(get_db)):
    if not tidal_service.is_logged_in():
        raise HTTPException(status_code=401, detail="Not logged in to Tidal")

    # Zoek de bronplaylist op naam
    source = tidal_service.find_playlist_by_name(body.source_playlist_name)
    if not source:
        raise HTTPException(status_code=404, detail=f"Tidal playlist '{body.source_playlist_name}' niet gevonden")

    # Haal unieke album-IDs op uit de bronplaylist
    album_ids = tidal_service.get_album_ids_from_playlist(source["id"])
    if not album_ids:
        raise HTTPException(status_code=400, detail="Geen albums gevonden in bronplaylist")

    # Zorg dat albums in de lokale DB zitten
    existing_ids = {a.id for a in db.query(Album.id).filter(Album.id.in_(album_ids)).all()}
    for album_id in album_ids:
        if album_id not in existing_ids:
            try:
                tidal_album = tidal_service.session.album(int(album_id))
                data = tidal_service._album_to_dict(tidal_album)
                db.add(Album(
                    id=data["id"], title=data["title"], artist=data["artist"],
                    year=data["year"], cover_url=data["cover_url"],
                    num_tracks=data["num_tracks"], duration=data["duration"],
                    tidal_url=data["tidal_url"],
                ))
            except Exception:
                continue
    db.commit()

    # Verzamel alle tracks van de albums
    all_track_ids: List[int] = []
    for album_id in album_ids:
        try:
            tracks = tidal_service.get_album_tracks(album_id)
            all_track_ids.extend(int(t["id"]) for t in tracks)
        except Exception:
            continue

    if not all_track_ids:
        raise HTTPException(status_code=400, detail="Kon geen tracks laden")

    # Maak Tidal playlist aan
    tidal_pl = tidal_service.create_playlist(body.new_name, body.description)
    tidal_service.add_tracks_to_playlist(tidal_pl["id"], all_track_ids)

    playlist = Playlist(
        id=tidal_pl["id"],
        name=body.new_name,
        description=body.description or f"Albums uit '{body.source_playlist_name}'",
        track_count=len(all_track_ids),
        tidal_url=tidal_pl["tidal_url"],
        created_at=datetime.utcnow(),
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return playlist


@router.post("/{playlist_id}/add-from-tidal-playlist", response_model=MergeResult)
def add_from_tidal_playlist(playlist_id: str, body: MergeFromTidal, db: Session = Depends(get_db)):
    if not tidal_service.is_logged_in():
        raise HTTPException(status_code=401, detail="Not logged in to Tidal")

    source = tidal_service.find_playlist_by_name(body.source_playlist_name)
    if not source:
        raise HTTPException(status_code=404, detail=f"Tidal playlist '{body.source_playlist_name}' niet gevonden")

    # Albums al in doelplaylist
    existing_album_ids = set(tidal_service.get_album_ids_from_playlist(playlist_id))

    # Albums uit bronplaylist
    source_album_ids = tidal_service.get_album_ids_from_playlist(source["id"])

    new_album_ids = [a for a in source_album_ids if a not in existing_album_ids]
    skipped = len(source_album_ids) - len(new_album_ids)

    if not new_album_ids:
        return MergeResult(added_albums=0, skipped_albums=skipped, added_tracks=0)

    # Zorg dat nieuwe albums in lokale DB zitten
    existing_local = {a.id for a in db.query(Album.id).filter(Album.id.in_(new_album_ids)).all()}
    for album_id in new_album_ids:
        if album_id not in existing_local:
            try:
                tidal_album = tidal_service.session.album(int(album_id))
                data = tidal_service._album_to_dict(tidal_album)
                db.add(Album(
                    id=data["id"], title=data["title"], artist=data["artist"],
                    year=data["year"], cover_url=data["cover_url"],
                    num_tracks=data["num_tracks"], duration=data["duration"],
                    tidal_url=data["tidal_url"],
                ))
            except Exception:
                continue
    db.commit()

    # Verzamel tracks van nieuwe albums
    all_track_ids: List[int] = []
    for album_id in new_album_ids:
        try:
            tracks = tidal_service.get_album_tracks(album_id)
            all_track_ids.extend(int(t["id"]) for t in tracks)
        except Exception:
            continue

    if all_track_ids:
        tidal_service.add_tracks_to_playlist(playlist_id, all_track_ids)

    # Update lokale track count
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if pl:
        pl.track_count += len(all_track_ids)
        db.commit()

    return MergeResult(added_albums=len(new_album_ids), skipped_albums=skipped, added_tracks=len(all_track_ids))


@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(playlist_id: str, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    db.delete(playlist)
    db.commit()
