# TAO — Tidal Album Organizer

Een lokale desktop-webapplicatie voor Windows om je Tidal-albumbibliotheek te beheren, doorzoeken, labelen en exporteren naar Tidal-playlists.

---

## Inhoud

- [Functionaliteiten](#functionaliteiten)
- [Technische opzet](#technische-opzet)
- [Installatie](#installatie)
- [Opstarten](#opstarten)
- [Gebruikshandleiding](#gebruikshandleiding)
- [Projectstructuur](#projectstructuur)
- [Externe diensten](#externe-diensten)

---

## Functionaliteiten

### Bibliotheek
- **Sync favorieten** — importeert alle albums die je als favoriet hebt gemarkeerd in Tidal
- **Her-import** — haalt albums op uit favorieten én alle eigen Tidal-playlists (gecombineerd, zonder duplicaten)
- **Albumraster** — 5-koloms grid met albumhoezen, titel, artiest, jaar
- **Zoeken** op albumnaam en artiest (aparte zoekvelden)
- **Filters**:
  - Tag (eigen labels)
  - Jaar van / tot
  - Genre (multi-select, gekoppeld via MusicBrainz)
  - Dolby Atmos (toont alleen albums met Atmos-ondersteuning)
- **Genres ophalen** — achtergrondtaak die via MusicBrainz genres ophaalt en opslaat voor alle albums in de bibliotheek (1 verzoek/seconde vanwege rate limiting); voortgang zichtbaar in de toolbar

### Albumkaart
- Klik op kaart → detail panel rechts
- Knop rechtsbovenhoek → albumhoes fullscreen weergeven (klik om te sluiten)
- Vinkje linksbovenhoek → album selecteren (voor playlist aanmaken)
- Blauw **ATMOS**-badgje bij Dolby Atmos-albums

### Albumdetail (zijpaneel)
- Albumhoes, titel, artiest, jaar, aantal tracks
- Link om te openen in **Tidal-app** (`tidal://album/...`) en in de **browser**
- **Genres** uit MusicBrainz
- **Wikipedia-samenvatting** + link naar volledige pagina
- **Tags** beheren: toevoegen en verwijderen
- **Notities**: vrije tekst, automatisch opgeslagen bij verlaten veld
- **Tracklist** met tracknummer, titel en duur (live opgehaald via Tidal)

### Tags
- Aanmaken met naam en kleur (kleurpalet of vrije hex-code)
- Bewerken en verwijderen
- Tags worden getoond op albumkaarten en in het detailpanel
- Filteren op tag in de bibliotheek

### Albumlijsten
- Maak lokale gecureerde lijsten (bijv. "Te ontdekken", "Jaren '70 klassiekers")
- Albums toevoegen via zoeken op naam, artiest of jaar
- Albums verwijderen (selectie + bulk-verwijdering)
- **Sorteren** op datum toegevoegd, artiest, albumnaam of jaar
- **Filteren** binnen de lijst op naam, artiest of jaar (client-side, real-time)
- Hetzelfde grote albumraster als de bibliotheek, met detail panel en hoeszoom
- **Exporteren naar Tidal** als nieuwe playlist, met vier modi:
  - **Volledige albums** — alle nummers van elk album
  - **Eerste nummer** — alleen track 1 per album
  - **Random nummer** — één willekeurig nummer per album
  - **Lange nummers** — alleen nummers boven een instelbare minimale duur (minuten)
  - Standaard afspeellijstnaam: `tao_export_<lijstnaam>_YYYY-MM-DD-HH:mm`

### Tidal Playlists
- Overzicht van alle eigen Tidal-playlists (live opgehaald)
- Zoekfilter op naam
- Eén of meerdere playlists selecteren → **Importeer albums naar albumlijst** (albums uit de geselecteerde playlists worden toegevoegd aan een gekozen albumlijst, duplicaten worden overgeslagen)

### Exports
- Overzicht van alle naar Tidal geëxporteerde playlists
- Directe link om de playlist te openen in de Tidal-app

---

## Technische opzet

### Architectuur

```
Browser (localhost:8000)
       │
       ▼
FastAPI (Python)
  ├── REST API  (/api/...)
  ├── Statische bestanden (gebouwde React-app uit frontend/dist)
  └── SQLite-database (tidal_org.db)
       │
       ├── Tidal API (tidalapi)
       ├── Wikipedia REST API
       └── MusicBrainz API
```

De applicatie draait volledig lokaal: één Python-proces serveert zowel de API als de frontend. Er is geen aparte webserver nodig.

### Backend

| Component | Technologie |
|-----------|-------------|
| Framework | FastAPI |
| ORM | SQLAlchemy (SQLite) |
| Tidal-integratie | tidalapi 0.8.11 |
| HTTP-client (verrijking) | httpx (async) |
| Server | Uvicorn |

**Database** (`tidal_org.db`):
- `albums` — albummetadata, genres, audio_modes, notities
- `tags` — gebruikersdefinieerde labels met kleur
- `album_tags` — koppeltabel albums ↔ tags
- `album_lists` — lokale albumlijsten
- `album_list_items` — items in lijsten (met positie voor volgorde)
- `playlists` — geëxporteerde Tidal-playlists

**Tidal-sessie** wordt opgeslagen in `tidal_session.json` zodat je niet opnieuw hoeft in te loggen na herstart.

**DB-migraties** worden automatisch uitgevoerd bij opstarten (via `ALTER TABLE` checks in `main.py`).

### Frontend

| Component | Technologie |
|-----------|-------------|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query (React Query) |
| HTTP | Axios |
| Iconen | lucide-react |

De frontend wordt gebouwd naar `frontend/dist` en daarna geserveerd door FastAPI als statische bestanden.

### Externe API's

| Dienst | Gebruik | Rate limit |
|--------|---------|------------|
| Tidal API | Albums, tracks, playlists, authenticatie | Via tidalapi |
| Wikipedia REST API | Albumsamenvattingen | Geen officieel |
| MusicBrainz API | Genres per album | 1 verzoek/seconde |

---

## Installatie

### Vereisten

- Python 3.11 of hoger
- Node.js 18 of hoger
- Een actief Tidal-account

### Stappen

**1. Repository klonen of downloaden**

**2. Backend installeren**

```powershell
cd tidal-org
pip install -r backend/requirements.txt
```

**3. Frontend bouwen**

```powershell
cd frontend
npm install
npm run build
cd ..
```

**4. Applicatie starten**

```powershell
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open vervolgens `http://localhost:8000` in je browser.

---

## Opstarten

### Productie (aanbevolen)

```powershell
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

De gebouwde React-app wordt automatisch geserveerd op `http://localhost:8000`.

### Ontwikkelmodus

Start backend en frontend apart (hot-reload):

```powershell
# In tidal-org/
.\start-dev.ps1
```

Of handmatig:

```powershell
# Terminal 1 — backend
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Frontend is dan beschikbaar op `http://localhost:5173`, API op `http://localhost:8000`.

Na wijzigingen aan de frontend altijd opnieuw bouwen voor productie:

```powershell
cd frontend && npm run build
```

---

## Gebruikshandleiding

### Eerste keer inloggen

1. Open `http://localhost:8000`
2. Klik **Inloggen met Tidal**
3. Er verschijnt een code en een link → open de link, voer de code in op de Tidal-website
4. Na bevestiging laadt de app automatisch opnieuw
5. De sessie wordt opgeslagen; je hoeft niet opnieuw in te loggen na herstart

### Albums importeren

**Methode 1 — Favorieten:**
Klik **Sync favorieten** in de toolbar. Importeert alle albums die je in Tidal als favoriet hebt gemarkeerd.

**Methode 2 — Her-import:**
Klik **Her-import**. Haalt albums op uit zowel favorieten als alle eigen Tidal-playlists. Voegt alleen nieuwe albums toe, werkt bestaande bij.

### Genres ophalen

Klik **Genres ophalen** in de toolbar. De app zoekt via MusicBrainz genres op voor alle albums zonder genre (±1 seconde per album). Voortgang wordt getoond als `Genres 12/347`. Na afloop zijn genres beschikbaar in het genre-filter.

### Zoeken en filteren

- Typ in het **Album**- of **Artiest**-zoekveld voor directe filtering
- Klik **Filter** voor uitgebreide opties:
  - **Tag** — filter op een specifieke tag
  - **Jaar van / tot** — jaarbereik
  - **Genre** — multi-select dropdown (meerdere genres tegelijk, OR-logica)
  - **Dolby Atmos** — schakelaar voor alleen Atmos-albums
- Klik **Reset** om alle filters te wissen

### Tags beheren

1. Ga naar **Tags** in de sidebar
2. Klik **Nieuwe tag** → kies naam en kleur
3. Koppel tags aan albums via het detailpanel van een album (sectie "Tags")
4. Tags zijn zichtbaar als gekleurde badges op albumkaarten

### Albumlijsten

1. Ga naar **Albumlijsten** → **Nieuwe lijst**
2. Open een lijst → klik **Toevoegen** om albums te zoeken en toe te voegen
3. Sorteer via de knoppen **Datum / Artiest / Naam / Jaar**
4. Filter binnen de lijst met de zoekbalk rechts in de header
5. Selecteer albums (vinkje) → **Verwijder** om te verwijderen
6. Klik **Exporteer** → kies een exportmodus en naam → playlist wordt aangemaakt in Tidal

### Tidal Playlists importeren

1. Ga naar **Tidal Playlists**
2. Zoek eventueel op naam
3. Vink één of meer playlists aan
4. Klik **Importeer naar albumlijst** → kies een bestaande albumlijst
5. Albums uit de geselecteerde playlists worden toegevoegd (duplicaten overgeslagen)

### Albumhoes vergroten

Klik het **vierkantje** rechtsboven op een albumkaart. De hoes vult het volledige browservenster. Klik ergens om te sluiten.

### Notities

Open het detailpanel van een album → scroll naar **Notities** → typ en klik ergens buiten het veld. Notities worden automatisch opgeslagen.

---

## Projectstructuur

```
tidal-org/
├── backend/
│   ├── main.py                  # FastAPI app, routes registreren, DB migratie
│   ├── database.py              # SQLAlchemy engine & sessie
│   ├── models.py                # ORM-modellen (Album, Tag, AlbumList, ...)
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── routers/
│   │   ├── albums.py            # /api/albums (sync, reimport, filter, enrich)
│   │   ├── albumlists.py        # /api/albumlists (CRUD, sort, export, import)
│   │   ├── auth.py              # /api/auth (login, poll, status)
│   │   ├── playlists.py         # /api/playlists (Tidal-export playlists)
│   │   ├── tags.py              # /api/tags (CRUD)
│   │   └── tidal.py             # /api/tidal/playlists (live Tidal data)
│   ├── services/
│   │   ├── tidal_service.py     # Tidal API wrapper (albums, tracks, playlists)
│   │   └── enrichment_service.py# Wikipedia + MusicBrainz ophalen
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.ts        # Axios API-aanroepen
│   │   ├── components/
│   │   │   ├── AlbumCard.tsx    # Albumkaart (cover, badges, selectie)
│   │   │   ├── AlbumDetail.tsx  # Detailpanel (wiki, genres, tags, tracklist)
│   │   │   ├── PlaylistModal.tsx # Playlist aanmaken vanuit selectie
│   │   │   ├── Sidebar.tsx      # Navigatie
│   │   │   └── TagBadge.tsx     # Gekleurde tag-pill
│   │   ├── pages/
│   │   │   ├── Library.tsx      # Hoofdbibliotheek
│   │   │   ├── AlbumLists.tsx   # Overzicht albumlijsten
│   │   │   ├── AlbumListDetail.tsx # Detail van één albumlijst
│   │   │   ├── TidalPlaylists.tsx  # Tidal-playlists importeren
│   │   │   ├── Playlists.tsx    # Geëxporteerde playlists
│   │   │   └── Tags.tsx         # Tag beheer
│   │   ├── types/index.ts       # TypeScript interfaces
│   │   ├── App.tsx              # Root component, routing
│   │   └── main.tsx             # React entry point
│   ├── package.json
│   └── vite.config.ts
├── tidal_org.db                 # SQLite-database (aangemaakt bij eerste start)
├── tidal_session.json           # Tidal-sessie (aangemaakt na eerste login)
├── start-dev.ps1                # Development startscript (Windows)
└── README.md
```

---

## Externe diensten

De applicatie communiceert met drie externe diensten. Alle verzoeken worden vanuit de backend gedaan; de browser communiceert alleen met `localhost`.

| Dienst | Endpoint | Privacy |
|--------|----------|---------|
| Tidal API | `api.tidal.com` | Sessietoken opgeslagen lokaal in `tidal_session.json` |
| Wikipedia | `en.wikipedia.org/api/rest_v1` | Alleen lezen, geen account vereist |
| MusicBrainz | `musicbrainz.org/ws/2` | Alleen lezen, geen account vereist |

Geen data wordt naar derden gestuurd buiten deze drie diensten om.
