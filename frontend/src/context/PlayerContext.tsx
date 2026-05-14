import { createContext, useContext, useRef, useState, useCallback } from "react";
import { getTrackStreamUrl } from "../api/client";

export interface QueueItem {
  id: string;
  title: string;
  artist: string;
}

interface PlayerContextType {
  trackId: string | null;
  albumId: string | null;
  trackTitle: string;
  artist: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loadingTrackId: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playTrack: (id: string, title: string, artist: string, queue?: QueueItem[], albumId?: string) => Promise<void>;
  togglePlay: () => void;
  seek: (time: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const trackIdRef = useRef<string | null>(null);

  const [trackId, setTrackId] = useState<string | null>(null);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);

  const playNextRef = useRef<() => void>(() => {});

  const playTrack = useCallback(async (id: string, title: string, artistName: string, queue?: QueueItem[], newAlbumId?: string) => {
    if (queue) queueRef.current = queue;
    if (newAlbumId !== undefined) setAlbumId(newAlbumId);

    // Toggle pause/play if same track
    if (trackIdRef.current === id) {
      if (audioRef.current) {
        if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true); }
        else { audioRef.current.pause(); setIsPlaying(false); }
      }
      return;
    }

    setLoadingTrackId(id);
    try {
      const { url } = await getTrackStreamUrl(id);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setTrackId(id);
        trackIdRef.current = id;
        setTrackTitle(title);
        setArtist(artistName);
        setIsPlaying(true);
        setCurrentTime(0);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? (err as { message?: string })?.message ?? String(err);
      alert(`Kon track niet afspelen: ${msg}`);
    } finally {
      setLoadingTrackId(null);
    }
  }, []);

  playNextRef.current = () => {
    const queue = queueRef.current;
    const idx = queue.findIndex((t) => t.id === trackIdRef.current);
    if (idx >= 0 && idx < queue.length - 1) {
      const next = queue[idx + 1];
      playTrack(next.id, next.title, next.artist);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true); }
    else { audioRef.current.pause(); setIsPlaying(false); }
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  return (
    <PlayerContext.Provider value={{ trackId, albumId, trackTitle, artist, isPlaying, currentTime, duration, loadingTrackId, audioRef, playTrack, togglePlay, seek }}>
      {children}
      <audio
        ref={audioRef}
        onEnded={() => { setCurrentTime(0); playNextRef.current(); }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
    </PlayerContext.Provider>
  );
}
