import { useStore } from "../../store/excaliStore";

/**
 * Frameless custom titlebar. The whole bar is a drag region; the left inset
 * leaves room for the native macOS traffic lights (positioned in main.ts).
 * Interactive controls carry the `no-drag` class.
 */
export default function TitleBar() {
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const activeName = useStore((s) => {
    const c = s.canvases.find((x) => x.id === s.activeCanvasId);
    return c?.name ?? null;
  });

  return (
    <header
      className="drag-region flex shrink-0 items-center gap-2 border-b border-edge-dim bg-deep/80 pl-[78px] pr-3 backdrop-blur"
      style={{ height: "var(--titlebar-height)" }}
    >
      <button
        onClick={toggleSidebar}
        title="Toggle sidebar (⌘B)"
        aria-label="Toggle sidebar"
        className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      </button>

      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
          style={{ boxShadow: "0 0 8px var(--accent-glow)" }}
        />
        <span className="shrink-0 text-[13px] font-semibold tracking-tight text-ink">
          Cadanraw
        </span>
        {activeName && (
          <>
            <span className="shrink-0 text-ink-muted">/</span>
            <span className="truncate text-[13px] text-ink-dim">{activeName}</span>
          </>
        )}
      </div>
    </header>
  );
}
