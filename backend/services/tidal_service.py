import tidalapi
from pathlib import Path
from typing import Optional, List

SESSION_FILE = Path("tidal_session.json")

_login_future = None


class TidalService:
    def __init__(self):
        self.session = tidalapi.Session()
        self._try_load_session()

    def _try_load_session(self):
        if SESSION_FILE.exists():
            try:
                self.session.login_session_file(SESSION_FILE)
            except Exception:
                pass

    def is_logged_in(self) -> bool:
        try:
            return self.session.check_login()
        except Exception:
            return False

    def get_username(self) -> Optional[str]:
        if not self.is_logged_in():
            return None
        try:
            u = self.session.user
            return getattr(u, "username", None) or getattr(u, "first_name", None)
        except Exception:
            return None

    def start_login(self) -> dict:
        global _login_future
        login, future = self.session.login_oauth()
        _login_future = future
        return {
            "verification_url": login.verification_uri_complete,
            "user_code": login.user_code,
        }

    def poll_login(self) -> bool:
        global _login_future
        if _login_future is None:
            return False
        if _login_future.done():
            if self.is_logged_in():
                try:
                    self.session.save_session_to_file(SESSION_FILE)
                except Exception:
                    pass
                return True
        return False

    def get_favorite_albums(self) -> List[dict]:
        result = []
        offset = 0
        page_size = 50
        while True:
            page = self.session.user.favorites.albums(limit=page_size, offset=offset)
            result.extend(page)
            if len(page) < page_size:
                break
            offset += page_size
        return [self._album_to_dict(a) for a in result]

    def get_album_tracks(self, album_id: str) -> List[dict]:
        album = self.session.album(int(album_id))
        tracks = album.tracks()
        return [
            {
                "id": str(t.id),
                "title": t.name,
                "duration": t.duration,
                "track_num": t.track_num,
                "artist": t.artist.name if hasattr(t, "artist") and t.artist else None,
            }
            for t in tracks
        ]

    def create_playlist(self, name: str, description: str = "") -> dict:
        playlist = self.session.user.create_playlist(name, description)
        return {
            "id": str(playlist.id),
            "name": playlist.name,
            "tidal_url": f"https://tidal.com/browse/playlist/{playlist.id}",
        }

    def add_tracks_to_playlist(self, playlist_id: str, track_ids: List[int]):
        playlist = self.session.playlist(playlist_id)
        playlist.add(track_ids)

    def get_all_albums_from_playlists(self) -> List[dict]:
        """Collect unique albums from all user playlists."""
        seen: set[str] = set()
        result: List[dict] = []
        playlists = self.session.user.playlists()
        for pl in playlists:
            try:
                album_ids = self.get_album_ids_from_playlist(str(pl.id))
                for album_id in album_ids:
                    if album_id in seen:
                        continue
                    seen.add(album_id)
                    try:
                        album = self.session.album(int(album_id))
                        result.append(self._album_to_dict(album))
                    except Exception:
                        continue
            except Exception:
                continue
        return result

    def find_playlist_by_name(self, name: str) -> Optional[dict]:
        for p in self.session.user.playlists():
            if p.name.lower() == name.lower():
                return {"id": str(p.id), "name": p.name}
        return None

    def get_album_ids_from_playlist(self, playlist_id: str) -> List[str]:
        playlist = self.session.playlist(playlist_id)
        seen: set[str] = set()
        result: List[str] = []
        offset = 0
        page_size = 50
        while True:
            tracks = playlist.tracks(limit=page_size, offset=offset)
            for t in tracks:
                album_id = str(t.album.id)
                if album_id not in seen:
                    seen.add(album_id)
                    result.append(album_id)
            if len(tracks) < page_size:
                break
            offset += page_size
        return result

    def get_user_playlists(self) -> List[dict]:
        playlists = self.session.user.playlists()
        return [
            {
                "id": str(p.id),
                "name": p.name,
                "description": getattr(p, "description", "") or "",
                "num_tracks": getattr(p, "num_tracks", 0) or 0,
            }
            for p in playlists
        ]

    def _album_to_dict(self, album) -> dict:
        try:
            cover_url = album.image(640)
        except Exception:
            cover_url = None
        return {
            "id": str(album.id),
            "title": album.name,
            "artist": album.artist.name if album.artist else None,
            "artist_id": str(album.artist.id) if album.artist else None,
            "year": getattr(album, "year", None),
            "cover_url": cover_url,
            "num_tracks": getattr(album, "num_tracks", None),
            "duration": getattr(album, "duration", None),
            "tidal_url": f"https://tidal.com/browse/album/{album.id}",
            "audio_modes": getattr(album, "audio_modes", None) or None,
        }


tidal_service = TidalService()
