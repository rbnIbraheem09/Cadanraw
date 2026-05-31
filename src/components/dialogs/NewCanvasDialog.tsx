import { useEffect, useRef, useState, type FormEvent } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useStore } from "../../store/excaliStore";

export default function NewCanvasDialog() {
  const open = useStore((s) => s.newCanvasDialogOpen);
  const close = useStore((s) => s.closeNewCanvasDialog);
  const createCanvas = useStore((s) => s.createCanvas);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await createCanvas(name.trim() || "Untitled");
    close();
  };

  return (
    <Modal open={open} onClose={close}>
      <form onSubmit={submit}>
        <h2 className="mb-3 text-[15px] font-semibold text-ink">New canvas</h2>
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Canvas name"
          spellCheck={false}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
