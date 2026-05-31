import { useEffect, useState } from "react";
import { Copy, Minus, PanelLeft, Square, X } from "lucide-react";
import { useStore } from "../../store/excaliStore";

/**
 * Frameless custom titlebar. macOS keeps native traffic lights; Windows/Linux
 * render app-owned window controls on the right.
 */
export default function TitleBar() {
  const platform = window.excali.platform;
  const isMac = platform === "darwin";
  const showWindowControls = !isMac;
  const [isMaximized, setIsMaximized] = useState(false);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const activeName = useStore((s) => {
    const c = s.canvases.find((x) => x.id === s.activeCanvasId);
    return c?.name ?? null;
  });

  useEffect(() => {
    if (!showWindowControls) return;

    let alive = true;
    void window.excali.window.isMaximized().then((maximized) => {
      if (alive) setIsMaximized(maximized);
    });

    const unsubscribe = window.excali.window.onMaximizedChange(setIsMaximized);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [showWindowControls]);

  const shortcut = platform === "darwin" ? "⌘B" : "Ctrl+B";

  return (
    <header
      className={`drag-region flex shrink-0 items-center gap-2 border-b border-edge-dim bg-deep/80 backdrop-blur ${
        isMac ? "pl-[78px] pr-3" : "pl-3 pr-0"
      }`}
      style={{ height: "var(--titlebar-height)" }}
    >
      <button
        onClick={toggleSidebar}
        title={`Toggle sidebar (${shortcut})`}
        aria-label="Toggle sidebar"
        className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <PanelLeft size={15} strokeWidth={1.8} />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
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

      {showWindowControls && (
        <div className="no-drag ml-auto flex h-full shrink-0 items-stretch">
          <button
            type="button"
            onClick={() => void window.excali.window.minimize()}
            title="Minimize"
            aria-label="Minimize"
            className="flex h-full w-11 items-center justify-center text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <Minus size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() =>
              void window.excali.window.toggleMaximize().then(setIsMaximized)
            }
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={isMaximized ? "Restore" : "Maximize"}
            className="flex h-full w-11 items-center justify-center text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            {isMaximized ? (
              <Copy size={13} strokeWidth={1.8} />
            ) : (
              <Square size={13} strokeWidth={1.8} />
            )}
          </button>
          <button
            type="button"
            onClick={() => void window.excali.window.close()}
            title="Close"
            aria-label="Close"
            className="flex h-full w-11 items-center justify-center text-ink-muted transition-colors hover:bg-red-500 hover:text-white"
          >
            <X size={15} strokeWidth={1.9} />
          </button>
        </div>
      )}
    </header>
  );
}
