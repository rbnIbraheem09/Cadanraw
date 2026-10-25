import { useMemo, useEffect, useRef } from "react";
import {
  Excalidraw,
  loadFromBlob,
  hashElementsVersion,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  LibraryItems,
} from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

import { syncDotGrid } from "../../lib/canvas-surface";
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

async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadImageDimensions(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = src;
  });
}

async function embedImageIntoCanvas(
  api: ExcalidrawImperativeAPI,
  dataURL: string,
  mimeType: string,
  link: string | null,
) {
  const fileId = await sha1Hex(dataURL);
  const { w, h } = await loadImageDimensions(dataURL);

  // Cap at 800px in any dimension, preserve aspect ratio.
  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(w, h, 1));
  const elemW = Math.max(1, Math.round(w * scale));
  const elemH = Math.max(1, Math.round(h * scale));

  // Convert viewport center to scene (canvas) coordinates.
  const appState = api.getAppState();
  const center = viewportCoordsToSceneCoords(
    {
      clientX: appState.offsetLeft + appState.width / 2,
      clientY: appState.offsetTop + appState.height / 2,
    },
    appState,
  );
  const sceneX = center.x - elemW / 2;
  const sceneY = center.y - elemH / 2;

  // Register the file in Excalidraw's binary-file cache.
  (api.addFiles as (files: unknown[]) => void)([
    {
      id: fileId,
      dataURL,
      mimeType,
      created: Date.now(),
    },
  ]);

  const existing = api.getSceneElements();
  (api.updateScene as (data: { elements: unknown[] }) => void)({
    elements: [
      ...existing,
      {
        type: "image",
        id: crypto.randomUUID(),
        fileId,
        x: sceneX,
        y: sceneY,
        width: elemW,
        height: elemH,
        angle: 0,
        strokeColor: "transparent",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 2 ** 31),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2 ** 31),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link,
        locked: false,
        status: "saved",
        scale: [1, 1],
      },
    ],
  });
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
  if (img) await embedImageIntoCanvas(api, img.dataURL, img.mimeType, url);
  else insertBlock(api, "link", url);
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
