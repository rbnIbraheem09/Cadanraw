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
      <h2 className="mb-2 text-[15px] font-semibold text-ink">Delete canvas</h2>
      <p className="text-[13px] leading-relaxed text-ink-dim">
        <span className="text-ink">“{canvas?.name}”</span> will be moved to the
        Trash
        {canvas && canvas.elementCount > 0
          ? ` — it has ${pluralize(canvas.elementCount, "element")}.`
          : "."}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" onClick={cancel}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => pendingId && deleteCanvas(pendingId)}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}
