import { Play, Pause, ListMusic } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface MiniPlayerProps {
  onShowAlbum?: (albumId: string) => void;
}

export function MiniPlayer({ onShowAlbum }: MiniPlayerProps) {
  const { trackId, albumId, trackTitle, artist, isPlaying, currentTime, duration, togglePlay, seek } = usePlayer();

  if (!trackId) return null;

  return (
    <div className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-2">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0"
        >
          {isPlaying
            ? <Pause className="w-3.5 h-3.5 text-black fill-black" />
            : <Play className="w-3.5 h-3.5 text-black fill-black ml-0.5" />
          }
        </button>
        <div className="min-w-0 flex-1">
          {albumId && onShowAlbum ? (
            <button
              onClick={() => onShowAlbum(albumId)}
              className="group/title flex items-center gap-1 min-w-0 text-left hover:text-accent transition-colors"
              title="Toon album"
            >
              <span className="text-xs font-medium truncate">{trackTitle}</span>
              <ListMusic className="w-3 h-3 shrink-0 text-muted group-hover/title:text-accent transition-colors" />
            </button>
          ) : (
            <p className="text-xs font-medium truncate">{trackTitle}</p>
          )}
          <p className="text-xs text-muted truncate">{artist}</p>
        </div>
        <div className="text-xs text-muted shrink-0 tabular-nums">
          {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
        </div>
      </div>
      <div
        className="h-1 bg-border rounded-full cursor-pointer group/bar"
        onClick={(e) => {
          if (!duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - rect.left) / rect.width) * duration);
        }}
      >
        <div
          className="h-full bg-accent rounded-full relative group-hover/bar:bg-accent/80 transition-colors"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover/bar:opacity-100 translate-x-1/2 transition-opacity" />
        </div>
      </div>
    </div>
  );
}
