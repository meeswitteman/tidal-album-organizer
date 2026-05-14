from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum


class TagBase(BaseModel):
    name: str
    color: str = "#6ee7b7"


class TagCreate(TagBase):
    pass


class TagResponse(TagBase):
    id: int

    model_config = {"from_attributes": True}


class AlbumBase(BaseModel):
    id: str
    title: str
    artist: Optional[str] = None
    artist_id: Optional[str] = None
    year: Optional[int] = None
    cover_url: Optional[str] = None
    num_tracks: Optional[int] = None
    tidal_url: Optional[str] = None


class AlbumResponse(AlbumBase):
    notes: str = ""
    added_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None
    genres: Optional[List[str]] = None
    audio_modes: Optional[List[str]] = None
    tags: List[TagResponse] = []

    model_config = {"from_attributes": True}


class AlbumDetail(AlbumResponse):
    wikipedia_summary: Optional[str] = None
    wikipedia_url: Optional[str] = None
    wikipedia_thumbnail: Optional[str] = None
    wikipedia_source: Optional[str] = None
    review_links: Optional[List[dict]] = None
    tracks: Optional[List[dict]] = None


class AlbumNotesUpdate(BaseModel):
    notes: str


class PlaylistCreate(BaseModel):
    name: str
    description: str = ""
    album_ids: List[str]


class PlaylistFromTidal(BaseModel):
    source_playlist_name: str
    new_name: str
    description: str = ""


class MergeFromTidal(BaseModel):
    source_playlist_name: str


class MergeResult(BaseModel):
    added_albums: int
    skipped_albums: int
    added_tracks: int


# AlbumList schemas
class AlbumListCreate(BaseModel):
    name: str
    description: str = ""


class AlbumListUpdate(BaseModel):
    name: str
    description: str = ""


class AlbumListItemResponse(BaseModel):
    id: int
    album_id: str
    position: int
    added_at: Optional[datetime] = None
    album: "AlbumResponse"

    model_config = {"from_attributes": True}


class AlbumListResponse(BaseModel):
    id: int
    name: str
    description: str
    created_at: Optional[datetime] = None
    items: List[AlbumListItemResponse] = []

    model_config = {"from_attributes": True}


class AlbumListSummary(BaseModel):
    id: int
    name: str
    description: str
    created_at: Optional[datetime] = None
    album_count: int = 0

    model_config = {"from_attributes": True}


class AlbumListAddItems(BaseModel):
    album_ids: List[str]


class AlbumListRemoveItems(BaseModel):
    album_ids: List[str]


class AlbumListReorder(BaseModel):
    item_ids: List[int]


class SortMode(str, Enum):
    manual = "manual"
    date_added = "date_added"
    artist = "artist"
    title = "title"
    year = "year"


class AlbumListSort(BaseModel):
    mode: SortMode


class ExportMode(str, Enum):
    full = "full"
    first = "first"
    random = "random"
    long = "long"


class AlbumListExport(BaseModel):
    playlist_name: str
    mode: ExportMode = ExportMode.full
    min_duration: int = 600


class ExportResult(BaseModel):
    playlist_name: str
    tidal_url: Optional[str] = None
    albums_processed: int
    tracks_added: int


class ImportFromPlaylistsBody(BaseModel):
    playlist_ids: List[str]


class ImportFromPlaylistsResult(BaseModel):
    added: int
    skipped: int
    total_found: int


class PlaylistResponse(BaseModel):
    id: str
    name: str
    description: str = ""
    track_count: int = 0
    tidal_url: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AuthStatus(BaseModel):
    logged_in: bool
    username: Optional[str] = None


class LoginStart(BaseModel):
    verification_url: str
    user_code: str


class SyncResult(BaseModel):
    added: int
    updated: int
    total: int
    new_album_ids: List[str] = []


class ReimportResult(BaseModel):
    added: int
    updated: int
    total: int
    sources: dict
