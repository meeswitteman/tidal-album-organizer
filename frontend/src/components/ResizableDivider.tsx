import { useCallback, useEffect, useRef } from "react";

interface Props {
  onDelta: (delta: number) => void;
}

export function ResizableDivider({ onDelta }: Props) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  const onDeltaRef = useRef(onDelta);
  onDeltaRef.current = onDelta;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onDeltaRef.current(e.clientX - lastX.current);
      lastX.current = e.clientX;
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div
      onMouseDown={onMouseDown}
      className="group w-2 shrink-0 cursor-col-resize flex items-stretch"
    >
      <div className="w-px mx-auto bg-border group-hover:bg-accent/70 group-active:bg-accent transition-colors" />
    </div>
  );
}
