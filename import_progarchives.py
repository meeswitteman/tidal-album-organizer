"""
Importeer Prog Archives artiesten vanuit de gedownloade HTML-pagina.

Gebruik:
    python import_progarchives.py pad\naar\bands-alpha.html

Download de pagina via:
    https://www.progarchives.com/bands-alpha.asp?letter=
    Sla op als "Webpagina, alleen HTML" (Ctrl+S in browser)
"""
import sys
import sqlite3
import os
import re
from pathlib import Path
from bs4 import BeautifulSoup


def get_db_path():
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home()))
    else:
        base = Path.home() / ".local" / "share"
    return base / "TidalOrganizer" / "tidal_org.db"


def parse_html(html_path: str) -> list[dict]:
    with open(html_path, encoding="utf-8", errors="replace") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    artists = []
    for grid in soup.find_all("div", class_="grid-container"):
        items = grid.find_all("div", class_="grid-item")
        # Elke artiest heeft 3 opeenvolgende grid-items: naam, stijl, land
        for i in range(0, len(items) - 2, 3):
            name_div, style_div, country_div = items[i], items[i + 1], items[i + 2]
            link = name_div.find("a", href=re.compile(r"artist\.asp\?id=\d+"))
            if not link:
                continue
            m = re.search(r"id=(\d+)", link.get("href", ""))
            if not m:
                continue
            name = link.get_text(strip=True)
            if not name:
                continue
            artists.append({
                "id": int(m.group(1)),
                "name": name,
                "name_lower": name.lower(),
                "style": style_div.get_text(strip=True) or None,
                "country": country_div.get_text(strip=True) or None,
            })

    return artists


def main():
    if len(sys.argv) < 2:
        print("Gebruik: python import_progarchives.py pad\\naar\\bands-alpha.html")
        sys.exit(1)

    html_path = sys.argv[1]
    if not Path(html_path).exists():
        print(f"Bestand niet gevonden: {html_path}")
        sys.exit(1)

    print(f"HTML inlezen: {html_path}")
    artists = parse_html(html_path)
    print(f"{len(artists)} artiesten gevonden in HTML")

    if not artists:
        print("Geen artiesten gevonden. Controleer of het juiste bestand is opgegeven.")
        sys.exit(1)

    db_path = get_db_path()
    print(f"Database: {db_path}")
    conn = sqlite3.connect(db_path)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS progarchives_artists (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            name_lower TEXT NOT NULL,
            style TEXT,
            country TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_progarchives_artists_name_lower ON progarchives_artists (name_lower)")
    conn.execute("DELETE FROM progarchives_artists")
    conn.executemany(
        "INSERT OR REPLACE INTO progarchives_artists (id, name, name_lower, style, country) VALUES (:id, :name, :name_lower, :style, :country)",
        artists,
    )
    conn.commit()

    count = conn.execute("SELECT COUNT(*) FROM progarchives_artists").fetchone()[0]
    conn.close()
    print(f"Klaar! {count} artiesten opgeslagen in de database.")

    # Toon een paar voorbeelden
    print("\nVoorbeelden:")
    for a in artists[:5]:
        print(f"  [{a['id']}] {a['name']} | {a['style']} | {a['country']}")


if __name__ == "__main__":
    main()
