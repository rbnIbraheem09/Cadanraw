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
      <h2 className="mb-3 text-[15px] font-semibold text-ink">Export canvas</h2>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.format}
            onClick={() => choose(o.format)}
            className="no-drag flex flex-col items-start rounded-lg border border-edge bg-raised px-3 py-2.5 text-left transition-colors hover:border-accent/50 hover:bg-surface"
          >
            <span className="text-[13px] font-medium text-ink">{o.label}</span>
            <span className="text-[11.5px] text-ink-muted">{o.desc}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={close}>Cancel</Button>
      </div>
    </Modal>
  );
}
