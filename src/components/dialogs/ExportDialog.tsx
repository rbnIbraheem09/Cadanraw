import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useStore } from "../../store/excaliStore";

type Format = "png" | "svg" | "excalidraw";

const OPTIONS: { format: Format; label: string; desc: string }[] = [
  { format: "png", label: "PNG image", desc: "Raster image — best for sharing" },
  { format: "svg", label: "SVG image", desc: "Vector image — scales cleanly" },
  {
    format: "excalidraw",
    label: "Excalidraw file",
    desc: "Editable .excalidraw to re-import later",
  },
];

export default function ExportDialog() {
  const open = useStore((s) => s.exportDialogOpen);
  const close = useStore((s) => s.closeExportDialog);
  const exportCanvas = useStore((s) => s.exportActiveCanvas);

  const choose = async (format: Format) => {
    close();
    await exportCanvas(format);
  };

  return (
    <Modal open={open} onClose={close}>
      <h2 className="dialog-title">Export board</h2>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.format}
            onClick={() => choose(o.format)}
            className="choice-row press no-drag"
          >
            <strong>{o.label}</strong>
            <small>{o.desc}</small>
          </button>
        ))}
      </div>
      <div className="dialog-actions">
        <Button onClick={close}>Cancel</Button>
      </div>
    </Modal>
  );
}
