# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Verzamel data-bestanden van packages die dat nodig hebben
tidalapi_datas = collect_data_files("tidalapi")
httpx_datas = collect_data_files("httpx")

a = Analysis(
    ["app.py"],
    pathex=["."],
    binaries=[],
    datas=[
        # Frontend build
        ("frontend/dist", "frontend_dist"),
        # Package data
        *tidalapi_datas,
        *httpx_datas,
    ],
    hiddenimports=[
        # uvicorn (dynamisch geladen modules)
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        # h11 HTTP parser (vereist door uvicorn h11_impl)
        "h11",
        "h11._readers",
        "h11._writers",
        "h11._util",
        "h11._events",
        "h11._state",
        "h11._connection",
        # anyio (vereist door starlette/fastapi)
        "anyio",
        "anyio.abc",
        "anyio._backends._asyncio",
        "anyio._backends._trio",
        "anyio.streams",
        "anyio.streams.memory",
        # SQLAlchemy dialect
        "sqlalchemy.dialects.sqlite",
        "sqlalchemy.sql.default_comparator",
        # FastAPI / starlette
        "starlette.routing",
        "starlette.middleware",
        "starlette.middleware.cors",
        # pystray Windows backend
        "pystray._win32",
        # Pillow image formats
        "PIL._tkinter_finder",
        # Backend modules (PyInstaller vindt ze soms niet via relatieve imports)
        "backend",
        "backend.main",
        "backend.database",
        "backend.models",
        "backend.schemas",
        "backend.data_dir",
        "backend.routers",
        "backend.routers.auth",
        "backend.routers.albums",
        "backend.routers.tags",
        "backend.routers.playlists",
        "backend.routers.albumlists",
        "backend.routers.tidal",
        "backend.services",
        "backend.services.tidal_service",
        "backend.services.enrichment_service",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "pandas", "scipy"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="TidalOrganizer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,      # Geen terminal venster
    windowed=True,
    icon=None,          # Voeg hier een .ico pad toe voor een eigen icoon
)
