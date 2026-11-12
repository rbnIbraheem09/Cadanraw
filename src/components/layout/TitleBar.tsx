import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Minus,
  PanelLeft,
  Search,
  Settings,
  Square,
  X,
} from "lucide-react";
import { useStore } from "../../store/excaliStore";
import { useUi } from "../../store/ui";
import { folderTrail } from "../../lib/folders";
import { boardMenuItems, goHome } from "../../lib/board-actions";
import { isMac, mod } from "../../lib/platform";
import ContextMenu from "../ui/ContextMenu";

/**
 * Frameless custom titlebar: where you are, whether it's saved, and the way to
 * everything else (search). macOS keeps native traffic lights; Windows/Linux
 * render app-owned window controls on the right.
 */
export default function TitleBar() {
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const homeOpen = useStore((s) => s.homeOpen);
  const board = useStore((s) =>
    s.homeOpen ? null : (s.canvases.find((c) => c.id === s.activeCanvasId) ?? null),
  );
  const folders = useStore((s) => s.folders);
  const libraryScope = useStore((s) => s.libraryScope);
  const currentFolderId = useStore((s) => s.currentFolderId);
  const renameCanvas = useStore((s) => s.renameCanvas);
  const settingsOpen = useUi((s) => s.settingsOpen);
  const openPalette = useUi((s) => s.openPalette);
  const openSettings = useUi((s) => s.openSettings);
  const closeSettings = useUi((s) => s.closeSettings);

  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const nameRef = useRef<HTMLButtonElement>(null);

  const trail = board
    ? folderTrail(folders, board.folderId)
    : libraryScope === "folder"
      ? folderTrail(folders, currentFolderId)
      : [];

  const startRename = () => {
    if (!board) return;
    setDraft(board.name);
    setRenaming(true);
  };
  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (board && next && next !== board.name) void renameCanvas(board.id, next);
  };

  return (
    <header
      className={`titlebar drag-region ${isMac ? "is-mac" : ""}`}
      style={{ height: "var(--titlebar-height)" }}
    >
      <button
        onClick={toggleSidebar}
        title={`Toggle sidebar (${mod("B")})`}
        aria-label="Toggle sidebar"
        className="tb-btn press no-drag"
      >
        <PanelLeft size={15} strokeWidth={1.8} />
      </button>

      <nav className="crumbs" aria-label="Location">
        {settingsOpen ? (
          <>
            <button className="crumb no-drag" onClick={closeSettings}>
              {board ? board.name : "Home"}
            </button>
            <ChevronRight size={12} className="crumb-sep" />
            <span className="crumb is-current">Settings</span>
          </>
        ) : (
          <>
            <button
              className={`crumb no-drag ${!board && !trail.length && libraryScope !== "pinned" ? "is-current" : ""}`}
              onClick={() => void goHome()}
            >
              Home
            </button>
            {homeOpen && libraryScope === "pinned" && (
              <>
                <ChevronRight size={12} className="crumb-sep" />
                <span className="crumb is-current">Pinned</span>
              </>
            )}
            {homeOpen && libraryScope === "folder" && !trail.length && (
              <>
                <ChevronRight size={12} className="crumb-sep" />
                <span className="crumb is-current">Unfiled</span>
              </>
            )}
            {trail.map((folder, i) => (
              <span key={folder.id} className="crumb-part">
                <ChevronRight size={12} className="crumb-sep" />
                <button
                  className={`crumb no-drag ${!board && i === trail.length - 1 ? "is-current" : ""}`}
                  onClick={() => void goHome(folder.id, "folder")}
                >
                  {folder.name}
                </button>
              </span>
            ))}
            {board && (
              <>
                <ChevronRight size={12} className="crumb-sep" />
                {renaming ? (
                  <input
                    autoFocus
                    className="crumb-input no-drag"
                    aria-label="Board name"
                    value={draft}
                    maxLength={200}
                    spellCheck={false}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                  />
                ) : (
                  <button
                    ref={nameRef}
                    className="crumb is-current is-board no-drag"
                    title="Click for board actions · double-click to rename"
                    onDoubleClick={startRename}
                    onClick={() => {
                      const r = nameRef.current?.getBoundingClientRect();
                      if (r) setMenu({ x: r.left, y: r.bottom + 6 });
                    }}
                  >
                    <span>{board.name}</span>
                    <ChevronDown size={12} />
                  </button>
                )}
                <SaveState />
              </>
            )}
          </>
        )}
      </nav>

      <button
        className="tb-search press no-drag"
        onClick={() => openPalette()}
        aria-label="Search boards and commands"
      >
        <Search size={13} />
        <span>Search or jump to…</span>
        <kbd>{mod("K")}</kbd>
      </button>

      <button
        onClick={() => (settingsOpen ? closeSettings() : openSettings())}
        title={`Settings (${mod(",")})`}
        aria-label="Settings"
        aria-pressed={settingsOpen}
        className="tb-btn press no-drag"
      >
        <Settings size={15} strokeWidth={1.8} />
      </button>

      {!isMac && <WindowControls />}

      {menu && board && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={boardMenuItems(board, { onRename: startRename, includeOpen: false })}
        />
      )}
    </header>
  );
}

/** Quiet by design: a tick when everything is on disk, a dot while it isn't. */
function SaveState() {
  const isDirty = useStore((s) => s.isDirty);
  const saving = useStore((s) => s.saving);
  const state = saving ? "saving" : isDirty ? "dirty" : "saved";
  return (
    <span
      className={`save-state is-${state}`}
      role="status"
      aria-live="polite"
      title={
        state === "saved"
          ? "All changes saved on this device"
          : state === "saving"
            ? "Saving…"
            : "Saves automatically in a moment"
      }
    >
      {state === "saved" ? <Check size={12} strokeWidth={2.4} /> : <i />}
      <span>{state === "saved" ? "Saved" : state === "saving" ? "Saving" : "Edited"}</span>
    </span>
  );
}

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  useEffect(() => {
    let alive = true;
    void window.excali.window.isMaximized().then((maximized) => {
      if (alive) setIsMaximized(maximized);
    });
    const unsubscribe = window.excali.window.onMaximizedChange(setIsMaximized);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return (
    <div className="no-drag ml-1 flex h-full shrink-0 items-stretch">
      <button
        type="button"
        onClick={() => void window.excali.window.minimize()}
        title="Minimize"
        aria-label="Minimize"
        className="win-btn"
      >
        <Minus size={14} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={() => void window.excali.window.toggleMaximize().then(setIsMaximized)}
        title={isMaximized ? "Restore" : "Maximize"}
        aria-label={isMaximized ? "Restore" : "Maximize"}
        className="win-btn"
      >
        {isMaximized ? <Copy size={13} strokeWidth={1.8} /> : <Square size={13} strokeWidth={1.8} />}
      </button>
      <button
        type="button"
        onClick={() => void window.excali.window.close()}
        title="Close"
        aria-label="Close"
        className="win-btn is-close"
      >
        <X size={15} strokeWidth={1.9} />
      </button>
    </div>
  );
}
