import { useRef, useState } from "react";
import { Download, Paperclip } from "lucide-react";
import { MAX_ATTACHMENT_BYTES, type BlockData } from "../../lib/block-data";
import BlockField from "./BlockField";

export default function FileBlock({
  data,
  edit,
  readOnly,
}: {
  data: BlockData;
  edit: (patch: Partial<BlockData>) => void;
  readOnly: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attachment = data.attachment;
  const pick = async (file: File) => {
    setError("");
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("Choose a file up to 4 MB.");
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 32768)
        binary += String.fromCharCode(
          ...bytes.subarray(offset, offset + 32768),
        );
      edit({
        attachment: {
          name: file.name,
          size: file.size,
          dataURL: `data:application/octet-stream;base64,${btoa(binary)}`,
        },
        ...(!attachment && data.title === "Attachment"
          ? { title: file.name }
          : {}),
      });
    } catch {
      setError("Could not attach this file. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    if (!attachment) return;
    const binary = atob(
      attachment.dataURL.slice(attachment.dataURL.indexOf(",") + 1),
    );
    const url = URL.createObjectURL(
      new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], {
        type: "application/octet-stream",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  return (
    <>
      <div className="attachment-summary">
        <Paperclip size={29} strokeWidth={1.3} />
        <div>
          <strong>{attachment?.name || "Keep a reference close"}</strong>
          <small>
            {attachment
              ? `${attachment.size < 1024 ? `${attachment.size} B` : `${(attachment.size / 1024).toFixed(0)} KB`} · Stored in this board`
              : "PDFs, documents, images · up to 4 MB"}
          </small>
        </div>
      </div>
      <div className="attachment-caption">
        <BlockField
          multiline
          label="Attachment note"
          placeholder="Add a note…"
          value={data.text}
          readOnly={readOnly}
          onChange={(text) => edit({ text })}
        />
      </div>
      <div className="block-resource-actions">
        {attachment && (
          <button onClick={download}>
            <Download size={14} /> Download
          </button>
        )}
        {!readOnly && (
          <button disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Attaching…" : attachment ? "Replace file" : "Choose file"}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        className="block-file-input"
        aria-label="Choose attachment"
        disabled={readOnly || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pick(file);
          e.target.value = "";
        }}
      />
      {error && (
        <small role="alert" className="block-inline-error">
          {error}
        </small>
      )}
    </>
  );
}
