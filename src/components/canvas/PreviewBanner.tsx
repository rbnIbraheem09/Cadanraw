import Button from "../ui/Button";
import { useStore } from "../../store/excaliStore";
import { formatRelativeTime } from "../../lib/format";

export default function PreviewBanner() {
  const versionId = useStore((s) => s.previewVersionId);
  const version = useStore(
    (s) => s.versions.find((v) => v.id === s.previewVersionId) ?? null,
  );
  const exit = useStore((s) => s.exitPreview);
  const restore = useStore((s) => s.restoreVersion);

  if (!versionId) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-accent/30 bg-accent-soft px-4 py-2 text-[12.5px]">
      <span className="min-w-0 truncate text-ink">
        <span className="font-medium text-accent">Previewing</span>{" "}
        {version?.description ?? "Auto-save"}
        {version ? ` · ${formatRelativeTime(version.createdAt)}` : ""}{" "}
        <span className="text-ink-muted">— read-only</span>
      </span>
      <div className="flex shrink-0 gap-2">
        <Button onClick={exit}>Exit</Button>
        <Button variant="primary" onClick={() => restore(versionId)}>
          Restore this version
        </Button>
      </div>
    </div>
  );
}
