import { useEffect, useRef } from "react";
import { connectRoom } from "../../lib/collaboration";
import ExcalidrawWrapper from "./ExcalidrawWrapper";
import EmptyState from "./EmptyState";
import PreviewBanner from "./PreviewBanner";
import CanvasErrorBoundary from "./CanvasErrorBoundary";
import CanvasTools from "./CanvasTools";
import InsertMenu from "./InsertMenu";
import { useStore } from "../../store/excaliStore";
import { useUi } from "../../store/ui";

const renderTools = () => <CanvasTools />;

export default function CanvasArea() {
  const room = useUi((s) => s.room);
  const connectionStatus = useUi((s) => s.roomStatus);
  const setRoom = useUi((s) => s.setRoom);
  const api = useStore((s) => s.api);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const activeId = useStore((s) => s.activeCanvasId);
  const json = useStore((s) => s.activeCanvasJson);
  const loading = useStore((s) => s.loading);
  const sceneRevision = useStore((s) => s.sceneRevision);
  const setApi = useStore((s) => s.setApi);
  const markChanged = useStore((s) => s.markChanged);
  const previewVersionId = useStore((s) => s.previewVersionId);
  const previewJson = useStore((s) => s.previewJson);
  const libraryItems = useStore((s) => s.libraryItems);
  const handleLibraryChange = useStore((s) => s.handleLibraryChange);

  // A session belongs to one board; leave it (and close its popover) on switching.
  useEffect(
    () => () => {
      useUi.setState({ room: null, roomStatus: "", shareOpen: false, insertMenu: null });
    },
    [activeId],
  );
  useEffect(() => {
    if (!room || !api || previewVersionId) return;
    return connectRoom(
      room,
      api,
      "Host",
      (roomStatus) => useUi.setState({ roomStatus }),
      pointer,
    );
  }, [room, api, previewVersionId]);

  // Read-only version preview — separate keyed instance, no save/dirty wiring.
  if (previewVersionId && previewJson !== null) {
    return (
      <div className="flex h-full flex-col">
        <PreviewBanner />
        <div className="canvas-workspace">
          <div className="min-h-0 min-w-0 flex-1">
            <CanvasErrorBoundary key={`preview-${previewVersionId}`}>
              <ExcalidrawWrapper json={previewJson} viewKey={activeId ?? undefined} viewMode />
            </CanvasErrorBoundary>
          </div>
        </div>
      </div>
    );
  }

  if (!activeId || json === null)
    return loading ? <div className="canvas-workspace dot-surface" /> : <EmptyState />;

  return (
    <div className="flex h-full flex-col">
      {room && (
        <div className="session-banner" role="status">
          <span>● {connectionStatus || "Connecting…"}</span>
          <button onClick={() => setRoom(null)}>Leave session</button>
        </div>
      )}
      <div className="canvas-workspace">
        {/* A fresh editor per board, and again when a version is restored into it. */}
        <div className="min-h-0 min-w-0 flex-1">
          <CanvasErrorBoundary key={`${activeId}:${sceneRevision}`}>
            <ExcalidrawWrapper
              json={json}
              viewKey={activeId}
              onApiReady={setApi}
              onPointerUpdate={(p) => {
                pointer.current = p;
              }}
              onSceneChange={markChanged}
              libraryItems={libraryItems}
              onLibraryChange={handleLibraryChange}
              topRight={renderTools}
            />
          </CanvasErrorBoundary>
        </div>
      </div>
      <InsertMenu />
    </div>
  );
}
