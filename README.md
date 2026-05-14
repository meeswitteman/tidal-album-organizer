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
- **Genres ophalen** — achtergrondtaak die via MusicBrainz genres én review-links ophaalt voor alle albums zonder deze gegevens (1 verzoek/seconde vanwege rate limiting); voortgang zichtbaar als `12/347 · Stop`; klik nogmaals om te stoppen; albums die al verrijkt zijn worden overgeslagen

### Albumkaart
- Klik op kaart → detail panel rechts
- Knop rechtsbovenhoek → albumhoes fullscreen weergeven (klik om te sluiten)
- Vinkje linksbovenhoek → album selecteren (voor playlist aanmaken)
- Blauw **ATMOS**-badgje bij Dolby Atmos-albums

### Albumdetail (zijpaneel)
- Albumhoes, titel, artiest, jaar, aantal tracks
- Link om te openen in **Tidal-app** (`tidal://album/...`) en in de **browser**
- **Genres** uit MusicBrainz
- **Review- en infosites** — directe links naar externe bronnen per album (AllMusic, Rate Your Music, Discogs, Last.fm, e.a.), opgehaald via MusicBrainz URL-relaties; voor albums zonder MusicBrainz-koppeling worden zoeklinks gegenereerd
- **Wikipedia-samenvatting** + link naar volledige pagina (met fallback naar artiestpagina als albumpagina ontbreekt)
- **Tags** beheren: toevoegen en verwijderen
- **Tracklist** met tracknummer, titel en duur (live opgehaald via Tidal)
  - Hover op een regel → **play-knop** verschijnt; klik om het nummer direct af te spelen in de ingebouwde audioplayer
  - Hover lang op een afgekorte tracktitel → volledige titel als tooltip
  - **Speel alles** — knop naast "Tracklist" om het hele album door te spelen
- **Notities**: vrije tekst, automatisch opgeslagen bij verlaten veld

### Audioplayer
- Ingebouwde HTML5-audioplayer, speelt direct af via de Tidal-streaming-API (geen externe app nodig)
- **Mini-player balk** onderaan het scherm: play/pause, tracknaam, artiest, tijdweergave en voortgangsbalk
- **Klik op de tracktitel** in de mini-player om direct naar het bijbehorende album te springen — opent het albumdetailpaneel en navigeert zo nodig terug naar de bibliotheek
- Klik op de voortgangsbalk om naar een willekeurig punt te seekken
- **Persistent**: spelen gaat door bij wisselen van album, lijst of pagina
- **Auto-advance**: na elk nummer start het volgende automatisch

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

**Gebruikersdata** — opgeslagen in `%APPDATA%\TidalOrganizer\`:
- `tidal_org.db` — SQLite-database met albummetadata, tags, lijsten en playlists
- `tidal_session.json` — Tidal-sessietoken (aangemaakt na eerste login)

Deze locatie blijft bij updates behouden en is onafhankelijk van de installatielocatie van de app.

**Database-tabellen:**
- `albums` — albummetadata, genres, audio_modes, notities
- `tags` — gebruikersdefinieerde labels met kleur
- `album_tags` — koppeltabel albums ↔ tags
- `album_lists` — lokale albumlijsten
- `album_list_items` — items in lijsten (met positie voor volgorde)
- `playlists` — geëxporteerde Tidal-playlists

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
|---|---|---|
| Tidal API | Albums, tracks, playlists, authenticatie, streaming-URL's | Via tidalapi |
| Wikipedia REST API + Search API | Albumsamenvattingen (met artiest-fallback) | Geen officieel |
| MusicBrainz API | Genres en review-links (URL-relaties) per album | 1 verzoek/seconde |

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

---

## Opstarten

### Als uitvoerbare exe (aanbevolen)

Bouw een enkelvoudige `.exe` met één commando:

```powershell
.\build.bat
```

Dit voert automatisch de frontend-build en PyInstaller-bundeling uit. Het resultaat staat in:

```
dist\TidalOrganizer.exe
```

Dubbel-klik de exe om de app te starten:
- De browser opent automatisch op `http://localhost:8000`
- Een **system tray-icoon** verschijnt in de taakbalk (rechtsboven bij de klok)
  - Dubbelklik of klik **Open Tidal Organizer** om de browser opnieuw te openen
  - Klik **Afsluiten** om de app te stoppen
- Eerste keer: doorloop de Tidal-login in de browser

> De exe vereist geen installatie en werkt op Windows 10/11. Data wordt opgeslagen in `%APPDATA%\TidalOrganizer\` en blijft bewaard bij updates.

### Als server (development / geavanceerd)

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open vervolgens `http://localhost:8000` in je browser.

### Ontwikkelmodus (hot-reload)

Start backend en frontend apart zodat wijzigingen direct zichtbaar zijn zonder opnieuw te bouwen:

```powershell
# Terminal 1 — backend
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Frontend is dan beschikbaar op `http://localhost:5173`, API op `http://localhost:8000`.

> Na wijzigingen aan de frontend opnieuw bouwen voor de exe: `.\build.bat`

---

## Gebruikshandleiding

### Eerste keer inloggen

1. Start de app (exe of server) — de browser opent automatisch
2. Klik **Inloggen met Tidal**
3. Er verschijnt een code en een link → open de link, voer de code in op de Tidal-website
4. Na bevestiging laadt de app automatisch opnieuw
5. De sessie wordt opgeslagen in `%APPDATA%\TidalOrganizer\tidal_session.json`; je hoeft niet opnieuw in te loggen na herstart

### Albums importeren

**Methode 1 — Favorieten:**
Klik **Sync favorieten** in de toolbar. Importeert alle albums die je in Tidal als favoriet hebt gemarkeerd.

**Methode 2 — Her-import:**
Klik **Her-import**. Haalt albums op uit zowel favorieten als alle eigen Tidal-playlists. Voegt alleen nieuwe albums toe, werkt bestaande bij.

### Genres en review-links ophalen

Klik **Genres ophalen** in de toolbar. De app zoekt via MusicBrainz genres én review-links op voor alle albums die deze gegevens nog niet hebben (±1–2 seconden per album). Voortgang wordt getoond als `12/347 · Stop`. Klik nogmaals op de knop om het proces te stoppen. Albums die al volledig verrijkt zijn worden overgeslagen.

Na afloop zijn genres beschikbaar als filter, en verschijnen review-links in het albumdetailpaneel.

### Zoeken en filteren

- Typ in het **Album**- of **Artiest**-zoekveld voor directe filtering
- Klik **Filter** voor uitgebreide opties:
  - **Tag** — filter op een specifieke tag
  - **Jaar van / tot** — jaarbereik
  - **Genre** — multi-select dropdown (meerdere genres tegelijk, OR-logica)
  - **Dolby Atmos** — schakelaar voor alleen Atmos-albums
- Klik **Reset** om alle filters te wissen

### Audioplayer gebruiken

- Klik op een tracknummer in het albumdetailpaneel om het af te spelen
- De mini-player verschijnt onderaan het scherm
- Klik op de **tracktitel** in de mini-player om terug te springen naar het album (ook vanuit een andere pagina)
- Klik op de voortgangsbalk om naar een willekeurig punt te springen

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
│   ├── data_dir.py              # Gedeeld pad naar %APPDATA%\TidalOrganizer\
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
│   │   │   ├── AlbumDetail.tsx  # Detailpanel (wiki, genres, tags, tracklist, player)
│   │   │   ├── MiniPlayer.tsx   # Persistente audioplayer balk (globaal)
│   │   │   ├── PlaylistModal.tsx # Playlist aanmaken vanuit selectie
│   │   │   ├── Sidebar.tsx      # Navigatie
│   │   │   ├── TagBadge.tsx     # Gekleurde tag-pill
│   │   │   └── TruncatedTitle.tsx # Titel met tooltip bij afkapping
│   │   ├── context/
│   │   │   └── PlayerContext.tsx # Globale audioplayer state en logica
│   │   ├── pages/
│   │   │   ├── Library.tsx      # Hoofdbibliotheek
│   │   │   ├── AlbumLists.tsx   # Overzicht albumlijsten
│   │   │   ├── AlbumListDetail.tsx # Detail van één albumlijst
│   │   │   ├── TidalPlaylists.tsx  # Tidal-playlists importeren
│   │   │   ├── Playlists.tsx    # Geëxporteerde playlists
│   │   │   └── Tags.tsx         # Tag beheer
│   │   ├── types/index.ts       # TypeScript interfaces
│   │   ├── App.tsx              # Root component, routing, activeAlbumId state
│   │   └── main.tsx             # React entry point
│   ├── package.json
│   └── vite.config.ts
├── app.py                       # Desktop launcher (server + browser + tray-icoon)
├── tidal_organizer.spec         # PyInstaller bundel-configuratie
├── build.bat                    # Bouwscript: frontend + exe in één stap
└── README.md
```

---

## Externe diensten

De applicatie communiceert met drie externe diensten. Alle verzoeken worden vanuit de backend gedaan; de browser communiceert alleen met `localhost`.

| Dienst | Endpoint | Privacy |
|---|---|---|
| Tidal API | `api.tidal.com` | Sessietoken opgeslagen lokaal in `%APPDATA%\TidalOrganizer\tidal_session.json` |
| Wikipedia | `en.wikipedia.org/api/rest_v1` en `/w/api.php` | Alleen lezen, geen account vereist |
| MusicBrainz | `musicbrainz.org/ws/2` | Alleen lezen, geen account vereist |

Geen data wordt naar derden gestuurd buiten deze drie diensten om.
