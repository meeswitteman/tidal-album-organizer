import { Library, ListMusic, Tag, ListOrdered, Music2 } from "lucide-react";
import { clsx } from "clsx";

export type Page = "library" | "playlists" | "albumlists" | "tidalplaylists" | "tags";

interface Props {
  current: Page;
  onNavigate: (page: Page) => void;
  username?: string | null;
}

const nav: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "library", label: "Bibliotheek", icon: <Library className="w-4 h-4" /> },
  { id: "albumlists", label: "Albumlijsten", icon: <ListOrdered className="w-4 h-4" /> },
  { id: "tidalplaylists", label: "Tidal Playlists", icon: <Music2 className="w-4 h-4" /> },
  { id: "playlists", label: "Exports", icon: <ListMusic className="w-4 h-4" /> },
  { id: "tags", label: "Tags", icon: <Tag className="w-4 h-4" /> },
];

export function Sidebar({ current, onNavigate, username }: Props) {
  return (
    <aside className="w-56 shrink-0 bg-surface border-r border-border flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <h1 className="text-base font-bold tracking-tight text-white leading-tight">
          Tidal Album<br /><span className="text-accent">Organizer</span>
        </h1>
        {username && <p className="text-xs text-muted mt-0.5">{username}</p>}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {nav.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={clsx(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
              current === item.id
                ? "bg-accent/10 text-accent"
                : "text-muted hover:text-white hover:bg-card"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <div className="px-3 py-2 text-xs text-border">v0.1.0</div>
      </div>
    </aside>
  );
}
