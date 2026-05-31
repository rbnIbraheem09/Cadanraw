import { useMemo, useEffect, useRef } from "react";
import { Excalidraw, loadFromBlob, hashElementsVersion } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  LibraryItems,
} from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

// ── URL / image paste helpers ─────────────────────────────────────────────────

const YOUTUBE_PATTERNS = [
  /youtube\.com\/watch\?(?:[^#&]*&)*v=([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|tiff?|avif|ico)(\?[^#]*)?$/i;

function extractYouTubeId(url: string): string | null {
  for (const p of YOUTUBE_PATTERNS) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

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
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
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
  const zoom = (appState as { zoom: { value: number } }).zoom?.value ?? 1;
  const sceneX =
    ((appState as { width: number }).width / 2 -
      (appState as { scrollX: number }).scrollX) /
      zoom -
    elemW / 2;
  const sceneY =
    ((appState as { height: number }).height / 2 -
      (appState as { scrollY: number }).scrollY) /
      zoom -
    elemH / 2;

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

async function handleUrlPaste(url: string, api: ExcalidrawImperativeAPI) {
  // YouTube → embed thumbnail with a link back to the video.
  const ytId = extractYouTubeId(url);
  if (ytId) {
    const thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    const img = await window.excali.fetchImage(thumbUrl);
    if (img) {
      await embedImageIntoCanvas(api, img.dataURL, img.mimeType, url);
      return;
    }
  }

  // Direct image URL (detected by file extension).
  if (IMAGE_EXT_RE.test(url)) {
    const img = await window.excali.fetchImage(url);
    if (img) {
      await embedImageIntoCanvas(api, img.dataURL, img.mimeType, url);
      return;
    }
  }

  // Generic webpage → try to pull the og:image and embed that.
  const ogUrl = await window.excali.getOgImage(url);
  if (ogUrl) {
    const img = await window.excali.fetchImage(ogUrl);
    if (img) {
      await embedImageIntoCanvas(api, img.dataURL, img.mimeType, url);
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ExcalidrawWrapperProps {
  json: string;
  onApiReady?: (api: ExcalidrawImperativeAPI) => void;
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
  viewMode = false,
  libraryItems,
  onLibraryChange,
}: ExcalidrawWrapperProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  const initialData = useMemo(
    () =>
      loadFromBlob(new Blob([json], { type: "application/json" }), null, null)
        .then((scene) => ({ ...scene, libraryItems }))
        .catch(() => ({ libraryItems })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [json],
  );

  // Intercept paste events that contain only a URL and embed the target
  // image into the canvas instead of pasting the raw URL text.
  useEffect(() => {
    if (viewMode) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;

      // If the clipboard contains image data, let Excalidraw handle it.
      const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
      if (items.some((i) => i.kind === "file" && i.type.startsWith("image/"))) return;

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
        void handleUrlPaste(text, api);
      }
    };

    window.addEventListener("paste", handlePaste, { capture: true });
    return () => window.removeEventListener("paste", handlePaste, { capture: true });
  }, [viewMode]);

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
          onApiReady?.(api);
        }}
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
