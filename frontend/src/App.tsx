import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Sidebar, type Page } from "./components/Sidebar";
import { Library } from "./pages/Library";
import { Playlists } from "./pages/Playlists";
import { Tags } from "./pages/Tags";
import { AlbumLists } from "./pages/AlbumLists";
import { TidalPlaylists } from "./pages/TidalPlaylists";
import { getAuthStatus, startLogin, pollLogin } from "./api/client";
import { PlayerProvider } from "./context/PlayerContext";
import { MiniPlayer } from "./components/MiniPlayer";
import { ResizableDivider } from "./components/ResizableDivider";

function LoginScreen() {
  const [loginData, setLoginData] = useState<{ verification_url: string; user_code: string } | null>(null);
  const [polling, setPolling] = useState(false);

  const handleLogin = async () => {
    const data = await startLogin();
    setLoginData(data);
    setPolling(true);
  };

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const result = await pollLogin();
      if (result.success) {
        setPolling(false);
        window.location.reload();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-sm">
        <div>
          <h1 className="text-3xl font-bold">Tidal Album<span className="text-accent"> Organizer</span></h1>
          <p className="text-muted mt-2 text-sm">Organiseer je Tidal albums en playlists</p>
        </div>

        {!loginData ? (
          <button onClick={handleLogin} className="btn-primary px-8 py-3 text-base">
            Inloggen met Tidal
          </button>
        ) : (
          <div className="space-y-4 p-5 bg-card border border-border rounded-xl">
            <p className="text-sm text-muted">Open de link hieronder en voer de code in:</p>
            <div className="px-3 py-2 bg-surface rounded-lg font-mono text-2xl tracking-widest text-accent text-center">
              {loginData.user_code}
            </div>
            <a
              href={loginData.verification_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full justify-center"
            >
              <ExternalLink className="w-4 h-4" />
              Open Tidal login
            </a>
            <p className="text-xs text-muted animate-pulse">Wachten op bevestiging...</p>
          </div>
        )}
      </div>
    </div>
  );
}

const PAGE_TITLES: Record<Page, string> = {
  library: "Bibliotheek",
  albumlists: "Albumlijsten",
  tidalplaylists: "Tidal Playlists",
  playlists: "Exports",
  tags: "Tags",
};

export default function App() {
  const [page, setPage] = useState<Page>("library");
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("tao_sidebar_width");
    return saved ? parseInt(saved) : 224;
  });

  const resizeSidebar = useCallback((delta: number) => {
    setSidebarWidth((w) => {
      const next = Math.max(160, Math.min(380, w + delta));
      localStorage.setItem("tao_sidebar_width", String(next));
      return next;
    });
  }, []);

  const { data: auth, isLoading } = useQuery({
    queryKey: ["auth"],
    queryFn: getAuthStatus,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    document.title = `TAO - Tidal Album Organizer - ${PAGE_TITLES[page]}`;
  }, [page]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PlayerProvider>
      <div className="flex h-screen overflow-hidden bg-black text-white">
        <div style={{ width: sidebarWidth }} className="shrink-0">
          <Sidebar current={page} onNavigate={(p) => { setPage(p); if (p !== "library") setActiveAlbumId(null); }} username={auth?.username} />
        </div>
        <ResizableDivider onDelta={resizeSidebar} />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {!auth?.logged_in ? (
              <LoginScreen />
            ) : page === "library" ? (
              <Library activeAlbumId={activeAlbumId} onSetActiveAlbum={setActiveAlbumId} />
            ) : page === "albumlists" ? (
              <AlbumLists />
            ) : page === "tidalplaylists" ? (
              <TidalPlaylists />
            ) : page === "playlists" ? (
              <Playlists />
            ) : (
              <Tags />
            )}
          </div>
          <MiniPlayer onShowAlbum={(albumId) => { setPage("library"); setActiveAlbumId(albumId); }} />
        </main>
      </div>
    </PlayerProvider>
  );
}
