import re
import httpx
from typing import Optional
from urllib.parse import quote

WIKIPEDIA_REST = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIPEDIA_SEARCH = "https://en.wikipedia.org/w/api.php"
MUSICBRAINZ_API = "https://musicbrainz.org/ws/2"
USER_AGENT = "TidalOrg/1.0 (mees.witteman@gmail.com)"


def _normalize_album_title(title: str) -> str:
    """Vertaal afkortingen en verwijder leestekens voor betere Wikipedia-matching."""
    title = re.sub(r'\bPt\.\s*', 'Part ', title, flags=re.IGNORECASE)
    title = re.sub(r'\bVol\.\s*', 'Volume ', title, flags=re.IGNORECASE)
    title = re.sub(r'\bNo\.\s*', 'Number ', title, flags=re.IGNORECASE)
    title = title.replace(',', '').replace(':', ' ').replace('(', '').replace(')', '')
    return re.sub(r'\s+', ' ', title).strip()


_EDITION_RE = re.compile(
    r'\s*\([^)]*\b(deluxe|edition|remaster(?:ed)?|expanded|special|anniversary'
    r'|bonus|version|redux|live|demo|acoustic|super|extended|complete)\b[^)]*\)',
    re.IGNORECASE,
)

def _strip_edition(title: str) -> Optional[str]:
    """Verwijder editie-achtervoegsels: 'Foo (Deluxe Edition)' → 'Foo'."""
    stripped = _EDITION_RE.sub('', title).strip()
    return stripped if stripped and stripped.lower() != title.lower() else None


def _is_relevant(found_title: str, *terms: str) -> bool:
    """Controleert of de gevonden Wikipedia-titel woorden bevat uit de zoektermen."""
    found_lower = found_title.lower()
    significant = re.findall(r'\b[a-z]{4,}\b', ' '.join(terms).lower())
    return any(w in found_lower for w in significant)


async def _search_wikipedia_title(client: httpx.AsyncClient, query: str) -> Optional[str]:
    """Zoekt op Wikipedia en geeft de titel van het eerste resultaat terug."""
    try:
        resp = await client.get(
            WIKIPEDIA_SEARCH,
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "format": "json",
                "srlimit": 1,
                "srnamespace": 0,
            },
            headers={"User-Agent": USER_AGENT},
        )
        if resp.status_code == 200:
            results = resp.json().get("query", {}).get("search", [])
            if results:
                return results[0]["title"]
    except Exception:
        pass
    return None


async def _fetch_wikipedia(client: httpx.AsyncClient, title: str) -> Optional[dict]:
    try:
        resp = await client.get(
            f"{WIKIPEDIA_REST}/{quote(title)}",
            headers={"User-Agent": USER_AGENT},
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("type") not in ("disambiguation", "no-extract"):
                extract = data.get("extract", "")
                if extract:
                    return {
                        "summary": extract,
                        "url": data.get("content_urls", {}).get("desktop", {}).get("page", ""),
                        "thumbnail": data.get("thumbnail", {}).get("source"),
                    }
    except Exception:
        pass
    return None


async def get_wikipedia_info(artist: str, album: str) -> dict:
    base_album = _strip_edition(album) or album

    album_candidates = [
        f"{album} ({artist} album)",
        f"{album} (album)",
        album,
    ]
    # Voeg kale titel toe als die verschilt (bijv. zonder "(Deluxe Edition)")
    if base_album != album:
        album_candidates += [
            f"{base_album} ({artist} album)",
            f"{base_album} (album)",
            base_album,
        ]

    artist_candidates = [
        artist,
        f"{artist} (band)",
        f"{artist} (musician)",
        f"{artist} (singer)",
    ]

    normalized = _normalize_album_title(base_album)

    async with httpx.AsyncClient(timeout=6.0) as client:
        # 1. Directe albumpagina's (originele + genormaliseerde titel)
        for title in album_candidates:
            result = await _fetch_wikipedia(client, title)
            if result:
                return {**result, "source": "album"}

        if normalized.lower() != album.lower():
            norm_candidates = [
                f"{normalized} ({artist} album)",
                f"{normalized} (album)",
                normalized,
            ]
            for title in norm_candidates:
                result = await _fetch_wikipedia(client, title)
                if result:
                    return {**result, "source": "album"}

        # 2. Wikipedia zoek-API met relevantiecheck
        search_queries = list(dict.fromkeys([  # unieke volgorde behouden
            f"{normalized} {artist} album",
            f"{base_album} {artist} album",
            f"{album} {artist} album",
        ]))
        for query in search_queries:
            found_title = await _search_wikipedia_title(client, query)
            if found_title and _is_relevant(found_title, base_album, album, normalized, artist):
                result = await _fetch_wikipedia(client, found_title)
                if result:
                    return {**result, "source": "album"}

        # 3. Artiestpagina's als fallback
        for title in artist_candidates:
            result = await _fetch_wikipedia(client, title)
            if result:
                return {**result, "source": "artist"}

        # 4. Zoek op artiest met relevantiecheck
        found_title = await _search_wikipedia_title(client, f"{artist} band musician")
        if found_title and _is_relevant(found_title, artist):
            result = await _fetch_wikipedia(client, found_title)
            if result:
                return {**result, "source": "artist"}

    return {}


_REVIEW_SITES = {
    "allmusic": "AllMusic",
    "rateyourmusic": "Rate Your Music",
    "last.fm": "Last.fm",
    "progarchives": "Prog Archives",
    "discogs": "Discogs",
}


async def get_musicbrainz_info(artist: str, album: str) -> dict:
    async with httpx.AsyncClient(timeout=6.0) as client:
        try:
            resp = await client.get(
                f"{MUSICBRAINZ_API}/release-group",
                params={
                    "query": f'release:"{album}" AND artist:"{artist}"',
                    "fmt": "json",
                    "limit": 1,
                },
                headers={"User-Agent": USER_AGENT},
            )
            if resp.status_code == 200:
                groups = resp.json().get("release-groups", [])
                if groups:
                    g = groups[0]
                    genres = [x["name"] for x in g.get("genres", [])]
                    tags = [x["name"] for x in g.get("tags", [])]
                    return {"genres": (genres or tags)[:6], "mbid": g.get("id")}
        except Exception:
            pass
    return {}


async def get_musicbrainz_url_rels(mbid: str) -> list:
    """Haal review/muziekdatabase links op via MusicBrainz URL-relaties."""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                f"{MUSICBRAINZ_API}/release-group/{mbid}",
                params={"inc": "url-rels", "fmt": "json"},
                headers={"User-Agent": USER_AGENT},
            )
            if resp.status_code == 200:
                links = []
                for rel in resp.json().get("relations", []):
                    rel_type = rel.get("type", "").lower()
                    url = rel.get("url", {}).get("resource", "")
                    if rel_type in _REVIEW_SITES and url:
                        links.append({"name": _REVIEW_SITES[rel_type], "url": url})
                return links
    except Exception:
        pass
    return []


def fallback_review_links(artist: str, album: str) -> list:
    """Zoeklinks als MusicBrainz-data nog niet beschikbaar is."""
    from urllib.parse import quote_plus
    q = quote_plus(f"{artist} {album}")
    return [
        {"name": "AllMusic", "url": f"https://www.allmusic.com/search/albums/{q}", "search": True},
        {"name": "Rate Your Music", "url": f"https://rateyourmusic.com/search?searchtype=l&searchterm={q}", "search": True},
    ]
