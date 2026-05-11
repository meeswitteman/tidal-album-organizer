import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Music2, Search, ExternalLink, Download, Check, X } from "lucide-react";
import { getTidalPlaylists, getAlbumLists, importFromPlaylists } from "../api/client";

interface ImportModalProps {
  selectedPlaylists: { id: string; name: string }[];
  onClose: () => void;
}

function ImportModal({ selectedPlaylists, onClose }: ImportModalProps) {
  const qc = useQueryClient();
  const [targetListId, setTargetListId] = useState<number | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  const { data: albumLists = [] } = useQuery({
    queryKey: ["albumlists"],
    queryFn: getAlbumLists,
  });

  const doImport = useMutation({
    mutationFn: () => importFromPlaylists(targetListId!, selectedPlaylists.map((p) => p.id)),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["albumlist", targetListId] });
      qc.invalidateQueries({ queryKey: ["albumlists"] });
      setResult({ added: data.added, skipped: data.skipped });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-accent" />
            <span className="font-semibold">Importeer naar albumlijst</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-accent" />
            </div>
            <p className="font-medium">Import klaar</p>
            <p className="text-sm text-muted">
              <span className="text-white font-medium">{result.added}</span> albums toegevoegd
              &nbsp;·&nbsp;
              <span className="text-border">{result.skipped}</span> al aanwezig
            </p>
            <button onClick={onClose} className="btn-primary w-full justify-center">
              Sluiten
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Geselecteerde playlists */}
            <div>
              <p className="text-xs text-muted mb-2">
                {selectedPlaylists.length} playlist{selectedPlaylists.length !== 1 ? "s" : ""} geselecteerd
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedPlaylists.map((p) => (
                  <span key={p.id} className="px-2 py-0.5 bg-card border border-border rounded text-xs truncate max-w-[180px]">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Kies albumlijst */}
            <div>
              <p className="text-xs text-muted mb-2">Kies een albumlijst</p>
              {albumLists.length === 0 ? (
                <p className="text-sm text-muted">Geen albumlijsten gevonden. Maak er eerst een aan.</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {albumLists.map((al) => (
                    <label
                      key={al.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        targetListId === al.id
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="albumlist"
                        checked={targetListId === al.id}
                        onChange={() => setTargetListId(al.id)}
                        className="accent-accent"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{al.name}</p>
                        <p className="text-xs text-muted">{al.album_count} albums</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {doImport.isError && (
              <p className="text-xs text-red-400">Import mislukt. Probeer opnieuw.</p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="btn-ghost flex-1">Annuleren</button>
              <button
                onClick={() => doImport.mutate()}
                disabled={targetListId === null || doImport.isPending}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {doImport.isPending ? "Bezig..." : "Importeren"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TidalPlaylists() {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ["tidal-playlists", search],
    queryFn: () => getTidalPlaylists(search || undefined),
  });

  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === playlists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlists.map((p) => p.id)));
    }
  };

  const selectedPlaylists = playlists.filter((p) => selectedIds.has(p.id));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 shrink-0 flex-wrap">
        <Music2 className="w-5 h-5 text-accent shrink-0" />
        <h2 className="text-lg font-bold">Tidal Playlists</h2>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            className="input pl-9 w-56"
            placeholder="Filter op naam..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!isLoading && (
          <span className="text-xs text-muted">{playlists.length} playlists</span>
        )}

        <div className="flex-1" />

        {selectedIds.size > 0 && (
          <>
            <span className="text-xs text-muted">{selectedIds.size} geselecteerd</span>
            <button
              onClick={() => setShowImport(true)}
              className="btn-primary"
            >
              <Download className="w-4 h-4" />
              Importeer naar albumlijst
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-ghost">
              <X className="w-4 h-4" /> Deselecteer
            </button>
          </>
        )}
      </div>

      {/* Lijst */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && playlists.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-muted gap-2">
            <Music2 className="w-12 h-12 opacity-30" />
            <p>{search ? "Geen playlists gevonden." : "Geen Tidal playlists."}</p>
          </div>
        )}

        {!isLoading && playlists.length > 0 && (
          <div>
            {/* Alles selecteren */}
            <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-surface/50">
              <button
                onClick={toggleAll}
                className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                  selectedIds.size === playlists.length && playlists.length > 0
                    ? "bg-accent border-accent"
                    : "border-border hover:border-accent/60"
                }`}
              >
                {selectedIds.size === playlists.length && playlists.length > 0 && (
                  <Check className="w-2.5 h-2.5 text-black" />
                )}
              </button>
              <span className="text-xs text-muted">
                {selectedIds.size > 0 ? `${selectedIds.size} geselecteerd` : "Alles selecteren"}
              </span>
            </div>

            <div className="divide-y divide-border/50">
              {playlists.map((pl) => {
                const sel = selectedIds.has(pl.id);
                return (
                  <div
                    key={pl.id}
                    className={`flex items-center gap-4 px-6 py-3 transition-colors ${
                      sel ? "bg-accent/5" : "hover:bg-card/50"
                    }`}
                  >
                    {/* Selectie */}
                    <button
                      onClick={() => toggleSelect(pl.id)}
                      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                        sel ? "bg-accent border-accent" : "border-border hover:border-accent/60"
                      }`}
                    >
                      {sel && <Check className="w-2.5 h-2.5 text-black" />}
                    </button>

                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Music2 className="w-4 h-4 text-accent" />
                    </div>

                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleSelect(pl.id)}>
                      <p className="text-sm font-medium truncate">{pl.name}</p>
                      <p className="text-xs text-muted">
                        {pl.num_tracks} tracks
                        {pl.description && <span className="ml-2">· {pl.description}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`tidal://playlist/${pl.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn-ghost text-xs px-2 py-1"
                        title="Open in Tidal app"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> App
                      </a>
                      <a
                        href={`https://tidal.com/browse/playlist/${pl.id}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="btn-ghost text-xs px-2 py-1 text-muted"
                        title="Open in browser"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Web
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showImport && (
        <ImportModal
          selectedPlaylists={selectedPlaylists}
          onClose={() => { setShowImport(false); setSelectedIds(new Set()); }}
        />
      )}
    </div>
  );
}
