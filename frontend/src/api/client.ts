import axios from "axios";
import type { Album, AlbumDetail, Tag, Playlist, AuthStatus, SyncResult } from "../types";

const api = axios.create({
  baseURL: "/api",
  paramsSerializer: {
    serialize: (params) => {
      const parts: string[] = [];
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
        } else {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`);
        }
      }
      return parts.join("&");
    },
  },
});

// Auth
export const getAuthStatus = () => api.get<AuthStatus>("/auth/status").then((r) => r.data);
export const startLogin = () => api.post<{ verification_url: string; user_code: string }>("/auth/login/start").then((r) => r.data);
export const pollLogin = () => api.get<{ success: boolean }>("/auth/login/poll").then((r) => r.data);

// Albums
export const syncAlbums = () => api.post<SyncResult>("/albums/sync").then((r) => r.data);
export const reimportAlbums = () => api.post<{ added: number; updated: number; total: number; sources: Record<string, { added: number; updated: number; total: number }> }>("/albums/reimport").then((r) => r.data);
export const getAlbums = (params?: {
  tag?: number[];
  year_from?: number;
  year_to?: number;
  artist?: string;
  title?: string;
  genre?: string[];
  dolby_atmos?: boolean;
  sort_by?: string;
  sort_dir?: string;
}) => api.get<Album[]>("/albums", { params }).then((r) => r.data);
export const getGenres = () => api.get<string[]>("/albums/genres").then((r) => r.data);
export const startEnrichGenres = () =>
  api.post<{ status: string; total: number; done?: number }>("/albums/enrich-genres").then((r) => r.data);
export const cancelEnrichGenres = () =>
  api.post("/albums/enrich-genres/cancel").then((r) => r.data);
export const getEnrichStatus = () =>
  api.get<{ running: boolean; done: number; total: number }>("/albums/enrich-genres/status").then((r) => r.data);
export const getAlbumDetail = (id: string) => api.get<AlbumDetail>(`/albums/${id}`).then((r) => r.data);
export const getTrackStreamUrl = (trackId: string) =>
  api.get<{ url: string }>(`/albums/tracks/${trackId}/url`).then((r) => r.data);
export const updateNotes = (id: string, notes: string) =>
  api.patch<Album>(`/albums/${id}/notes`, { notes }).then((r) => r.data);
export const addTagToAlbum = (albumId: string, tagId: number) =>
  api.post<Album>(`/albums/${albumId}/tags/${tagId}`).then((r) => r.data);
export const removeTagFromAlbum = (albumId: string, tagId: number) =>
  api.delete<Album>(`/albums/${albumId}/tags/${tagId}`).then((r) => r.data);

// Tags
export const getTags = () => api.get<Tag[]>("/tags").then((r) => r.data);
export const createTag = (name: string, color: string) =>
  api.post<Tag>("/tags", { name, color }).then((r) => r.data);
export const updateTag = (id: number, name: string, color: string) =>
  api.patch<Tag>(`/tags/${id}`, { name, color }).then((r) => r.data);
export const deleteTag = (id: number) => api.delete(`/tags/${id}`);

// Tidal
export const getTidalPlaylists = (search?: string) =>
  api.get<{ id: string; name: string; description: string; num_tracks: number }[]>(
    "/tidal/playlists", { params: search ? { search } : undefined }
  ).then((r) => r.data);

// AlbumLists
export const getAlbumLists = () => api.get<import("../types").AlbumListSummary[]>("/albumlists").then((r) => r.data);
export const createAlbumList = (name: string, description: string) =>
  api.post<import("../types").AlbumList>("/albumlists", { name, description }).then((r) => r.data);
export const getAlbumList = (id: number) =>
  api.get<import("../types").AlbumList>(`/albumlists/${id}`).then((r) => r.data);
export const updateAlbumList = (id: number, name: string, description: string) =>
  api.patch<import("../types").AlbumList>(`/albumlists/${id}`, { name, description }).then((r) => r.data);
export const deleteAlbumList = (id: number) => api.delete(`/albumlists/${id}`);
export const addAlbumListItems = (id: number, album_ids: string[]) =>
  api.post<import("../types").AlbumList>(`/albumlists/${id}/items`, { album_ids }).then((r) => r.data);
export const removeAlbumListItems = (id: number, album_ids: string[]) =>
  api.delete<import("../types").AlbumList>(`/albumlists/${id}/items`, { data: { album_ids } }).then((r) => r.data);
export const reorderAlbumList = (id: number, item_ids: number[]) =>
  api.put<import("../types").AlbumList>(`/albumlists/${id}/order`, { item_ids }).then((r) => r.data);
export const sortAlbumList = (id: number, mode: import("../types").SortMode) =>
  api.post<import("../types").AlbumList>(`/albumlists/${id}/sort`, { mode }).then((r) => r.data);
export const importFromPlaylists = (
  listId: number,
  playlist_ids: string[],
) =>
  api.post<{ added: number; skipped: number; total_found: number }>(
    `/albumlists/${listId}/import-from-playlists`, { playlist_ids }
  ).then((r) => r.data);

export const exportAlbumList = (
  id: number,
  playlist_name: string,
  mode: import("../types").ExportMode,
  min_duration: number,
) =>
  api.post<import("../types").ExportResult>(`/albumlists/${id}/export`, {
    playlist_name, mode, min_duration,
  }).then((r) => r.data);

// Playlists
export const getPlaylists = () => api.get<Playlist[]>("/playlists").then((r) => r.data);
export const createPlaylist = (name: string, description: string, album_ids: string[]) =>
  api.post<Playlist>("/playlists", { name, description, album_ids }).then((r) => r.data);
export const deletePlaylist = (id: string) => api.delete(`/playlists/${id}`);
