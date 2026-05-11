import type { Tag } from "../types";

interface Props {
  tag: Tag;
  onRemove?: () => void;
}

export function TagBadge({ tag, onRemove }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: tag.color + "33", color: tag.color, border: `1px solid ${tag.color}55` }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-60 hover:opacity-100 leading-none"
        >
          ×
        </button>
      )}
    </span>
  );
}
