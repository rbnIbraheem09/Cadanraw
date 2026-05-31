import { useMemo } from "react";
import { Excalidraw, loadFromBlob, hashElementsVersion } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  LibraryItems,
} from "@excalidraw/excalidraw/types";
// Excalidraw ships its own stylesheet — without this the editor renders unstyled.
import "@excalidraw/excalidraw/index.css";

interface ExcalidrawWrapperProps {
  /** Raw .excalidraw JSON for the canvas to display. */
  json: string;
  /** Receives the imperative API once the editor mounts (updateScene, getFiles, …). */
  onApiReady?: (api: ExcalidrawImperativeAPI) => void;
  /** Fired on real content changes with a content hash (ignores pan/zoom/select). */
  onSceneChange?: (sceneHash: number) => void;
  /** Read-only mode for version preview (no editing, no save wiring). */
  viewMode?: boolean;
  /** Shared library to seed into this editor instance on mount. */
  libraryItems?: LibraryItems;
  /** Fired when the user changes the library (add/remove items). */
  onLibraryChange?: (items: LibraryItems) => void;
}

/**
 * Thin wrapper around the official Excalidraw editor. Parent remounts this with
 * key={canvasId}, so a fresh editor is created per canvas (no scroll/selection
 * leakage between canvases). The drawing engine is Excalidraw's job; the app
 * shell (files, persistence, versions) lives around it. Dark theme is forced.
 */
export default function ExcalidrawWrapper({
  json,
  onApiReady,
  onSceneChange,
  viewMode = false,
  libraryItems,
  onLibraryChange,
}: ExcalidrawWrapperProps) {
  // loadFromBlob is the official inverse of serializeAsJSON; it handles format
  // restoration. The shared library is merged in to seed this instance. Memoised
  // per json (stable within one mount); library is captured at mount time.
  const initialData = useMemo(
    () =>
      loadFromBlob(new Blob([json], { type: "application/json" }), null, null)
        .then((scene) => ({ ...scene, libraryItems }))
        .catch(() => ({ libraryItems })), // corrupt file → start empty rather than crash
    // eslint-disable-next-line react-hooks/exhaustive-deps -- library seeds on mount only
    [json],
  );

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => onApiReady?.(api)}
        initialData={initialData}
        theme="dark"
        viewModeEnabled={viewMode}
        onChange={
          viewMode
            ? undefined
            : (elements) => onSceneChange?.(hashElementsVersion(elements))
        }
        onLibraryChange={onLibraryChange}
      />
    </div>
  );
}
