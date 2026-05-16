import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ListMusic, Search, SlidersHorizontal, X, Download, Sparkles, CheckSquare, ChevronUp, ChevronDown, Settings2 } from "lucide-react";
import { getAlbums, syncAlbums, reimportAlbums, getTags, getGenres, getPAStyles, getPACountries, startEnrichGenres, cancelEnrichGenres, getEnrichStatus } from "../api/client";
import { AlbumCard } from "../components/AlbumCard";
import { AlbumDetail } from "../components/AlbumDetail";
import { PlaylistModal } from "../components/PlaylistModal";
import { ResizableDivider } from "../components/ResizableDivider";
import type { Album } from "../types";

interface LibraryProps {
  activeAlbumId: string | null;
  onSetActiveAlbum: (id: string | null) => void;
}

type SortField = "artist" | "title" | "year" | "synced_at";

const SORT_LABELS: Record<SortField, string> = {
  artist: "Artiest",
  title: "Album",
  year: "Jaar",
  synced_at: "Importdatum",
};

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

  const [sortBy, setSortBy] = useState<SortField>(() => (localStorage.getItem("tao_sort_by") as SortField) ?? "artist");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => (localStorage.getItem("tao_sort_dir") as "asc" | "desc") ?? "asc");
  const [newAlbumIds, setNewAlbumIds] = useState<Set<string>>(new Set());
  const [showOnlyNew, setShowOnlyNew] = useState(false);

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
  const [showGenreManager, setShowGenreManager] = useState(false);
  const [genreSearch, setGenreSearch] = useState("");
  const genreDropdownRef = useRef<HTMLDivElement>(null);
  const [visibleGenres, setVisibleGenres] = useState<Set<string> | null>(() => {
    const saved = localStorage.getItem("tao_visible_genres");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed === null ? null : new Set<string>(parsed);
  });
  const [filterDolbyAtmos, setFilterDolbyAtmos] = useState(false);
  const [filterPAStyle, setFilterPAStyle] = useState("");
  const [filterPACountry, setFilterPACountry] = useState("");
  const [zoomedCover, setZoomedCover] = useState<string | null>(null);
  const [enrichRunning, setEnrichRunning] = useState(false);
  const [enrichCancelling, setEnrichCancelling] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);

  const effectiveYearFrom = searchYear ? parseInt(searchYear) : yearFrom ? parseInt(yearFrom) : undefined;
  const effectiveYearTo   = searchYear ? parseInt(searchYear) : yearTo   ? parseInt(yearTo)   : undefined;

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ["albums", searchTitle, searchArtist, searchYear, filterTagId, yearFrom, yearTo, [...filterGenres].sort().join(","), filterDolbyAtmos, filterPAStyle, filterPACountry, sortBy, sortDir],
    queryFn: () =>
      getAlbums({
        title: searchTitle || undefined,
        artist: searchArtist || undefined,
        tag: filterTagId ? [filterTagId] : undefined,
        year_from: effectiveYearFrom,
        year_to: effectiveYearTo,
        genre: filterGenres.size > 0 ? [...filterGenres] : undefined,
        dolby_atmos: filterDolbyAtmos || undefined,
        pa_style: filterPAStyle || undefined,
        pa_country: filterPACountry || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
  });

  const displayAlbums = showOnlyNew ? albums.filter((a) => newAlbumIds.has(a.id)) : albums;

  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: getTags });
  const { data: genres = [] } = useQuery({ queryKey: ["genres"], queryFn: getGenres });
  const { data: paStyles = [] } = useQuery({ queryKey: ["pa-styles"], queryFn: getPAStyles });
  const { data: paCountries = [] } = useQuery({ queryKey: ["pa-countries"], queryFn: getPACountries });

  const sync = useMutation({
    mutationFn: syncAlbums,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      if (data.new_album_ids?.length) {
        setNewAlbumIds(new Set(data.new_album_ids));
        setShowOnlyNew(false);
      } else {
        setNewAlbumIds(new Set());
      }
    },
  });

  const reimport = useMutation({
    mutationFn: reimportAlbums,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["albums"] }),
  });

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      const next = sortDir === "asc" ? "desc" : "asc";
      setSortDir(next);
      localStorage.setItem("tao_sort_dir", next);
    } else {
      setSortBy(field);
      setSortDir("asc");
      localStorage.setItem("tao_sort_by", field);
      localStorage.setItem("tao_sort_dir", "asc");
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedAlbums = albums.filter((a) => selectedIds.has(a.id));
  const allVisibleSelected = displayAlbums.length > 0 && displayAlbums.every((a) => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayAlbums.map((a) => a.id)));
    }
  };

  const hasFilters = !!searchTitle || !!searchArtist || !!searchYear || filterTagId !== null || !!yearFrom || !!yearTo || filterGenres.size > 0 || filterDolbyAtmos || !!filterPAStyle || !!filterPACountry;

  const resetFilters = () => {
    setSearchTitle("");
    setSearchArtist("");
    setSearchYear("");
    setFilterTagId(null);
    setYearFrom("");
    setYearTo("");
    setFilterGenres(new Set());
    setFilterDolbyAtmos(false);
    setFilterPAStyle("");
    setFilterPACountry("");
  };

  const toggleGenre = (g: string) => setFilterGenres((prev) => {
    const next = new Set(prev);
    next.has(g) ? next.delete(g) : next.add(g);
    return next;
  });

  const activeGenres = visibleGenres === null ? genres : genres.filter((g) => visibleGenres.has(g));

  const toggleVisibleGenre = (g: string) => {
    setVisibleGenres((prev) => {
      const base = prev === null ? new Set(genres) : new Set(prev);
      base.has(g) ? base.delete(g) : base.add(g);
      const next = base.size === genres.length ? null : base;
      localStorage.setItem("tao_visible_genres", JSON.stringify(next === null ? null : [...next]));
      return next;
    });
  };

  const setAllVisible = (all: boolean) => {
    const next = all ? null : new Set<string>();
    setVisibleGenres(next);
    localStorage.setItem("tao_visible_genres", JSON.stringify(next === null ? null : [...next]));
  };

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

  useEffect(() => {
    if (!showGenreDropdown) return;
    const handler = (e: MouseEvent) => {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(e.target as Node)) {
        setShowGenreDropdown(false);
        setGenreSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showGenreDropdown]);

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
                : <><CheckSquare className="w-4 h-4" /> Selecteer alles {hasFilters && `(${displayAlbums.length})`}</>
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
              <div className="relative" ref={genreDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted">Genre</label>
                  <button
                    onClick={() => { setShowGenreDropdown(false); setGenreSearch(""); setShowGenreManager(true); }}
                    title="Beheer zichtbare genres"
                    className="text-muted hover:text-white transition-colors"
                  >
                    <Settings2 size={12} />
                  </button>
                </div>
                <div className={`input py-1 text-xs w-44 flex items-center gap-1 ${filterGenres.size > 0 ? "border-accent" : ""}`}>
                  <input
                    className="bg-transparent outline-none flex-1 min-w-0 placeholder-muted"
                    placeholder={
                      filterGenres.size === 0
                        ? "Alle genres"
                        : filterGenres.size === 1
                        ? [...filterGenres][0]
                        : `${filterGenres.size} genres`
                    }
                    value={genreSearch}
                    onFocus={() => setShowGenreDropdown(true)}
                    onChange={(e) => { setGenreSearch(e.target.value); setShowGenreDropdown(true); }}
                  />
                  <span
                    className="text-border shrink-0 cursor-pointer select-none"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowGenreDropdown((v) => { if (v) setGenreSearch(""); return !v; });
                    }}
                  >▾</span>
                </div>
                {showGenreDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-30 w-52 max-h-64 overflow-y-auto">
                    {filterGenres.size > 0 && (
                      <button
                        onClick={() => setFilterGenres(new Set())}
                        className="w-full text-left px-3 py-2 text-xs text-accent hover:bg-card border-b border-border"
                      >
                        Wis selectie ({filterGenres.size})
                      </button>
                    )}
                    {activeGenres
                      .filter((g) => !genreSearch || g.toLowerCase().includes(genreSearch.toLowerCase()))
                      .map((g) => (
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
                    {genreSearch && !activeGenres.some((g) => g.toLowerCase().includes(genreSearch.toLowerCase())) && (
                      <p className="px-3 py-2 text-xs text-muted">Geen resultaten</p>
                    )}
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
            {paStyles.length > 0 && (
              <div>
                <label className="text-xs text-muted block mb-1">PA Stijl</label>
                <select
                  className={`input py-1 text-xs w-44 ${filterPAStyle ? "border-accent" : ""}`}
                  value={filterPAStyle}
                  onChange={(e) => setFilterPAStyle(e.target.value)}
                >
                  <option value="">Alle stijlen</option>
                  {paStyles.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            {paCountries.length > 0 && (
              <div>
                <label className="text-xs text-muted block mb-1">PA Land</label>
                <select
                  className={`input py-1 text-xs w-40 ${filterPACountry ? "border-accent" : ""}`}
                  value={filterPACountry}
                  onChange={(e) => setFilterPACountry(e.target.value)}
                >
                  <option value="">Alle landen</option>
                  {paCountries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status balk: teller + sync resultaat + sortering */}
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted">
              {isLoading ? "Laden..." : `${displayAlbums.length}${showOnlyNew ? "" : albums.length !== displayAlbums.length ? `/${albums.length}` : ""} albums`}
              {hasFilters && " (gefilterd)"}
            </span>

            {/* Sync resultaat banner */}
            {sync.isSuccess && newAlbumIds.size > 0 && (
              <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
                ✓ {newAlbumIds.size} nieuwe album{newAlbumIds.size !== 1 ? "s" : ""} toegevoegd
                <button
                  onClick={() => setShowOnlyNew((v) => !v)}
                  className={`underline hover:no-underline ${showOnlyNew ? "text-white" : ""}`}
                >
                  {showOnlyNew ? "Toon alles" : "Toon alleen nieuwe"}
                </button>
                <button onClick={() => { setNewAlbumIds(new Set()); setShowOnlyNew(false); }} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {sync.isSuccess && newAlbumIds.size === 0 && sync.data && sync.data.added === 0 && (
              <span className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-lg text-xs text-accent">
                Sync: {sync.data.updated} bijgewerkt, geen nieuwe albums
              </span>
            )}

            {reimport.data && (
              <span className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-lg text-xs text-accent">
                Her-import: {reimport.data.added} nieuw · favorieten {reimport.data.sources.favorieten?.total ?? 0} · playlists {reimport.data.sources.playlists?.total ?? 0}
              </span>
            )}

            <div className="flex-1" />

            {/* Sortering */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted mr-1">Sorteren:</span>
              {(Object.keys(SORT_LABELS) as SortField[]).map((field) => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs transition-colors ${
                    sortBy === field
                      ? "bg-accent/15 text-accent font-medium"
                      : "text-muted hover:text-white"
                  }`}
                >
                  {SORT_LABELS[field]}
                  {sortBy === field && (
                    sortDir === "asc"
                      ? <ChevronUp className="w-3 h-3" />
                      : <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayAlbums.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted gap-3">
              <p className="text-lg">Geen albums gevonden</p>
              {hasFilters || showOnlyNew
                ? <p className="text-sm">Pas de filters aan of klik Reset.</p>
                : <p className="text-sm">Druk op "Sync Tidal" om je favorieten te importeren.</p>
              }
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-5">
              {displayAlbums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  selected={selectedIds.has(album.id)}
                  isNew={newAlbumIds.has(album.id)}
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

      {/* Genre manager modal */}
      {showGenreManager && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowGenreManager(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-2xl w-96 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold">Genres in filterdropdown</h2>
              <button onClick={() => setShowGenreManager(false)} className="text-muted hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-muted px-4 pt-3 pb-1">
              {visibleGenres === null
                ? "Alle genres worden getoond. Deselecteer genres om de lijst te beperken."
                : visibleGenres.size === 0
                ? "Geen genres geselecteerd — de dropdown is leeg."
                : `${visibleGenres.size} van ${genres.length} genres zichtbaar in de dropdown.`}
            </p>
            <div className="flex gap-2 px-4 py-2 border-b border-border">
              <button
                onClick={() => setAllVisible(true)}
                className="text-xs text-accent hover:underline"
              >
                Alles selecteren
              </button>
              <span className="text-muted text-xs">·</span>
              <button
                onClick={() => setAllVisible(false)}
                className="text-xs text-accent hover:underline"
              >
                Alles deselecteren
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {genres.map((g) => (
                <label
                  key={g}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-card cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleGenres === null || visibleGenres.has(g)}
                    onChange={() => toggleVisibleGenre(g)}
                    className="accent-accent w-3.5 h-3.5 shrink-0"
                  />
                  <span className="text-xs capitalize">{g}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
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
