from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import re
from bs4 import BeautifulSoup
from ..database import get_db
from ..models import ProgArchivesArtist

router = APIRouter(prefix="/progarchives", tags=["progarchives"])


def _parse_html(content: bytes) -> list[dict]:
    soup = BeautifulSoup(content.decode("utf-8", errors="replace"), "html.parser")
    artists = []
    for grid in soup.find_all("div", class_="grid-container"):
        items = grid.find_all("div", class_="grid-item")
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


@router.post("/import")
async def import_progarchives(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.endswith(".html"):
        raise HTTPException(status_code=400, detail="Verwacht een .html bestand")

    content = await file.read()
    artists = _parse_html(content)

    if not artists:
        raise HTTPException(status_code=422, detail="Geen artiesten gevonden in het bestand. Controleer of het de juiste pagina is.")

    db.query(ProgArchivesArtist).delete()
    for a in artists:
        db.add(ProgArchivesArtist(
            id=a["id"], name=a["name"], name_lower=a["name_lower"],
            style=a["style"], country=a["country"],
        ))
    db.commit()

    return {"imported": len(artists)}


@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    count = db.query(ProgArchivesArtist).count()
    return {"count": count}
