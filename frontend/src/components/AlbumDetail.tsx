import { X, ExternalLink, Clock, Music, Play, Pause, Loader } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
// useRef/useState/useEffect still used by TruncatedTitle (imported below) and saveNotes
import { getAlbumDetail, addTagToAlbum, removeTagFromAlbum, updateNotes, getTags } from "../api/client";
import { TagBadge } from "./TagBadge";
import { TruncatedTitle } from "./TruncatedTitle";
import { usePlayer } from "../context/PlayerContext";

interface Props {
  albumId: string;
  onClose: () => void;
}


function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AlbumDetail({ albumId, onClose }: Props) {
  const qc = useQueryClient();
  const { trackId: playingTrackId, isPlaying, loadingTrackId, playTrack: ctxPlayTrack } = usePlayer();

  const { data: album, isLoading } = useQuery({
    queryKey: ["album", albumId],
    queryFn: () => getAlbumDetail(albumId),
  });

  const buildQueue = () =>
    album?.tracks?.map((t) => ({ id: t.id, title: t.title, artist: t.artist ?? album.artist ?? "" })) ?? [];

  const handlePlayTrack = (trackId: string) => {
    const queue = buildQueue();
    const track = album?.tracks?.find((t) => t.id === trackId);
    ctxPlayTrack(trackId, track?.title ?? "", track?.artist ?? album?.artist ?? "", queue);
  };
  const { data: allTags = [] } = useQuery({ queryKey: ["tags"], queryFn: getTags });

  const addTag = useMutation({
    mutationFn: (tagId: number) => addTagToAlbum(albumId, tagId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["albums"] }); qc.invalidateQueries({ queryKey: ["album", albumId] }); },
  });
  const removeTag = useMutation({
    mutationFn: (tagId: number) => removeTagFromAlbum(albumId, tagId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["albums"] }); qc.invalidateQueries({ queryKey: ["album", albumId] }); },
  });
  const saveNotes = useMutation({
    mutationFn: (notes: string) => updateNotes(albumId, notes),
  });

  const appliedTagIds = new Set(album?.tags.map((t) => t.id) ?? []);
  const availableTags = allTags.filter((t) => !appliedTagIds.has(t.id));

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <span className="text-sm font-medium text-muted">Album details</span>
        <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {album && (
        <div className="flex-1 overflow-y-auto">
          {/* Cover + title */}
          <div className="p-4 space-y-4">
            <div className="flex gap-4">
              <div className="w-28 h-28 shrink-0 rounded-lg overflow-hidden bg-card">
                {album.cover_url ? (
                  <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-8 h-8 text-border" />
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <a
                  href={`tidal://album/${album.id}`}
                  className="block text-lg font-bold leading-tight hover:text-accent transition-colors"
                  title="Open in Tidal app"
                >
                  {album.title}
                </a>
                {album.artist_id ? (
                  <a
                    href={`tidal://artist/${album.artist_id}`}
                    className="block text-muted text-sm hover:text-accent transition-colors"
                    title="Open artiest in Tidal app"
                  >
                    {album.artist}
                  </a>
                ) : (
                  <p className="text-muted text-sm">{album.artist}</p>
                )}
                {album.year && <p className="text-muted text-sm">{album.year}</p>}
                {album.num_tracks && (
                  <p className="text-xs text-border">{album.num_tracks} tracks</p>
                )}
                {album.tidal_url && (
                  <a
                    href={album.tidal_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted hover:underline"
                  >
                    Open in browser <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Genres */}
            {album.genres && album.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {album.genres.map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded-full text-xs bg-border/30 text-muted border border-border">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Tags */}
            <div>
              <p className="text-xs font-medium text-muted mb-2">Tags</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {album.tags.map((t) => (
                  <TagBadge key={t.id} tag={t} onRemove={() => removeTag.mutate(t.id)} />
                ))}
              </div>
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {availableTags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => addTag.mutate(t.id)}
                      className="px-2 py-0.5 rounded-full text-xs border border-dashed border-border text-muted hover:border-accent hover:text-accent transition-colors"
                    >
                      + {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Review links */}
            {album.review_links && album.review_links.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted mb-2">Reviews &amp; info</p>
                <div className="flex flex-wrap gap-1.5">
                  {album.review_links.map((link) => (
                    <a
                      key={link.name}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      title={link.search ? `Zoeken op ${link.name}` : link.name}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-border text-muted hover:border-accent hover:text-accent transition-colors"
                    >
                      {link.name}
                      {link.search && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Wikipedia */}
            {album.wikipedia_summary && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">
                  {album.wikipedia_source === "artist" ? `Over ${album.artist}` : "Over dit album"}
                </p>
                <p className="text-sm text-white/80 leading-relaxed line-clamp-6">
                  {album.wikipedia_summary}
                </p>
                {album.wikipedia_url && (
                  <a
                    href={album.wikipedia_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    Meer op Wikipedia <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

          </div>

          {/* Tracklist */}
          {album.tracks && album.tracks.length > 0 && (
            <div className="border-t border-border">
              <div className="px-4 py-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted">Tracklist</p>
                <button
                  onClick={() => { if (album.tracks?.[0]) handlePlayTrack(album.tracks[0].id); }}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
                  title="Speel alle nummers af"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Speel alles
                </button>
              </div>
              <div className="divide-y divide-border/50">
                {album.tracks.map((track) => {
                  const isThisPlaying = playingTrackId === track.id && isPlaying;
                  const isThisLoading = loadingTrackId === track.id;
                  return (
                    <div
                      key={track.id}
                      className={`group flex items-center gap-3 px-4 py-2 hover:bg-card/50 cursor-pointer ${playingTrackId === track.id ? "bg-accent/5" : ""}`}
                      onClick={() => handlePlayTrack(track.id)}
                    >
                      <span className="w-5 shrink-0 flex items-center justify-center">
                        {isThisLoading ? (
                          <Loader className="w-3.5 h-3.5 text-accent animate-spin" />
                        ) : isThisPlaying ? (
                          <Pause className="w-3.5 h-3.5 text-accent fill-accent" />
                        ) : playingTrackId === track.id ? (
                          <Play className="w-3.5 h-3.5 text-accent fill-accent" />
                        ) : (
                          <>
                            <span className="group-hover:hidden text-xs text-border">{track.track_num}</span>
                            <Play className="hidden group-hover:block w-3.5 h-3.5 text-accent fill-accent" />
                          </>
                        )}
                      </span>
                      <TruncatedTitle title={track.title} className={`text-sm ${playingTrackId === track.id ? "text-accent" : ""}`} />
                      <span className="text-xs text-muted flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatDuration(track.duration)}
                      </span>
                      <a
                        href={`https://listen.tidal.com/album/${albumId}/track/${track.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in Tidal"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3 text-muted hover:text-accent" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="border-t border-border p-4">
            <p className="text-xs font-medium text-muted mb-1">Notities</p>
            <textarea
              className="input resize-none h-20 text-sm w-full"
              placeholder="Jouw notities over dit album..."
              defaultValue={album.notes}
              onBlur={(e) => saveNotes.mutate(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
