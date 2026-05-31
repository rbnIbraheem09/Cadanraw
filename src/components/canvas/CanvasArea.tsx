import ExcalidrawWrapper from "./ExcalidrawWrapper";
import EmptyState from "./EmptyState";
import CanvasFooter from "./CanvasFooter";
import PreviewBanner from "./PreviewBanner";
import CanvasErrorBoundary from "./CanvasErrorBoundary";
import { useStore } from "../../store/excaliStore";

export default function CanvasArea() {
  const activeId = useStore((s) => s.activeCanvasId);
  const json = useStore((s) => s.activeCanvasJson);
  const setApi = useStore((s) => s.setApi);
  const markChanged = useStore((s) => s.markChanged);
  const previewVersionId = useStore((s) => s.previewVersionId);
  const previewJson = useStore((s) => s.previewJson);
  const libraryItems = useStore((s) => s.libraryItems);
  const handleLibraryChange = useStore((s) => s.handleLibraryChange);

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
      {/* key={activeId} → a fresh editor instance per canvas (clean isolation). */}
      <div className="min-h-0 flex-1">
        <CanvasErrorBoundary key={activeId}>
          <ExcalidrawWrapper
            json={json}
            onApiReady={setApi}
            onSceneChange={markChanged}
            libraryItems={libraryItems}
            onLibraryChange={handleLibraryChange}
          />
        </CanvasErrorBoundary>
      </div>
      <CanvasFooter />
    </div>
  );
}
