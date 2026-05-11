import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Upload, ArrowUpDown, Plus, Trash2, Music,
  ExternalLink, X, Check, Search,
} from "lucide-react";
import {
  getAlbumList, sortAlbumList, reorderAlbumList,
  removeAlbumListItems, addAlbumListItems, exportAlbumList,
  updateAlbumList, getAlbums,
} from "../api/client";
import { AlbumCard } from "../components/AlbumCard";
import { AlbumDetail } from "../components/AlbumDetail";
import type { AlbumListItem, ExportMode, SortMode } from "../types";

interface Props {
  listId: number;
  onBack: () => void;
}

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: "date_added", label: "Datum" },
  { mode: "artist", label: "Artiest" },
  { mode: "title", label: "Naam" },
  { mode: "year", label: "Jaar" },
];

const EXPORT_MODES: { mode: ExportMode; label: string; desc: string }[] = [
  { mode: "full", label: "Volledige albums", desc: "Alle nummers van elk album" },
  { mode: "first", label: "Eerste nummer", desc: "Alleen track 1 per album" },
  { mode: "random", label: "Random nummer", desc: "Eén willekeurig nummer per album" },
  { mode: "long", label: "Lange nummers", desc: "Alleen nummers langer dan ingestelde tijd" },
];

function ExportModal({ listId, listName, onClose }: { listId: number; listName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}-${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const [playlistName, setPlaylistName] = useState(`tao_export_${listName}_${ts}`);
  const [mode, setMode] = useState<ExportMode>("full");
  const [minMin, setMinMin] = useState(10);
  const [result, setResult] = useState<{ tracks_added: number; tidal_url: string | null } | null>(null);

  const doExport = useMutation({
    mutationFn: () => exportAlbumList(listId, playlistName, mode, minMin * 60),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      setResult({ tracks_added: data.tracks_added, tidal_url: data.tidal_url });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent" />
            <span className="font-semibold">Exporteren naar Tidal</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {result ? (
          <div className="p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-accent" />
            </div>
            <p className="font-medium">Playlist aangemaakt!</p>
            <p className="text-sm text-muted">{result.tracks_added} tracks toegevoegd aan <strong>{playlistName}</strong></p>
            {result.tidal_url && (
              <a href={`tidal://playlist/${result.tidal_url.split("/").pop()}`}
                className="btn-primary w-full justify-center">
                <ExternalLink className="w-4 h-4" /> Open in Tidal app
              </a>
            )}
            <button onClick={onClose} className="btn-ghost w-full justify-center">Sluiten</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs text-muted block mb-1">Naam in Tidal</label>
              <input className="input" value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} />
            </div>

            <div>
              <label className="text-xs text-muted block mb-2">Wat exporteren?</label>
              <div className="space-y-2">
                {EXPORT_MODES.map((opt) => (
                  <label
                    key={opt.mode}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      mode === opt.mode ? "border-accent bg-accent/10" : "border-border hover:border-accent/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={opt.mode}
                      checked={mode === opt.mode}
                      onChange={() => setMode(opt.mode)}
                      className="mt-0.5 accent-accent"
                    />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {mode === "long" && (
              <div>
                <label className="text-xs text-muted block mb-1">Minimale duur (minuten)</label>
                <input
                  type="number"
                  className="input w-24"
                  value={minMin}
                  min={1}
                  onChange={(e) => setMinMin(parseInt(e.target.value) || 1)}
                />
              </div>
            )}

            {doExport.isError && (
              <p className="text-xs text-red-400">Export mislukt. Controleer de verbinding.</p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="btn-ghost flex-1">Annuleren</button>
              <button
                onClick={() => doExport.mutate()}
                disabled={!playlistName.trim() || doExport.isPending}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {doExport.isPending ? "Bezig..." : "Exporteren"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddAlbumsModal({ listId, existingIds, onClose }: {
  listId: number;
  existingIds: Set<string>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [searchYear, setSearchYear] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: albums = [] } = useQuery({
    queryKey: ["albums-picker", searchTitle, searchArtist, searchYear],
    queryFn: () => getAlbums({
      title: searchTitle || undefined,
      artist: searchArtist || undefined,
      year_from: searchYear ? parseInt(searchYear) : undefined,
      year_to: searchYear ? parseInt(searchYear) : undefined,
    }),
  });

  const add = useMutation({
    mutationFn: () => addAlbumListItems(listId, Array.from(selectedIds)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albumlist", listId] });
      onClose();
    },
  });

  const toggle = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const available = albums.filter((a) => !existingIds.has(a.id));

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <span className="font-semibold">Albums toevoegen</span>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-3 border-b border-border shrink-0 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Album..."
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            autoFocus
          />
          <input
            className="input flex-1"
            placeholder="Artiest..."
            value={searchArtist}
            onChange={(e) => setSearchArtist(e.target.value)}
          />
          <input
            className="input w-20"
            placeholder="Jaar"
            value={searchYear}
            onChange={(e) => setSearchYear(e.target.value)}
            maxLength={4}
          />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {available.length === 0 && (
            <p className="text-center text-muted text-sm py-8">Geen albums gevonden</p>
          )}
          {available.map((album) => {
            const sel = selectedIds.has(album.id);
            return (
              <div
                key={album.id}
                onClick={() => toggle(album.id)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  sel ? "bg-accent/10" : "hover:bg-card"
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                  sel ? "bg-accent border-accent" : "border-border"
                }`}>
                  {sel && <Check className="w-2.5 h-2.5 text-black" />}
                </div>
                <div className="w-8 h-8 rounded overflow-hidden bg-card shrink-0">
                  {album.cover_url
                    ? <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-border" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{album.title}</p>
                  <p className="text-xs text-muted truncate">{album.artist}{album.year ? ` · ${album.year}` : ""}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-border shrink-0 flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1">Annuleren</button>
          <button
            onClick={() => add.mutate()}
            disabled={selectedIds.size === 0 || add.isPending}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {selectedIds.size > 0 ? `${selectedIds.size} album${selectedIds.size !== 1 ? "s" : ""} toevoegen` : "Selecteer albums"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlbumListDetail({ listId, onBack }: Props) {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [zoomedCover, setZoomedCover] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterArtist, setFilterArtist] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const { data: list, isLoading } = useQuery({
    queryKey: ["albumlist", listId],
    queryFn: () => getAlbumList(listId),
  });

  useEffect(() => {
    if (list?.name) {
      document.title = `TAO - Tidal Album Organizer - ${list.name}`;
      return () => { document.title = "TAO - Tidal Album Organizer - Albumlijsten"; };
    }
  }, [list?.name]);

  const sort = useMutation({
    mutationFn: (mode: SortMode) => sortAlbumList(listId, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["albumlist", listId] }),
  });

  const moveItem = useMutation({
    mutationFn: (item_ids: number[]) => reorderAlbumList(listId, item_ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["albumlist", listId] }),
  });

  const removeSelected = useMutation({
    mutationFn: () => removeAlbumListItems(listId, Array.from(selectedIds)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albumlist", listId] });
      qc.invalidateQueries({ queryKey: ["albumlists"] });
      setSelectedIds(new Set());
    },
  });

  const saveEdit = useMutation({
    mutationFn: () => updateAlbumList(listId, editName, editDesc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albumlist", listId] });
      qc.invalidateQueries({ queryKey: ["albumlists"] });
      setEditing(false);
    },
  });

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (items: AlbumListItem[]) => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.album_id)));
    }
  };

  const move = (item: AlbumListItem, dir: -1 | 1) => {
    if (!list) return;
    const ids = list.items.map((i) => i.id);
    const idx = ids.indexOf(item.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= ids.length) return;
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    moveItem.mutate(ids);
  };

  const startEdit = () => {
    if (!list) return;
    setEditName(list.name);
    setEditDesc(list.description);
    setEditing(true);
  };

  if (isLoading || !list) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const existingIds = new Set(list.items.map((i) => i.album_id));

  const filteredItems = list.items.filter((item) => {
    const a = item.album;
    if (filterTitle && !a.title?.toLowerCase().includes(filterTitle.toLowerCase())) return false;
    if (filterArtist && !a.artist?.toLowerCase().includes(filterArtist.toLowerCase())) return false;
    if (filterYear && String(a.year ?? "") !== filterYear) return false;
    return true;
  });
  const hasFilter = !!filterTitle || !!filterArtist || !!filterYear;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 shrink-0 flex-wrap">
        <button onClick={onBack} className="btn-ghost p-2 rounded-lg">
          <ArrowLeft className="w-4 h-4" />
        </button>

        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input className="input flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            <input className="input flex-1" placeholder="Beschrijving" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            <button onClick={() => saveEdit.mutate()} className="btn-primary">Opslaan</button>
            <button onClick={() => setEditing(false)} className="btn-ghost">Annuleren</button>
          </div>
        ) : (
          <div className="flex-1 cursor-pointer" onClick={startEdit}>
            <p className="font-bold text-lg hover:text-accent transition-colors">{list.name}</p>
            {list.description && <p className="text-xs text-muted">{list.description}</p>}
          </div>
        )}

        <span className="text-xs text-muted">
          {hasFilter ? `${filteredItems.length} / ${list.items.length}` : list.items.length} albums
        </span>

        {/* Filterinputs */}
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-muted shrink-0" />
          <input
            className="input py-1 text-xs w-28"
            placeholder="Album..."
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
          />
          <input
            className="input py-1 text-xs w-28"
            placeholder="Artiest..."
            value={filterArtist}
            onChange={(e) => setFilterArtist(e.target.value)}
          />
          <input
            className="input py-1 text-xs w-16"
            placeholder="Jaar"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            maxLength={4}
          />
          {hasFilter && (
            <button
              onClick={() => { setFilterTitle(""); setFilterArtist(""); setFilterYear(""); }}
              className="btn-ghost p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sorteren */}
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              onClick={() => sort.mutate(opt.mode)}
              disabled={sort.isPending}
              className="btn-ghost text-xs px-2 py-1"
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowAdd(true)} className="btn-ghost">
          <Plus className="w-4 h-4" /> Toevoegen
        </button>

        {selectedIds.size > 0 && (
          <>
            <button
              onClick={() => toggleAll(filteredItems)}
              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                selectedIds.size === filteredItems.length && filteredItems.length > 0
                  ? "bg-accent border-accent"
                  : "border-border hover:border-accent/60"
              }`}
            >
              {selectedIds.size === filteredItems.length && filteredItems.length > 0 && (
                <Check className="w-2.5 h-2.5 text-black" />
              )}
            </button>
            <button onClick={() => removeSelected.mutate()} className="btn-danger">
              <Trash2 className="w-4 h-4" /> Verwijder ({selectedIds.size})
            </button>
          </>
        )}

        {selectedIds.size === 0 && (
          <button
            onClick={() => toggleAll(filteredItems)}
            className="btn-ghost text-xs"
          >
            Alles selecteren
          </button>
        )}

        <button onClick={() => setShowExport(true)} className="btn-primary">
          <Upload className="w-4 h-4" /> Exporteer
        </button>
      </div>

      {/* Content: grid + detail panel */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-6">
          {list.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted gap-3">
              <Music className="w-12 h-12 opacity-30" />
              <p>Nog geen albums in deze lijst.</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Albums toevoegen
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted gap-3">
              <p>Geen albums gevonden met deze filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-5">
              {filteredItems.map((item) => (
                <AlbumCard
                  key={item.id}
                  album={item.album}
                  selected={selectedIds.has(item.album_id)}
                  onClick={() => setActiveAlbumId(item.album_id === activeAlbumId ? null : item.album_id)}
                  onToggleSelect={(e) => toggleSelect(item.album_id, e)}
                  onShowCover={(e) => { e.stopPropagation(); setZoomedCover(item.album.cover_url); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {activeAlbumId && (
          <div className="w-80 shrink-0">
            <AlbumDetail albumId={activeAlbumId} onClose={() => setActiveAlbumId(null)} />
          </div>
        )}
      </div>

      {/* Zoom overlay */}
      {zoomedCover && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm cursor-zoom-out p-4"
          onClick={() => setZoomedCover(null)}
        >
          <img src={zoomedCover} alt="" className="w-full h-full object-contain rounded-2xl shadow-2xl" />
        </div>
      )}

      {showExport && (
        <ExportModal listId={listId} listName={list.name} onClose={() => setShowExport(false)} />
      )}
      {showAdd && (
        <AddAlbumsModal listId={listId} existingIds={existingIds} onClose={() => {
          setShowAdd(false);
          qc.invalidateQueries({ queryKey: ["albumlist", listId] });
          qc.invalidateQueries({ queryKey: ["albumlists"] });
        }} />
      )}
    </div>
  );
}
