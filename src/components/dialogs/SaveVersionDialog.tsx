import { useEffect, useRef, useState, type FormEvent } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useStore } from "../../store/excaliStore";

export default function SaveVersionDialog() {
  const open = useStore((s) => s.saveVersionDialogOpen);
  const close = useStore((s) => s.closeSaveVersionDialog);
  const saveVersion = useStore((s) => s.saveVersion);
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDescription("");
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await saveVersion(description);
    close();
  };

  return (
    <Modal open={open} onClose={close}>
      <form onSubmit={submit}>
        <h2 className="dialog-title">Save a version</h2>
        <p className="dialog-text">
          A snapshot you can return to anytime. Labelled versions are kept
          permanently; leave it blank for a quick checkpoint.
        </p>
        <Input
          ref={inputRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Label (optional)"
          spellCheck={false}
        />
        <div className="dialog-actions">
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save version
          </Button>
        </div>
      </form>
    </Modal>
  );
}
