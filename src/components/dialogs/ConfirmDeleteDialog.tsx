import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useStore } from "../../store/excaliStore";
import { pluralize } from "../../lib/format";

export default function ConfirmDeleteDialog() {
  const pendingId = useStore((s) => s.pendingDeleteId);
  const canvas = useStore(
    (s) => s.canvases.find((c) => c.id === s.pendingDeleteId) ?? null,
  );
  const cancel = useStore((s) => s.cancelDelete);
  const deleteCanvas = useStore((s) => s.deleteCanvas);

  return (
    <Modal open={!!pendingId} onClose={cancel}>
      <h2 className="dialog-title">Delete this board?</h2>
      <p className="dialog-text">
        <strong>“{canvas?.name}”</strong> will be moved to the Trash, where you
        can still get it back
        {canvas && canvas.elementCount > 0
          ? ` — it has ${pluralize(canvas.elementCount, "element")}.`
          : "."}
      </p>
      <div className="dialog-actions">
        <Button type="button" onClick={cancel}>
          Cancel
        </Button>
        <Button
          variant="danger"
          autoFocus
          onClick={() => pendingId && deleteCanvas(pendingId)}
        >
          Move to Trash
        </Button>
      </div>
    </Modal>
  );
}
