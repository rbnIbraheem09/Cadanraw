import { useEffect, useRef, useState, type FormEvent } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import TemplateIcon from "../library/TemplateIcon";
import { useStore } from "../../store/excaliStore";
import { TEMPLATES, type TemplateId } from "../../lib/templates";
import { sfx } from "../../lib/sound";

export default function NewCanvasDialog() {
  const open = useStore((s) => s.newCanvasDialogOpen);
  const close = useStore((s) => s.closeNewCanvasDialog);
  const createCanvas = useStore((s) => s.createCanvas);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<TemplateId>("blank");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setTemplate("blank");
      setBusy(false);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  const chosen = TEMPLATES.find((t) => t.id === template)!;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    await createCanvas(name.trim() || (template === "blank" ? "Untitled" : chosen.name), template);
    close();
  };

  return (
    <Modal open={open} onClose={close} width={468}>
      <form onSubmit={submit}>
        <h2 className="dialog-title">New board</h2>
        <Input
          ref={inputRef}
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          placeholder={template === "blank" ? "Name it, or leave it Untitled" : chosen.name}
          aria-label="Board name"
          spellCheck={false}
        />
        <p className="dialog-label">Start from</p>
        <div className="template-grid" role="radiogroup" aria-label="Template">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === template}
              className="template-tile press"
              onClick={() => {
                sfx.tap();
                setTemplate(t.id);
              }}
              onDoubleClick={(e) => e.currentTarget.form?.requestSubmit()}
            >
              <TemplateIcon id={t.id} size={20} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
        <p className="dialog-hint">{chosen.blurb}</p>
        <div className="dialog-actions">
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Create board
          </Button>
        </div>
      </form>
    </Modal>
  );
}
