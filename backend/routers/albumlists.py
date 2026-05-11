import random as rnd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from ..database import get_db
from ..models import AlbumList, AlbumListItem, Album, Playlist
from ..schemas import (
    AlbumListCreate, AlbumListUpdate, AlbumListResponse, AlbumListSummary,
    AlbumListAddItems, AlbumListRemoveItems, AlbumListReorder,
    AlbumListSort, SortMode, AlbumListExport, ExportResult,
    ImportFromPlaylistsBody, ImportFromPlaylistsResult,
)
from ..services.tidal_service import tidal_service

router = APIRouter(prefix="/albumlists", tags=["albumlists"])


def _get_or_404(db: Session, list_id: int) -> AlbumList:
    obj = db.query(AlbumList).filter(AlbumList.id == list_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="AlbumList niet gevonden")
    return obj


@router.get("", response_model=List[AlbumListSummary])
def list_albumlists(db: Session = Depends(get_db)):
    rows = db.query(AlbumList).order_by(AlbumList.created_at.desc()).all()
    result = []
    for al in rows:
        result.append(AlbumListSummary(
            id=al.id, name=al.name, description=al.description,
            created_at=al.created_at, album_count=len(al.items),
        ))
    return result


@router.post("", response_model=AlbumListResponse, status_code=201)
def create_albumlist(body: AlbumListCreate, db: Session = Depends(get_db)):
    al = AlbumList(name=body.name, description=body.description, created_at=datetime.utcnow())
    db.add(al)
    db.commit()
    db.refresh(al)
    return al


@router.get("/{list_id}", response_model=AlbumListResponse)
def get_albumlist(list_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, list_id)


@router.patch("/{list_id}", response_model=AlbumListResponse)
def update_albumlist(list_id: int, body: AlbumListUpdate, db: Session = Depends(get_db)):
    al = _get_or_404(db, list_id)
    al.name = body.name
    al.description = body.description
    db.commit()
    db.refresh(al)
    return al


@router.delete("/{list_id}", status_code=204)
def delete_albumlist(list_id: int, db: Session = Depends(get_db)):
    al = _get_or_404(db, list_id)
    db.delete(al)
    db.commit()


@router.post("/{list_id}/items", response_model=AlbumListResponse)
def add_items(list_id: int, body: AlbumListAddItems, db: Session = Depends(get_db)):
    al = _get_or_404(db, list_id)
    existing_ids = {item.album_id for item in al.items}
    max_pos = max((item.position for item in al.items), default=-1)

    for album_id in body.album_ids:
        if album_id in existing_ids:
            continue
        album = db.query(Album).filter(Album.id == album_id).first()
        if not album:
            continue
        max_pos += 1
        db.add(AlbumListItem(
            album_list_id=list_id, album_id=album_id,
            position=max_pos, added_at=datetime.utcnow(),
        ))

    db.commit()
    db.refresh(al)
    return al


@router.delete("/{list_id}/items", response_model=AlbumListResponse)
def remove_items(list_id: int, body: AlbumListRemoveItems, db: Session = Depends(get_db)):
    al = _get_or_404(db, list_id)
    remove_set = set(body.album_ids)
    db.query(AlbumListItem).filter(
        AlbumListItem.album_list_id == list_id,
        AlbumListItem.album_id.in_(remove_set),
    ).delete(synchronize_session=False)
    db.commit()
    db.refresh(al)
    return al


@router.put("/{list_id}/order", response_model=AlbumListResponse)
def reorder_items(list_id: int, body: AlbumListReorder, db: Session = Depends(get_db)):
    al = _get_or_404(db, list_id)
    item_map = {item.id: item for item in al.items}
    for pos, item_id in enumerate(body.item_ids):
        if item_id in item_map:
            item_map[item_id].position = pos
    db.commit()
    db.refresh(al)
    return al


@router.post("/{list_id}/sort", response_model=AlbumListResponse)
def sort_items(list_id: int, body: AlbumListSort, db: Session = Depends(get_db)):
    al = _get_or_404(db, list_id)
    items = list(al.items)

    if body.mode == SortMode.date_added:
        items.sort(key=lambda i: i.added_at or datetime.min)
    elif body.mode == SortMode.artist:
        items.sort(key=lambda i: (i.album.artist or "").lower())
    elif body.mode == SortMode.title:
        items.sort(key=lambda i: (i.album.title or "").lower())
    elif body.mode == SortMode.year:
        items.sort(key=lambda i: i.album.year or 0)

    for pos, item in enumerate(items):
        item.position = pos
    db.commit()
    db.refresh(al)
    return al


@router.post("/{list_id}/import-from-playlists", response_model=ImportFromPlaylistsResult)
def import_from_playlists(list_id: int, body: ImportFromPlaylistsBody, db: Session = Depends(get_db)):
    if not tidal_service.is_logged_in():
        raise HTTPException(status_code=401, detail="Niet ingelogd bij Tidal")

    al = _get_or_404(db, list_id)
    existing_album_ids = {item.album_id for item in al.items}
    max_pos = max((item.position for item in al.items), default=-1)

    # Verzamel unieke album-IDs uit alle geselecteerde playlists
    found_album_ids: list[str] = []
    seen: set[str] = set()
    for playlist_id in body.playlist_ids:
        try:
            album_ids = tidal_service.get_album_ids_from_playlist(playlist_id)
            for aid in album_ids:
                if aid not in seen:
                    seen.add(aid)
                    found_album_ids.append(aid)
        except Exception:
            continue

    added = skipped = 0
    for album_id in found_album_ids:
        if album_id in existing_album_ids:
            skipped += 1
            continue

        # Zorg dat album in lokale DB zit
        album = db.query(Album).filter(Album.id == album_id).first()
        if not album:
            try:
                tidal_album = tidal_service.session.album(int(album_id))
                data = tidal_service._album_to_dict(tidal_album)
                album = Album(
                    id=data["id"], title=data["title"], artist=data["artist"],
                    year=data["year"], cover_url=data["cover_url"],
                    num_tracks=data["num_tracks"], duration=data["duration"],
                    tidal_url=data["tidal_url"],
                )
                db.add(album)
                db.flush()
            except Exception:
                skipped += 1
                continue

        max_pos += 1
        db.add(AlbumListItem(
            album_list_id=list_id, album_id=album_id,
            position=max_pos, added_at=datetime.utcnow(),
        ))
        existing_album_ids.add(album_id)
        added += 1

    db.commit()
    return ImportFromPlaylistsResult(added=added, skipped=skipped, total_found=len(found_album_ids))


@router.post("/{list_id}/export", response_model=ExportResult)
def export_albumlist(list_id: int, body: AlbumListExport, db: Session = Depends(get_db)):
    if not tidal_service.is_logged_in():
        raise HTTPException(status_code=401, detail="Niet ingelogd bij Tidal")

    al = _get_or_404(db, list_id)
    if not al.items:
        raise HTTPException(status_code=400, detail="AlbumList is leeg")

    all_track_ids: List[int] = []
    albums_processed = 0

    for item in al.items:
        try:
            tracks = tidal_service.get_album_tracks(item.album_id)
        except Exception:
            continue

        if body.mode == "full":
            selected = [int(t["id"]) for t in tracks]
        elif body.mode == "first":
            first = next((t for t in tracks if t["track_num"] == 1), tracks[0] if tracks else None)
            selected = [int(first["id"])] if first else []
        elif body.mode == "random":
            selected = [int(rnd.choice(tracks)["id"])] if tracks else []
        elif body.mode == "long":
            selected = [int(t["id"]) for t in tracks if t["duration"] >= body.min_duration]

        all_track_ids.extend(selected)
        albums_processed += 1

    if not all_track_ids:
        raise HTTPException(status_code=400, detail="Geen tracks gevonden met deze export-instellingen")

    tidal_pl = tidal_service.create_playlist(body.playlist_name, f"Export van {al.name}")
    tidal_service.add_tracks_to_playlist(tidal_pl["id"], all_track_ids)

    playlist = Playlist(
        id=tidal_pl["id"], name=body.playlist_name,
        description=f"Export van {al.name}",
        track_count=len(all_track_ids),
        tidal_url=tidal_pl["tidal_url"],
        created_at=datetime.utcnow(),
    )
    db.add(playlist)
    db.commit()

    return ExportResult(
        playlist_name=body.playlist_name,
        tidal_url=tidal_pl["tidal_url"],
        albums_processed=albums_processed,
        tracks_added=len(all_track_ids),
    )
