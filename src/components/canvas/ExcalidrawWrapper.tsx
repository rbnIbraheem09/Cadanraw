import { useMemo, useEffect, useRef } from "react";
import {
  Excalidraw,
  loadFromBlob,
  hashElementsVersion,
} from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  LibraryItems,
} from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

import { syncDotGrid } from "../../lib/canvas-surface";
import { embedImageIntoCanvas } from "../../lib/images";
import CanvasBlock from "../blocks/CanvasBlock";
import {
  blockData,
  insertBlock,
  updateBlock,
  normalizeBlockElements,
} from "../../lib/blocks";

// ── URL / image paste helpers ─────────────────────────────────────────────────

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|tiff?|avif|ico)(\?[^#]*)?$/i;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!(
    target.closest("input") ||
    target.closest("textarea") ||
    target.closest('[contenteditable="true"]') ||
    target.closest('[contenteditable=""]')
  );
}

async function handleUrlPaste(
  url: string,
  api: ExcalidrawImperativeAPI,
  alive: () => boolean,
) {
  // Insert the card synchronously. A failed network request never eats a paste.
  if (!IMAGE_EXT_RE.test(url)) {
    insertBlock(api, "link", url);
    return;
  }
  const img = await window.excali.fetchImage(url).catch(() => null);
  if (!alive()) return;
  try {
    if (!img) throw new Error("Not an image");
    await embedImageIntoCanvas(api, img.dataURL, img.mimeType, url);
  } catch {
    insertBlock(api, "link", url);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ExcalidrawWrapperProps {
  json: string;
  onApiReady?: (api: ExcalidrawImperativeAPI) => void;
  onPointerUpdate?: (pointer: { x: number; y: number }) => void;
  onSceneChange?: (sceneHash: number) => void;
  viewMode?: boolean;
  libraryItems?: LibraryItems;
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
  onPointerUpdate,
  viewMode = false,
  libraryItems,
  onLibraryChange,
}: ExcalidrawWrapperProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  const initialData = useMemo(
    () =>
      loadFromBlob(new Blob([json], { type: "application/json" }), null, null)
        .then((scene) => ({
          ...scene,
          elements: normalizeBlockElements(scene.elements ?? []),
          appState: { ...scene.appState, viewBackgroundColor: "transparent" },
          libraryItems,
        }))
        .catch(() => ({
          appState: { viewBackgroundColor: "transparent" },
          libraryItems,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [json],
  );

  // Repair cards created during development or imported from earlier renderers.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const current = api.getSceneElementsIncludingDeleted();
    const normalized = normalizeBlockElements(current);
    if (normalized.some((element, index) => element !== current[index]))
      api.updateScene({ elements: normalized });
  }, [json]);

  // Intercept paste events that contain only a URL and embed the target
  // image into the canvas instead of pasting the raw URL text.
  useEffect(() => {
    if (viewMode) return;

    let alive = true;
    const handlePaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;

      // If the clipboard contains image data, let Excalidraw handle it.
      const items = e.clipboardData?.items
        ? Array.from(e.clipboardData.items)
        : [];
      if (items.some((i) => i.kind === "file" && i.type.startsWith("image/")))
        return;

      const text = e.clipboardData?.getData("text/plain")?.trim() ?? "";
      if (!text) return;

      // Only intercept single-line http/https URLs.
      if (text.includes("\n") || text.includes(" ")) return;
      let url: URL;
      try {
        url = new URL(text);
      } catch {
        return;
      }
      if (!["http:", "https:"].includes(url.protocol)) return;

      // We have a URL — take ownership and try to embed its image.
      e.preventDefault();
      e.stopPropagation();

      const api = apiRef.current;
      if (api) {
        void handleUrlPaste(text, api, () => alive);
      }
    };

    window.addEventListener("paste", handlePaste, { capture: true });
    return () => {
      alive = false;
      window.removeEventListener("paste", handlePaste, { capture: true });
    };
  }, [viewMode]);

  return (
    <div className="h-full w-full dot-surface" ref={surfaceRef}>
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
          onApiReady?.(api);
        }}
        onLinkOpen={(element, event) => {
          const data = blockData(element);
          if (data) {
            event.preventDefault();
            if (data.url) {
              if (window.excali) void window.excali.openExternal(data.url);
              else window.open(data.url, "_blank", "noopener,noreferrer");
            }
          }
        }}
        validateEmbeddable={(link) =>
          link === "https://cadanraw.local/block" ? true : undefined
        }
        renderEmbeddable={(element) => {
          const data = blockData(element);
          return data ? (
            <CanvasBlock
              data={data}
              readOnly={viewMode}
              onChange={(patch) => {
                if (apiRef.current)
                  updateBlock(apiRef.current, element.id, patch);
              }}
            />
          ) : null;
        }}
        initialData={initialData}
        theme="dark"
        onPointerUpdate={(payload) => onPointerUpdate?.(payload.pointer)}
        viewModeEnabled={viewMode}
        onChange={(elements, state) => {
          syncDotGrid(surfaceRef.current, state);
          if (!viewMode) onSceneChange?.(hashElementsVersion(elements));
        }}
        onLibraryChange={onLibraryChange}
      />
    </div>
  );
}
