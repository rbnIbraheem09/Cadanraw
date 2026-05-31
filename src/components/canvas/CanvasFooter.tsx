import { useEffect, useState } from "react";
import { useStore } from "../../store/excaliStore";
import { formatRelativeTime, pluralize } from "../../lib/format";

export default function CanvasFooter() {
  const canvas = useStore(
    (s) => s.canvases.find((c) => c.id === s.activeCanvasId) ?? null,
  );
  const isDirty = useStore((s) => s.isDirty);
  const saving = useStore((s) => s.saving);
  const lastSavedAt = useStore((s) => s.lastSavedAt);

  // Re-render every 30s so "Saved 2m ago" stays current.
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  if (!canvas) return null;

  let status = "";
  if (saving) status = "Saving…";
  else if (isDirty) status = "Unsaved changes";
  else if (lastSavedAt) status = `Saved ${formatRelativeTime(lastSavedAt)}`;

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-edge-dim bg-base px-3 font-mono text-[11px] text-ink-muted">
      <span className="truncate">
        {canvas.name} · {pluralize(canvas.elementCount, "element")}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {isDirty && !saving && (
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        )}
        {status}
      </span>
    </footer>
  );
}
