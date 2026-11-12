import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useStore } from "../../store/excaliStore";
import { folderPath } from "../../lib/folders";
export default function MoveCanvasDialog() {
  const id = useStore((s) => s.movingCanvasId);
  const folders = useStore((s) => s.folders);
  const boards = useStore((s) => s.canvases);
  const move = useStore((s) => s.moveCanvas);
  const close = useStore((s) => s.setMovingCanvas);
  const [target, setTarget] = useState("");
  useEffect(() => {
    setTarget(boards.find((b) => b.id === id)?.folderId || "");
  }, [id]);
  if (!id) return null;
  return (
    <Modal open={!!id} onClose={() => close(null)}>
      <h2 className="dialog-title">Move board</h2>
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          void move(id, target || null);
        }}
      >
        <p className="dialog-text">
          Choose a folder for “{boards.find((b) => b.id === id)?.name}”.
        </p>
        <select
          id="move-folder"
          className="field"
          aria-label="Destination folder"
          autoFocus
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">Unfiled</option>
          {[...folders]
            .sort((a, b) =>
              folderPath(folders, a.id).localeCompare(
                folderPath(folders, b.id),
              ),
            )
            .map((f) => (
              <option key={f.id} value={f.id}>
                {folderPath(folders, f.id)}
              </option>
            ))}
        </select>
        <div className="dialog-actions">
          <Button type="button" onClick={() => close(null)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Move board
          </Button>
        </div>
      </form>
    </Modal>
  );
}
