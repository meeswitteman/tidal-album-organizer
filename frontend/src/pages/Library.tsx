import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ListMusic, Search, SlidersHorizontal, X, Download, Sparkles, CheckSquare } from "lucide-react";
import { getAlbums, syncAlbums, reimportAlbums, getTags, getGenres, startEnrichGenres, cancelEnrichGenres, getEnrichStatus } from "../api/client";
import { AlbumCard } from "../components/AlbumCard";
import { AlbumDetail } from "../components/AlbumDetail";
import { PlaylistModal } from "../components/PlaylistModal";
import { ResizableDivider } from "../components/ResizableDivider";
import type { Album } from "../types";

interface LibraryProps {
  activeAlbumId: string | null;
  onSetActiveAlbum: (id: string | null) => void;
}

export function Library({ activeAlbumId, onSetActiveAlbum: setActiveAlbumId }: LibraryProps) {
  const qc = useQueryClient();
  const [detailWidth, setDetailWidth] = useState(() => {
    const saved = localStorage.getItem("tao_detail_width");
    return saved ? parseInt(saved) : 320;
  });

  const resizeDetail = useCallback((delta: number) => {
    setDetailWidth((w) => {
      const next = Math.max(250, Math.min(600, w - delta));
      localStorage.setItem("tao_detail_width", String(next));
      return next;
    });
  }, []);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [searchYear, setSearchYear] = useState("");
  const [filterTagId, setFilterTagId] = useState<number | null>(null);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterGenres, setFilterGenres] = useState<Set<string>>(new Set());
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [filterDolbyAtmos, setFilterDolbyAtmos] = useState(false);
  const [zoomedCover, setZoomedCover] = useState<string | null>(null);
  const [enrichRunning, setEnrichRunning] = useState(false);
  const [enrichCancelling, setEnrichCancelling] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);

  const effectiveYearFrom = searchYear ? parseInt(searchYear) : yearFrom ? parseInt(yearFrom) : undefined;
  const effectiveYearTo   = searchYear ? parseInt(searchYear) : yearTo   ? parseInt(yearTo)   : undefined;

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ["albums", searchTitle, searchArtist, searchYear, filterTagId, yearFrom, yearTo, [...filterGenres].sort().join(","), filterDolbyAtmos],
    queryFn: () =>
      getAlbums({
        title: searchTitle || undefined,
        artist: searchArtist || undefined,
        tag: filterTagId ? [filterTagId] : undefined,
        year_from: effectiveYearFrom,
        year_to: effectiveYearTo,
        genre: filterGenres.size > 0 ? [...filterGenres] : undefined,
        dolby_atmos: filterDolbyAtmos || undefined,
      }),
  });

  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: getTags });
  const { data: genres = [] } = useQuery({ queryKey: ["genres"], queryFn: getGenres });

  const sync = useMutation({
    mutationFn: syncAlbums,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["albums"] }),
  });

  const reimport = useMutation({
    mutationFn: reimportAlbums,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["albums"] }),
  });

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedAlbums = albums.filter((a) => selectedIds.has(a.id));
  const allVisibleSelected = albums.length > 0 && albums.every((a) => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(albums.map((a) => a.id)));
    }
  };
  const hasFilters = !!searchTitle || !!searchArtist || !!searchYear || filterTagId !== null || !!yearFrom || !!yearTo || filterGenres.size > 0 || filterDolbyAtmos;

  const resetFilters = () => {
    setSearchTitle("");
    setSearchArtist("");
    setSearchYear("");
    setFilterTagId(null);
    setYearFrom("");
    setYearTo("");
    setFilterGenres(new Set());
    setFilterDolbyAtmos(false);
  };

  const toggleGenre = (g: string) => setFilterGenres((prev) => {
    const next = new Set(prev);
    next.has(g) ? next.delete(g) : next.add(g);
    return next;
  });

  const handleEnrichToggle = async () => {
    if (enrichRunning) {
      setEnrichCancelling(true);
      await cancelEnrichGenres();
    } else {
      const result = await startEnrichGenres();
      setEnrichRunning(true);
      setEnrichCancelling(false);
      setEnrichProgress({ done: result.done ?? 0, total: result.total });
    }
  };

  // Check bij laden of enrichment al loopt (bijv. gestart via API)
  useEffect(() => {
    getEnrichStatus().then((status) => {
      if (status.running) {
        setEnrichRunning(true);
        setEnrichProgress({ done: status.done, total: status.total });
      }
    });
  }, []);

  useEffect(() => {
    if (!enrichRunning) return;
    const interval = setInterval(async () => {
      const status = await getEnrichStatus();
      setEnrichProgress({ done: status.done, total: status.total });
      if (!status.running) {
        setEnrichRunning(false);
        setEnrichCancelling(false);
        qc.invalidateQueries({ queryKey: ["albums"] });
        qc.invalidateQueries({ queryKey: ["genres"] });
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [enrichRunning]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3 shrink-0 flex-wrap">
          {/* Album zoeken */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              className="input pl-9 w-48"
              placeholder="Album..."
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
            />
          </div>

          {/* Artiest zoeken */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              className="input pl-9 w-48"
              placeholder="Artiest..."
              value={searchArtist}
              onChange={(e) => setSearchArtist(e.target.value)}
            />
          </div>

          {/* Jaar zoeken */}
          <input
            className="input w-24 text-center"
            placeholder="Jaar..."
            value={searchYear}
            maxLength={4}
            onChange={(e) => setSearchYear(e.target.value.replace(/\D/g, ""))}
          />

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={showFilters || (filterTagId !== null || !!yearFrom || !!yearTo) ? "btn-primary" : "btn-ghost"}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter
            {(filterTagId !== null || !!yearFrom || !!yearTo) && (
              <span className="w-1.5 h-1.5 rounded-full bg-black" />
            )}
          </button>

          {hasFilters && (
            <button onClick={resetFilters} className="btn-ghost text-sm">
              <X className="w-4 h-4" /> Reset
            </button>
          )}

          {albums.length > 0 && (
            <button onClick={toggleSelectAll} className="btn-ghost text-sm">
              {allVisibleSelected
                ? <><X className="w-4 h-4" /> Deselecteer alles</>
                : <><CheckSquare className="w-4 h-4" /> Selecteer alles {hasFilters && `(${albums.length})`}</>
              }
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending || reimport.isPending}
            className="btn-ghost"
          >
            <RefreshCw className={`w-4 h-4 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Syncing..." : "Sync favorieten"}
          </button>

          <button
            onClick={() => reimport.mutate()}
            disabled={reimport.isPending || sync.isPending}
            className="btn-ghost"
            title="Haalt alle albums op uit favorieten én alle playlists"
          >
            <Download className={`w-4 h-4 ${reimport.isPending ? "animate-bounce" : ""}`} />
            {reimport.isPending ? "Her-import bezig..." : "Her-import"}
          </button>

          <button
            onClick={handleEnrichToggle}
            disabled={enrichCancelling}
            className={enrichRunning ? "btn-ghost text-red-400 hover:text-red-300" : "btn-ghost"}
            title={enrichRunning ? "Klik om te stoppen" : "Genres ophalen via MusicBrainz voor alle albums"}
          >
            <Sparkles className={`w-4 h-4 ${enrichRunning && !enrichCancelling ? "animate-pulse" : ""}`} />
            {enrichCancelling
              ? "Stoppen..."
              : enrichRunning
              ? `${enrichProgress?.done ?? 0}/${enrichProgress?.total ?? "..."} · Stop`
              : "Genres ophalen"}
          </button>

          {selectedIds.size > 0 && (
            <>
              <button onClick={() => setShowPlaylistModal(true)} className="btn-primary">
                <ListMusic className="w-4 h-4" />
                Playlist ({selectedIds.size})
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="btn-ghost">
                <X className="w-4 h-4" /> Deselecteer
              </button>
            </>
          )}
        </div>

        {/* Extra filter panel */}
        {showFilters && (
          <div className="px-6 py-3 border-b border-border bg-surface flex items-center gap-4 flex-wrap shrink-0">
            <div>
              <label className="text-xs text-muted block mb-1">Tag</label>
              <select
                className="input py-1 text-xs w-36"
                value={filterTagId ?? ""}
                onChange={(e) => setFilterTagId(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Alle tags</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Jaar van</label>
              <input className="input py-1 text-xs w-20" placeholder="1960" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Jaar tot</label>
              <input className="input py-1 text-xs w-20" placeholder="2024" value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
            </div>
            {genres.length > 0 && (
              <div className="relative">
                <label className="text-xs text-muted block mb-1">Genre</label>
                <button
                  onClick={() => setShowGenreDropdown((v) => !v)}
                  className={`input py-1 text-xs w-44 text-left flex items-center justify-between gap-2 ${filterGenres.size > 0 ? "border-accent text-white" : ""}`}
                >
                  <span className="truncate">
                    {filterGenres.size === 0
                      ? "Alle genres"
                      : filterGenres.size === 1
                      ? [...filterGenres][0]
                      : `${filterGenres.size} genres`}
                  </span>
                  <span className="text-border shrink-0">▾</span>
                </button>
                {showGenreDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-30 w-52 max-h-64 overflow-y-auto">
                    {filterGenres.size > 0 && (
                      <button
                        onClick={() => { setFilterGenres(new Set()); }}
                        className="w-full text-left px-3 py-2 text-xs text-accent hover:bg-card border-b border-border"
                      >
                        Wis selectie ({filterGenres.size})
                      </button>
                    )}
                    {genres.map((g) => (
                      <label
                        key={g}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-card cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filterGenres.has(g)}
                          onChange={() => toggleGenre(g)}
                          className="accent-accent w-3.5 h-3.5 shrink-0"
                        />
                        <span className="text-xs capitalize">{g}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="text-xs text-muted block mb-1">Formaat</label>
              <button
                onClick={() => setFilterDolbyAtmos((v) => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  filterDolbyAtmos
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:border-accent/40 hover:text-white"
                }`}
              >
                <span className="font-bold tracking-tight">ATMOS</span>
                Dolby Atmos
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Resultaat teller */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-muted">
              {isLoading ? "Laden..." : `${albums.length} albums`}
              {hasFilters && " (gefilterd)"}
            </span>
            {sync.data && (
              <span className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-lg text-xs text-accent">
                Sync: {sync.data.added} nieuw, {sync.data.updated} bijgewerkt
              </span>
            )}
            {reimport.data && (
              <span className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-lg text-xs text-accent">
                Her-import: {reimport.data.added} nieuw · favorieten {reimport.data.sources.favorieten?.total ?? 0} · playlists {reimport.data.sources.playlists?.total ?? 0}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : albums.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted gap-3">
              <p className="text-lg">Geen albums gevonden</p>
              {hasFilters
                ? <p className="text-sm">Pas de filters aan of klik Reset.</p>
                : <p className="text-sm">Druk op "Sync Tidal" om je favorieten te importeren.</p>
              }
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-5">
              {albums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  selected={selectedIds.has(album.id)}
                  onClick={() => setActiveAlbumId(album.id === activeAlbumId ? null : album.id)}
                  onToggleSelect={(e) => toggleSelect(album.id, e)}
                  onShowCover={(e) => { e.stopPropagation(); setZoomedCover(album.cover_url); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {activeAlbumId && (
        <>
          <ResizableDivider onDelta={resizeDetail} />
          <div style={{ width: detailWidth }} className="shrink-0">
            <AlbumDetail albumId={activeAlbumId} onClose={() => setActiveAlbumId(null)} />
          </div>
        </>
      )}

      {/* Playlist modal */}
      {showPlaylistModal && (
        <PlaylistModal
          selectedAlbums={selectedAlbums}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}

      {/* Fullscreen cover overlay on click */}
      {zoomedCover && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm cursor-zoom-out p-4"
          onClick={() => setZoomedCover(null)}
        >
          <img
            src={zoomedCover}
            alt=""
            className="w-full h-full object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
