import { useEffect, useRef, useState } from "react";
import WorkspacePanel from "./WorkspacePanel";
import { connectRoom, type RoomConnection } from "../../lib/collaboration";
import ExcalidrawWrapper from "./ExcalidrawWrapper";
import EmptyState from "./EmptyState";
import CanvasFooter from "./CanvasFooter";
import PreviewBanner from "./PreviewBanner";
import CanvasErrorBoundary from "./CanvasErrorBoundary";
import { useStore } from "../../store/excaliStore";

export default function CanvasArea() {
  const [room, setRoom] = useState<RoomConnection | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("");
  const api = useStore((s) => s.api);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const activeId = useStore((s) => s.activeCanvasId);
  const json = useStore((s) => s.activeCanvasJson);
  const setApi = useStore((s) => s.setApi);
  const markChanged = useStore((s) => s.markChanged);
  const previewVersionId = useStore((s) => s.previewVersionId);
  const previewJson = useStore((s) => s.previewJson);
  const libraryItems = useStore((s) => s.libraryItems);
  const handleLibraryChange = useStore((s) => s.handleLibraryChange);

  useEffect(() => {
    setRoom(null);
    setConnectionStatus("");
  }, [activeId]);
  useEffect(() => {
    if (!room || !api || previewVersionId) return;
    return connectRoom(room, api, "Host", setConnectionStatus, pointer);
  }, [room, api, previewVersionId]);

  // Read-only version preview — separate keyed instance, no save/dirty wiring.
  if (previewVersionId && previewJson !== null) {
    return (
      <div className="flex h-full flex-col">
        <PreviewBanner />
        <div className="min-h-0 flex-1">
          <CanvasErrorBoundary key={`preview-${previewVersionId}`}>
            <ExcalidrawWrapper json={previewJson} viewMode />
          </CanvasErrorBoundary>
        </div>
      </div>
    );
  }

  if (!activeId || json === null) return <EmptyState />;

  return (
    <div className="flex h-full flex-col">
      {room && (
        <div className="session-banner" role="status">
          <span>● {connectionStatus || "Connecting…"}</span>
          <button onClick={() => setRoom(null)}>Leave session</button>
        </div>
      )}
      <div className="canvas-workspace">
        {/* key={activeId} → a fresh editor instance per canvas (clean isolation). */}
        <div className="min-h-0 min-w-0 flex-1">
          <CanvasErrorBoundary key={activeId}>
            <ExcalidrawWrapper
              json={json}
              onApiReady={setApi}
              onPointerUpdate={(p) => {
                pointer.current = p;
              }}
              onSceneChange={markChanged}
              libraryItems={libraryItems}
              onLibraryChange={handleLibraryChange}
            />
          </CanvasErrorBoundary>
        </div>
        <WorkspacePanel room={room} onRoom={setRoom} />
      </div>
      <CanvasFooter />
    </div>
  );
}
