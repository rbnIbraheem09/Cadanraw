import { ArrowUpRight, LayoutTemplate } from "lucide-react";
import { useStore } from "../../store/excaliStore";
import type { BlockData } from "../../lib/block-data";
import BlockField from "./BlockField";

export default function BoardBlock({
  data,
  edit,
  readOnly,
}: {
  data: BlockData;
  edit: (patch: Partial<BlockData>) => void;
  readOnly: boolean;
}) {
  const canvases = useStore((s) => s.canvases);
  const activeId = useStore((s) => s.activeCanvasId);
  const openCanvas = useStore((s) => s.openCanvas);
  const desktop = !!window.excali;
  const board = desktop
    ? canvases.find((c) => c.id === data.boardId)
    : undefined;
  return (
    <>
      <div className="board-reference">
        <LayoutTemplate size={32} strokeWidth={1.2} />
        <div>
          <strong>
            {board?.name || (data.boardId ? data.title : "Connect your ideas")}
          </strong>
          <small>
            {!desktop
              ? "Local board · open from the desktop app"
              : board
                ? `${board.elementCount} elements · Local board`
                : data.boardId
                  ? "This board is no longer in your library"
                  : "A shortcut to another canvas in your library"}
          </small>
        </div>
      </div>
      {desktop && !readOnly && (
        <select
          aria-label="Linked board"
          className="block-board-select"
          value={board?.id || ""}
          onChange={(e) => {
            const target = canvases.find((c) => c.id === e.target.value);
            edit({
              boardId: e.target.value,
              ...(target ? { title: target.name } : {}),
            });
          }}
        >
          <option value="">Choose a board…</option>
          {canvases
            .filter((c) => c.id !== activeId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      )}
      <div className="attachment-caption">
        <BlockField
          multiline
          label="Board note"
          placeholder="Why this board matters…"
          value={data.text}
          readOnly={readOnly}
          onChange={(text) => edit({ text })}
        />
      </div>
      {board && (
        <div className="block-resource-actions">
          <button onClick={() => void openCanvas(board.id)}>
            Open board <ArrowUpRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
