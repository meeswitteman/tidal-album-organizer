from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime
from ..database import get_db, SessionLocal
from ..models import Album, Tag
from ..schemas import AlbumResponse, AlbumDetail, AlbumNotesUpdate, SyncResult, ReimportResult, TagResponse
from ..services.tidal_service import tidal_service
from ..services.enrichment_service import get_wikipedia_info, get_musicbrainz_info, get_musicbrainz_url_rels, fallback_review_links
import asyncio

router = APIRouter(prefix="/albums", tags=["albums"])

_enrich_status: dict = {"running": False, "done": 0, "total": 0, "cancel": False}


def _cancelled() -> bool:
    return _enrich_status["cancel"]


async def _sleep_cancellable(seconds: float):
    steps = max(1, int(seconds / 0.1))
    for _ in range(steps):
        if _cancelled():
            return
        await asyncio.sleep(0.1)


async def _do_enrich(album_ids: list):
    db = SessionLocal()
    try:
        for i, aid in enumerate(album_ids):
            if _cancelled():
                break
            album = db.query(Album).filter(Album.id == aid).first()
            if album and album.artist and album.title:
                try:
                    mbid = album.mbid

                    if not album.genres or not mbid:
                        mb = await get_musicbrainz_info(album.artist, album.title)
                        if _cancelled():
                            break
                        if mb.get("genres"):
                            album.genres = mb["genres"]
                        mbid = mb.get("mbid") or mbid
                        if mbid:
                            album.mbid = mbid
                        db.commit()
                        await _sleep_cancellable(1.1)

                    if _cancelled():
                        break

                    if mbid and album.review_links is None:
                        links = await get_musicbrainz_url_rels(mbid)
                        if _cancelled():
                            break
                        album.review_links = links or []
                        db.commit()
                        await _sleep_cancellable(1.1)

                except Exception:
                    pass
            _enrich_status["done"] = i + 1
    finally:
        db.close()
        _enrich_status["running"] = False
        _enrich_status["cancel"] = False


@router.post("/sync", response_model=SyncResult)
def sync_albums(db: Session = Depends(get_db)):
    if not tidal_service.is_logged_in():
        raise HTTPException(status_code=401, detail="Not logged in to Tidal")

    tidal_albums = tidal_service.get_favorite_albums()
    added = 0
    updated = 0
    now = datetime.utcnow()

    for data in tidal_albums:
        existing = db.query(Album).filter(Album.id == data["id"]).first()
        if existing:
            existing.cover_url = data["cover_url"]
            existing.num_tracks = data["num_tracks"]
            existing.audio_modes = data.get("audio_modes")
            existing.synced_at = now
            updated += 1
        else:
            album = Album(
                id=data["id"],
                title=data["title"],
                artist=data["artist"],
                year=data["year"],
                cover_url=data["cover_url"],
                num_tracks=data["num_tracks"],
                duration=data["duration"],
                tidal_url=data["tidal_url"],
                audio_modes=data.get("audio_modes"),
                synced_at=now,
            )
            db.add(album)
            added += 1

    db.commit()
    return SyncResult(added=added, updated=updated, total=len(tidal_albums))


def _upsert_albums(db, albums_data: List[dict], now) -> tuple[int, int]:
    added = updated = 0
    for data in albums_data:
        existing = db.query(Album).filter(Album.id == data["id"]).first()
        if existing:
            existing.cover_url = data["cover_url"]
            existing.num_tracks = data["num_tracks"]
            existing.audio_modes = data.get("audio_modes")
            existing.synced_at = now
            updated += 1
        else:
            db.add(Album(
                id=data["id"], title=data["title"], artist=data["artist"],
                year=data["year"], cover_url=data["cover_url"],
                num_tracks=data["num_tracks"], duration=data["duration"],
                tidal_url=data["tidal_url"], audio_modes=data.get("audio_modes"),
                synced_at=now,
            ))
            added += 1
    return added, updated


@router.post("/reimport", response_model=ReimportResult)
def reimport_albums(db: Session = Depends(get_db)):
    if not tidal_service.is_logged_in():
        raise HTTPException(status_code=401, detail="Not logged in to Tidal")

    now = datetime.utcnow()
    sources = {}

    # 1. Favorieten
    favorites = tidal_service.get_favorite_albums()
    fav_added, fav_updated = _upsert_albums(db, favorites, now)
    db.commit()
    sources["favorieten"] = {"added": fav_added, "updated": fav_updated, "total": len(favorites)}

    # 2. Alle playlists
    playlist_albums = tidal_service.get_all_albums_from_playlists()
    pl_added, pl_updated = _upsert_albums(db, playlist_albums, now)
    db.commit()
    sources["playlists"] = {"added": pl_added, "updated": pl_updated, "total": len(playlist_albums)}

    total_added = fav_added + pl_added
    total_updated = fav_updated + pl_updated
    total = len(favorites) + len(playlist_albums)

    return ReimportResult(added=total_added, updated=total_updated, total=total, sources=sources)


@router.post("/enrich-genres")
async def enrich_genres(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if _enrich_status["running"]:
        return {"status": "already_running", **_enrich_status}
    from sqlalchemy import or_
    albums = db.query(Album.id).filter(
        Album.artist.isnot(None),
        or_(Album.genres.is_(None), Album.review_links.is_(None)),
    ).all()
    album_ids = [a.id for a in albums]
    _enrich_status.update({"running": True, "done": 0, "total": len(album_ids)})
    background_tasks.add_task(_do_enrich, album_ids)
    return {"status": "started", "total": len(album_ids)}


@router.post("/enrich-genres/cancel")
def cancel_enrich():
    if _enrich_status["running"]:
        _enrich_status["cancel"] = True
    return _enrich_status


@router.get("/enrich-genres/status")
def enrich_genres_status():
    return _enrich_status


@router.get("/genres", response_model=List[str])
def get_all_genres(db: Session = Depends(get_db)):
    rows = db.query(Album.genres).filter(Album.genres.isnot(None)).all()
    genres_set: set = set()
    for (genres,) in rows:
        if genres:
            genres_set.update(genres)
    return sorted(genres_set)


@router.get("", response_model=List[AlbumResponse])
def list_albums(
    tag: Optional[List[int]] = Query(default=None),
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    artist: Optional[str] = None,
    title: Optional[str] = None,
    genre: Optional[List[str]] = Query(default=None),
    dolby_atmos: bool = False,
    db: Session = Depends(get_db),
):
    from sqlalchemy import or_
    q = db.query(Album)

    if tag:
        for t in tag:
            q = q.filter(Album.tags.any(Tag.id == t))
    if year_from:
        q = q.filter(Album.year >= year_from)
    if year_to:
        q = q.filter(Album.year <= year_to)
    if artist:
        q = q.filter(Album.artist.ilike(f"%{artist}%"))
    if title:
        q = q.filter(Album.title.ilike(f"%{title}%"))
    if genre:
        genre_conditions = [
            text(f"EXISTS (SELECT 1 FROM json_each(albums.genres) WHERE value = :g{i})")
            .bindparams(**{f"g{i}": g})
            for i, g in enumerate(genre)
        ]
        q = q.filter(or_(*genre_conditions))
    if dolby_atmos:
        q = q.filter(text("EXISTS (SELECT 1 FROM json_each(albums.audio_modes) WHERE value = 'DOLBY_ATMOS')"))

    return q.order_by(Album.artist, Album.year).all()


@router.get("/tracks/{track_id}/url")
def get_track_stream_url(track_id: str):
    if not tidal_service.is_logged_in():
        raise HTTPException(status_code=401, detail="Not logged in to Tidal")
    try:
        track = tidal_service.session.track(int(track_id))
        url = track.get_url()
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{album_id}", response_model=AlbumDetail)
async def get_album(album_id: str, db: Session = Depends(get_db)):
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    detail = AlbumDetail.model_validate(album)

    if album.artist and album.title:
        if album.genres:
            wiki = await get_wikipedia_info(album.artist, album.title)
        else:
            wiki, mb = await asyncio.gather(
                get_wikipedia_info(album.artist, album.title),
                get_musicbrainz_info(album.artist, album.title),
            )
            genres = mb.get("genres")
            if genres:
                album.genres = genres
                db.commit()
                detail.genres = genres
        detail.wikipedia_summary = wiki.get("summary")
        detail.wikipedia_url = wiki.get("url")
        detail.wikipedia_thumbnail = wiki.get("thumbnail")
        detail.wikipedia_source = wiki.get("source")

    if album.review_links is not None:
        detail.review_links = album.review_links
    elif album.artist and album.title:
        detail.review_links = fallback_review_links(album.artist, album.title)

    if tidal_service.is_logged_in():
        try:
            detail.tracks = tidal_service.get_album_tracks(album_id)
        except Exception:
            pass

    return detail


@router.patch("/{album_id}/notes", response_model=AlbumResponse)
def update_notes(album_id: str, body: AlbumNotesUpdate, db: Session = Depends(get_db)):
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    album.notes = body.notes
    db.commit()
    db.refresh(album)
    return album


@router.post("/{album_id}/tags/{tag_id}", response_model=AlbumResponse)
def add_tag(album_id: str, tag_id: int, db: Session = Depends(get_db)):
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag not in album.tags:
        album.tags.append(tag)
        db.commit()
        db.refresh(album)
    return album


@router.delete("/{album_id}/tags/{tag_id}", response_model=AlbumResponse)
def remove_tag(album_id: str, tag_id: int, db: Session = Depends(get_db)):
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if tag and tag in album.tags:
        album.tags.remove(tag)
        db.commit()
        db.refresh(album)
    return album
