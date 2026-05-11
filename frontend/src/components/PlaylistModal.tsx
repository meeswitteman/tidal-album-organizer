import { useState } from "react";
import { X, ListMusic } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPlaylist } from "../api/client";
import type { Album } from "../types";

interface Props {
  selectedAlbums: Album[];
  onClose: () => void;
}

export function PlaylistModal({ selectedAlbums, onClose }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      createPlaylist(name, description, selectedAlbums.map((a) => a.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-accent" />
            <span className="font-semibold">Nieuwe playlist</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Selected albums */}
          <div>
            <p className="text-xs text-muted mb-2">
              {selectedAlbums.length} album{selectedAlbums.length !== 1 ? "s" : ""} geselecteerd
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedAlbums.slice(0, 6).map((a) => (
                <span key={a.id} className="px-2 py-0.5 bg-card border border-border rounded text-xs truncate max-w-[140px]">
                  {a.title}
                </span>
              ))}
              {selectedAlbums.length > 6 && (
                <span className="px-2 py-0.5 text-xs text-muted">
                  +{selectedAlbums.length - 6} meer
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Naam</label>
            <input
              className="input"
              placeholder="Playlist naam..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Beschrijving (optioneel)</label>
            <input
              className="input"
              placeholder="Beschrijving..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {create.isError && (
            <p className="text-xs text-red-400">
              Er ging iets mis. Is Tidal verbonden?
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-ghost flex-1">
              Annuleren
            </button>
            <button
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {create.isPending ? "Aanmaken..." : "Aanmaken in Tidal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
