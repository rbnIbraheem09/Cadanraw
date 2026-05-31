import CanvasListItem from "./CanvasListItem";
import { useStore } from "../../store/excaliStore";

export default function CanvasList() {
  const canvases = useStore((s) => s.canvases);
  const query = useStore((s) => s.searchQuery).trim().toLowerCase();

  const visible = query
    ? canvases.filter((c) => c.name.toLowerCase().includes(query))
    : canvases;

  if (canvases.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-[12px] leading-relaxed text-ink-muted">
        No canvases yet.
        <br />
        Create one to get started.
      </p>
    );
  }

  if (visible.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[12px] text-ink-muted">
        No canvases match “{query}”.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-1.5 pb-2">
      {visible.map((canvas) => (
        <CanvasListItem key={canvas.id} canvas={canvas} />
      ))}
    </div>
  );
}
