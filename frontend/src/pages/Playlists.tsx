import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ListMusic, ExternalLink, Trash2 } from "lucide-react";
import { getPlaylists, deletePlaylist } from "../api/client";

export function Playlists() {
  const qc = useQueryClient();
  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ["playlists"],
    queryFn: getPlaylists,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePlaylist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-3">
        <div className="flex items-center gap-2 mb-6">
          <ListMusic className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-bold">Aangemaakte playlists</h2>
          <span className="text-muted text-sm">({playlists.length})</span>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && playlists.length === 0 && (
          <div className="text-center py-16 text-muted">
            <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nog geen playlists aangemaakt.</p>
            <p className="text-sm mt-1">Selecteer albums in de bibliotheek om te starten.</p>
          </div>
        )}

        {playlists.map((pl) => (
          <div key={pl.id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-accent/30 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <ListMusic className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{pl.name}</p>
              <p className="text-xs text-muted">
                {pl.track_count} tracks
                {pl.created_at && (
                  <span className="ml-2">
                    · {new Date(pl.created_at).toLocaleDateString("nl-NL")}
                  </span>
                )}
              </p>
              {pl.description && <p className="text-xs text-muted mt-0.5 truncate">{pl.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pl.tidal_url && (
                <a
                  href={pl.tidal_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost p-2 rounded-lg"
                  title="Open in Tidal"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={() => remove.mutate(pl.id)}
                className="btn-danger p-2 rounded-lg"
                title="Verwijder"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
