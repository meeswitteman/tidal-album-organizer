import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Trash2, Check, X } from "lucide-react";
import { getTags, createTag, updateTag, deleteTag } from "../api/client";

const PRESET_COLORS = [
  "#6ee7b7", "#60a5fa", "#f472b6", "#fb923c",
  "#a78bfa", "#facc15", "#34d399", "#f87171",
];

export function Tags() {
  const qc = useQueryClient();
  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: getTags });
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const create = useMutation({
    mutationFn: () => createTag(newName, newColor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tags"] }); setNewName(""); },
  });

  const update = useMutation({
    mutationFn: (id: number) => updateTag(id, editName, editColor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tags"] }); setEditId(null); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });

  const startEdit = (tag: { id: number; name: string; color: string }) => {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-lg space-y-6">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-bold">Tags beheren</h2>
        </div>

        {/* Create */}
        <div className="p-4 bg-card border border-border rounded-xl space-y-3">
          <p className="text-sm font-medium">Nieuwe tag</p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Tag naam..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newName.trim() && create.mutate()}
            />
            <button
              onClick={() => create.mutate()}
              disabled={!newName.trim()}
              className="btn-primary disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: newColor === c ? "white" : "transparent" }}
              />
            ))}
          </div>
          {newName && (
            <div>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: newColor + "33", color: newColor, border: `1px solid ${newColor}55` }}
              >
                {newName}
              </span>
            </div>
          )}
        </div>

        {/* List */}
        <div className="space-y-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
              {editId === tag.id ? (
                <>
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ backgroundColor: c, borderColor: editColor === c ? "white" : "transparent" }}
                      />
                    ))}
                  </div>
                  <input
                    className="input flex-1 py-1 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <button onClick={() => update.mutate(tag.id)} className="btn-ghost p-1.5 text-accent">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditId(null)} className="btn-ghost p-1.5">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span
                    className="flex-1 text-sm font-medium cursor-pointer hover:text-accent"
                    onClick={() => startEdit(tag)}
                  >
                    {tag.name}
                  </span>
                  <button
                    onClick={() => remove.mutate(tag.id)}
                    className="btn-danger p-1.5 rounded-lg opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}

          {tags.length === 0 && (
            <p className="text-center text-muted py-8 text-sm">Nog geen tags. Maak er hierboven een aan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
