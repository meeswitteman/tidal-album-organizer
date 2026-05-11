import { useRef, useState, useEffect } from "react";

interface Props {
  title: string;
  className?: string;
}

export function TruncatedTitle({ title, className = "" }: Props) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    const el = spanRef.current;
    if (el && el.scrollWidth > el.clientWidth) {
      timerRef.current = setTimeout(() => setShowTooltip(true), 1000);
    }
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTooltip(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <span className="relative block min-w-0" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <span ref={spanRef} className={`block truncate ${className}`}>
        {title}
      </span>
      {showTooltip && (
        <span className="absolute left-0 bottom-full mb-1.5 z-50 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs whitespace-nowrap shadow-xl pointer-events-none">
          {title}
        </span>
      )}
    </span>
  );
}
