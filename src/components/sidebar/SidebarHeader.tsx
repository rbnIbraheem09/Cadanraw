import { useStore } from "../../store/excaliStore";

export default function SidebarHeader() {
  const openNew = useStore((s) => s.openNewCanvasDialog);
  const count = useStore((s) => s.canvases.length);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);

  return (
    <div className="flex flex-col gap-2.5 px-3 pb-2.5 pt-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-muted">
            Canvases
          </span>
          {count > 0 && (
            <span className="font-mono text-[10.5px] text-ink-muted/70">{count}</span>
          )}
        </div>
        <button
          onClick={openNew}
          title="New canvas (⌘N)"
          aria-label="New canvas"
          className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-overlay hover:text-accent active:scale-95"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search"
          spellCheck={false}
          className="no-drag w-full rounded-lg border border-edge-dim bg-raised py-1.5 pl-8 pr-2.5 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent/50 focus:bg-overlay"
        />
      </div>
    </div>
  );
}
