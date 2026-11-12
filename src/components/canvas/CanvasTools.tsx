import { useRef } from "react";
import { Plus, Users } from "lucide-react";
import { useUi } from "../../store/ui";
import { sfx } from "../../lib/sound";
import SharePopover from "./SharePopover";

/** Insert and Share, in Excalidraw's own top-right slot beside its library button. */
export default function CanvasTools() {
  const insertOpen = useUi((s) => !!s.insertMenu && !s.insertMenu.at);
  const shareOpen = useUi((s) => s.shareOpen);
  const live = useUi((s) => !!s.room);
  const insertRef = useRef<HTMLButtonElement>(null);
  const shareRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="canvas-tools">
      <button
        ref={insertRef}
        className="canvas-tool press"
        aria-haspopup="dialog"
        aria-expanded={insertOpen}
        title="Insert a block — or press / anywhere on the board"
        onClick={() => {
          const r = insertRef.current!.getBoundingClientRect();
          sfx.open();
          useUi.getState().setInsertMenu(
            insertOpen ? null : { x: r.right, y: r.bottom + 8, align: "right" },
          );
        }}
      >
        <Plus size={15} strokeWidth={2.2} />
        Insert
        <kbd>/</kbd>
      </button>
      <button
        ref={shareRef}
        className={`canvas-tool press ${live ? "is-live" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={shareOpen}
        title="Work on this board together"
        onClick={() => {
          sfx.open();
          useUi.getState().setShareOpen(!shareOpen);
        }}
      >
        <Users size={15} />
        {live ? "Live" : "Share"}
      </button>
      {shareOpen && <SharePopover anchor={shareRef} />}
    </div>
  );
}
