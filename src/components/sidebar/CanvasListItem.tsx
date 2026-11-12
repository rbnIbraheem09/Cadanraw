import { memo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Pin } from "lucide-react";
import ContextMenu from "../ui/ContextMenu";
import { useStore } from "../../store/excaliStore";
import { formatRelativeTime } from "../../lib/format";
import { boardMenuItems, openBoard } from "../../lib/board-actions";
import type { CanvasMeta } from "../../types/canvas";

function CanvasListItem({ canvas }: { canvas: CanvasMeta }) {
  const isActive = useStore((s) => !s.homeOpen && s.activeCanvasId === canvas.id);
  const renameCanvas = useStore((s) => s.renameCanvas);

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
    if (next && next !== canvas.name) void renameCanvas(canvas.id, next);
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
        role="button"
        tabIndex={0}
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-cadanraw-board", canvas.id);
          e.dataTransfer.setData("text/plain", canvas.name);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDoubleClick={startRename}
        onClick={() => !editing && void openBoard(canvas.id)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter") void openBoard(canvas.id);
          if (e.key === "F2") startRename();
        }}
        onContextMenu={onContextMenu}
        className={`sb-board ${isActive ? "is-active" : ""}`}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={200}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={onEditKey}
            onClick={(e) => e.stopPropagation()}
            spellCheck={false}
            aria-label="Board name"
          />
        ) : (
          <span className="sb-board-name">
            <span>{canvas.name}</span>
            {canvas.isPinned && <Pin size={11} aria-label="Pinned" />}
          </span>
        )}
        <span className="sb-board-meta">{formatRelativeTime(canvas.updatedAt)}</span>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={boardMenuItems(canvas, { onRename: startRename })}
        />
      )}
    </>
  );
}

export default memo(CanvasListItem);
