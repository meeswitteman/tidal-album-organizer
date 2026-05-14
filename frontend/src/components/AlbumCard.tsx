import { Music, Maximize2 } from "lucide-react";
import { clsx } from "clsx";
import type { Album } from "../types";
import { TagBadge } from "./TagBadge";
import { TruncatedTitle } from "./TruncatedTitle";

interface Props {
  album: Album;
  selected: boolean;
  isNew?: boolean;
  onClick: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onShowCover: (e: React.MouseEvent) => void;
}

export function AlbumCard({ album, selected, isNew, onClick, onToggleSelect, onShowCover }: Props) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200",
        "bg-card border hover:border-accent/50 hover:scale-[1.02]",
        selected ? "border-accent ring-1 ring-accent" : "border-border"
      )}
    >
      {/* Cover */}
      <div className="aspect-square relative bg-surface">
        {album.cover_url ? (
          <img
            src={album.cover_url}
            alt={album.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-12 h-12 text-border" />
          </div>
        )}

        {/* Select checkbox — links */}
        <button
          onClick={onToggleSelect}
          className={clsx(
            "absolute top-2 left-2 w-5 h-5 rounded border-2 transition-all",
            "opacity-0 group-hover:opacity-100",
            selected
              ? "opacity-100 bg-accent border-accent"
              : "bg-black/50 border-white/50 hover:border-white"
          )}
        >
          {selected && (
            <svg viewBox="0 0 10 10" className="w-full h-full p-0.5 text-black">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* NIEUW badge */}
        {isNew && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight bg-emerald-500/90 text-white">
            NIEUW
          </div>
        )}

        {/* Cover vergroten — rechts */}
        {album.cover_url && (
          <button
            onClick={onShowCover}
            className="absolute top-2 right-2 w-5 h-5 rounded bg-black/50 border-2 border-white/50 hover:border-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
          >
            <Maximize2 className="w-2.5 h-2.5 text-white" />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <TruncatedTitle title={album.title} className="text-sm font-medium text-white leading-tight" />
        <p className="text-xs text-muted line-clamp-1">
          {album.artist}
          {album.year && <span className="ml-1 text-border">· {album.year}</span>}
          {album.audio_modes?.includes("DOLBY_ATMOS") && (
            <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold tracking-tight bg-blue-500/20 text-blue-400 border border-blue-500/30">
              ATMOS
            </span>
          )}
        </p>

        {album.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {album.tags.slice(0, 3).map((t) => (
              <TagBadge key={t.id} tag={t} />
            ))}
            {album.tags.length > 3 && (
              <span className="text-xs text-muted">+{album.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
