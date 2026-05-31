import VersionListItem from "./VersionListItem";
import { useStore } from "../../store/excaliStore";

export default function VersionHistory() {
  const activeId = useStore((s) => s.activeCanvasId);
  const versions = useStore((s) => s.versions);
  const open = useStore((s) => s.historyOpen);
  const toggle = useStore((s) => s.toggleHistory);
  const openSaveVersion = useStore((s) => s.openSaveVersionDialog);

  if (!activeId) return null;

  return (
    <div className="shrink-0 border-t border-edge">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          onClick={toggle}
          className="no-drag flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted transition-colors hover:text-ink-dim"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
          History
          {versions.length > 0 && (
            <span className="text-ink-muted/60">{versions.length}</span>
          )}
        </button>
        <button
          onClick={openSaveVersion}
          title="Save version (⌘⇧S)"
          aria-label="Save version"
          className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-raised hover:text-accent"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            <path d="M12 7v6M9 10h6" />
          </svg>
        </button>
      </div>

      {/* grid-rows 0fr↔1fr animates height smoothly without layout thrash on the rows. */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="max-h-[38vh] overflow-y-auto px-1.5 pb-2">
            {versions.length === 0 ? (
              <p className="px-2 py-3 text-[11.5px] leading-relaxed text-ink-muted">
                No versions yet. Save a checkpoint with ⌘⇧S.
              </p>
            ) : (
              versions.map((v) => <VersionListItem key={v.id} version={v} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
