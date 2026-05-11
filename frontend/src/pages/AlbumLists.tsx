import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ListOrdered, Trash2, ChevronRight } from "lucide-react";
import { getAlbumLists, createAlbumList, deleteAlbumList } from "../api/client";
import { AlbumListDetail } from "./AlbumListDetail";

export function AlbumLists() {
  const qc = useQueryClient();
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["albumlists"],
    queryFn: getAlbumLists,
  });

  const create = useMutation({
    mutationFn: () => createAlbumList(newName, newDesc),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["albumlists"] });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      setActiveListId(created.id);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteAlbumList(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["albumlists"] });
      if (activeListId === id) setActiveListId(null);
    },
  });

  if (activeListId !== null) {
    return (
      <AlbumListDetail
        listId={activeListId}
        onBack={() => setActiveListId(null)}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold">Albumlijsten</h2>
            <span className="text-muted text-sm">({lists.length})</span>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Nieuwe lijst
          </button>
        </div>

        {/* Aanmaken */}
        {showCreate && (
          <div className="p-4 bg-card border border-accent/30 rounded-xl space-y-3">
            <p className="text-sm font-medium">Nieuwe albumlijst</p>
            <input
              className="input"
              placeholder="Naam..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && newName.trim() && create.mutate()}
            />
            <input
              className="input"
              placeholder="Beschrijving (optioneel)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="btn-ghost flex-1">Annuleren</button>
              <button
                onClick={() => create.mutate()}
                disabled={!newName.trim()}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Aanmaken
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && lists.length === 0 && !showCreate && (
          <div className="text-center py-16 text-muted">
            <ListOrdered className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nog geen albumlijsten.</p>
            <p className="text-sm mt-1">Maak een lijst om albums te organiseren en te exporteren.</p>
          </div>
        )}

        {lists.map((al) => (
          <div
            key={al.id}
            className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-accent/30 transition-colors cursor-pointer group"
            onClick={() => setActiveListId(al.id)}
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <ListOrdered className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{al.name}</p>
              <p className="text-xs text-muted">
                {al.album_count} albums
                {al.created_at && (
                  <span className="ml-2">· {new Date(al.created_at).toLocaleDateString("nl-NL")}</span>
                )}
              </p>
              {al.description && (
                <p className="text-xs text-muted mt-0.5 truncate">{al.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); remove.mutate(al.id); }}
                className="btn-danger p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-white transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
