import { PenTool } from "lucide-react";
import Button from "../ui/Button";
import { useStore } from "../../store/excaliStore";
import { goHome } from "../../lib/board-actions";
import { mod } from "../../lib/platform";

/** Shown in the canvas area when no board is open. */
export default function EmptyState() {
  const openNew = useStore((s) => s.openNewCanvasDialog);

  return (
    <div className="empty-state view-enter">
      <div className="empty-mark">
        <PenTool size={24} strokeWidth={1.6} />
      </div>
      <h1>Nothing open</h1>
      <p>Start a board, or pick up one you were working on.</p>
      <div className="empty-actions">
        <Button variant="primary" onClick={openNew}>
          New board <kbd>{mod("N")}</kbd>
        </Button>
        <Button variant="soft" onClick={() => void goHome()}>
          Browse boards
        </Button>
      </div>
    </div>
  );
}
