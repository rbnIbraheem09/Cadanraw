import { useState, type MouseEvent } from "react";
import SidebarHeader from "./SidebarHeader";
import CanvasList from "./CanvasList";
import VersionHistory from "./VersionHistory";
import { useStore } from "../../store/excaliStore";

export default function Sidebar() {
  const open = useStore((s) => s.sidebarOpen);
  const width = useStore((s) => s.sidebarWidth);
  const setWidth = useStore((s) => s.setSidebarWidth);
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
      className="relative shrink-0 overflow-hidden"
      style={{
        width: open ? width : 0,
        transition: dragging
          ? "none"
          : "width 240ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Inner pane keeps the full width so content slides/clips instead of squishing. */}
      <div
        className="flex h-full flex-col border-r border-edge bg-base transition-opacity duration-200"
        style={{ width, opacity: open ? 1 : 0 }}
      >
        <SidebarHeader />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CanvasList />
        </div>
        <VersionHistory />
      </div>

      {open && (
        <div
          onMouseDown={startResize}
          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-accent/25"
          title="Drag to resize"
        />
      )}
    </aside>
  );
}
