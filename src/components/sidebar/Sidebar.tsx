import { useState, type MouseEvent } from "react";
import { Import, Plus } from "lucide-react";
import CanvasList from "./CanvasList";
import VersionHistory from "./VersionHistory";
import { useStore } from "../../store/excaliStore";
import { mod } from "../../lib/platform";

export default function Sidebar({ hidden = false }: { hidden?: boolean }) {
  const homeOpen = useStore((s) => s.homeOpen);
  const open = useStore((s) => s.sidebarOpen) && !hidden;
  const width = useStore((s) => s.sidebarWidth);
  const setWidth = useStore((s) => s.setSidebarWidth);
  const openNew = useStore((s) => s.openNewCanvasDialog);
  const importFiles = useStore((s) => s.importFiles);
  const [dragging, setDragging] = useState(false);

  // Drag the right edge to resize. The width transition is suppressed mid-drag
  // so resizing stays instant (the animation is only for open/close).
  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev: globalThis.MouseEvent) =>
      setWidth(startWidth + (ev.clientX - startX));
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
  };

  return (
    <aside
      className="sidebar relative shrink-0 overflow-hidden"
      style={{
        width: open ? width : 0,
        transition: dragging ? "none" : "width 300ms var(--ease-out)",
      }}
      aria-hidden={!open}
    >
      {/* Inner pane keeps the full width so content slides/clips instead of squishing. */}
      <div
        className="sidebar-pane"
        style={{ width, opacity: open ? 1 : 0 }}
        {...(open ? {} : { inert: "" })}
      >
        <div className="sidebar-top">
          <button className="sb-new press no-drag" onClick={openNew}>
            <Plus size={15} strokeWidth={2.2} />
            <span>New board</span>
            <kbd>{mod("N")}</kbd>
          </button>
          <button
            className="sb-icon press no-drag"
            aria-label="Import an Excalidraw file"
            title={`Import an Excalidraw file (${mod("O")})`}
            onClick={() => void importFiles()}
          >
            <Import size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CanvasList />
        </div>
        {!homeOpen && <VersionHistory />}
      </div>

      {open && (
        <div
          onMouseDown={startResize}
          onDoubleClick={() => setWidth(248)}
          className="sidebar-resizer"
          title="Drag to resize · double-click to reset"
        />
      )}
    </aside>
  );
}
