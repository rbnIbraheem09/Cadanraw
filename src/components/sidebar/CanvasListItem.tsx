import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { motion } from "framer-motion";
import ContextMenu from "../ui/ContextMenu";
import { useStore } from "../../store/excaliStore";
import { formatRelativeTime, pluralize } from "../../lib/format";
import type { CanvasMeta } from "../../types/canvas";

export default function CanvasListItem({ canvas }: { canvas: CanvasMeta }) {
  const isActive = useStore((s) => s.activeCanvasId === canvas.id);
  const openCanvas = useStore((s) => s.openCanvas);
  const renameCanvas = useStore((s) => s.renameCanvas);
  const requestDelete = useStore((s) => s.requestDelete);
  const duplicateCanvas = useStore((s) => s.duplicateCanvas);
  const togglePin = useStore((s) => s.togglePin);
  const requestExport = useStore((s) => s.requestExport);

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(canvas.name);

  const startRename = () => {
    setDraft(canvas.name);
    setEditing(true);
  };

  const commitRename = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== canvas.name) renameCanvas(canvas.id, next);
  };

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitRename();
    else if (e.key === "Escape") {
      setDraft(canvas.name);
      setEditing(false);
    }
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        onClick={() => !editing && openCanvas(canvas.id)}
        onContextMenu={onContextMenu}
        className={`group relative flex cursor-default flex-col gap-0.5 rounded-lg px-2.5 py-2 transition-colors ${
          isActive ? "bg-accent-soft" : "hover:bg-raised"
        }`}
      >
        {isActive && (
          <motion.span
            layoutId="active-canvas-bar"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent"
          />
        )}

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={onEditKey}
            onClick={(e) => e.stopPropagation()}
            spellCheck={false}
            className="w-full rounded border border-accent/50 bg-base px-1 py-0.5 text-[13px] text-ink outline-none"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            {canvas.isPinned && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="shrink-0 text-accent"
                aria-label="Pinned"
              >
                <path d="M16 3l5 5-3 1-3 5 1 3-3-1-4 4-1-4-4-1 4-4-1-3 5-3 1-3z" />
              </svg>
            )}
            <span
              className={`truncate text-[13px] font-medium ${
                isActive ? "text-ink" : "text-ink-dim group-hover:text-ink"
              }`}
            >
              {canvas.name}
            </span>
          </div>
        )}

        <span className="truncate font-mono text-[10.5px] text-ink-muted">
          {pluralize(canvas.elementCount, "element")} ·{" "}
          {formatRelativeTime(canvas.updatedAt)}
        </span>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: canvas.isPinned ? "Unpin" : "Pin to top",
              onClick: () => togglePin(canvas.id),
            },
            { label: "Rename", onClick: startRename },
            { label: "Duplicate", onClick: () => duplicateCanvas(canvas.id) },
            { label: "Export…", onClick: () => requestExport(canvas.id) },
            { label: "Delete", danger: true, onClick: () => requestDelete(canvas.id) },
          ]}
        />
      )}
    </>
  );
}
