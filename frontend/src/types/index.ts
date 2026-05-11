export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string | null;
  year: number | null;
  cover_url: string | null;
  num_tracks: number | null;
  notes: string;
  added_at: string | null;
  tidal_url: string | null;
  genres: string[] | null;
  audio_modes: string[] | null;
  tags: Tag[];
}

export interface Track {
  id: string;
  title: string;
  duration: number;
  track_num: number;
  artist: string | null;
}

export interface ReviewLink {
  name: string;
  url: string;
  search?: boolean;
}

export interface AlbumDetail extends Album {
  wikipedia_summary: string | null;
  wikipedia_url: string | null;
  wikipedia_thumbnail: string | null;
  wikipedia_source: string | null;
  review_links: ReviewLink[] | null;
  genres: string[] | null;
  tracks: Track[] | null;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  track_count: number;
  tidal_url: string | null;
  created_at: string | null;
}

export interface AuthStatus {
  logged_in: boolean;
  username: string | null;
}

export interface SyncResult {
  added: number;
  updated: number;
  total: number;
}

export interface AlbumListItem {
  id: number;
  album_id: string;
  position: number;
  added_at: string | null;
  album: Album;
}

export interface AlbumList {
  id: number;
  name: string;
  description: string;
  created_at: string | null;
  items: AlbumListItem[];
}

export interface AlbumListSummary {
  id: number;
  name: string;
  description: string;
  created_at: string | null;
  album_count: number;
}

export type ExportMode = "full" | "first" | "random" | "long";
export type SortMode = "manual" | "date_added" | "artist" | "title" | "year";

export interface ExportResult {
  playlist_name: string;
  tidal_url: string | null;
  albums_processed: number;
  tracks_added: number;
}
