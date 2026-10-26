import {
  CaptureUpdateAction,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export interface Placement {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadImageDimensions(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
    img.onerror = () => reject(new Error("Not a readable image"));
    img.src = src;
  });
}

/** Add an image element (undoable). Defaults to the view center, max 800 units. Returns its ID. */
export async function embedImageIntoCanvas(
  api: ExcalidrawImperativeAPI,
  dataURL: string,
  mimeType: string,
  link: string | null,
  place: Placement = {},
): Promise<string> {
  const fileId = await sha1Hex(dataURL);
  const { w, h } = await loadImageDimensions(dataURL);

  // Fill in a missing side from the aspect ratio; otherwise cap at 800 units.
  const scale = Math.min(1, 800 / Math.max(w, h, 1));
  const elemW = Math.max(
    1,
    Math.round(
      place.width ?? (place.height ? (place.height * w) / h : w * scale),
    ),
  );
  const elemH = Math.max(1, Math.round(place.height ?? (elemW * h) / w));

  const appState = api.getAppState();
  const center = viewportCoordsToSceneCoords(
    {
      clientX: appState.offsetLeft + appState.width / 2,
      clientY: appState.offsetTop + appState.height / 2,
    },
    appState,
  );
  const id = crypto.randomUUID();

  // Register the file in Excalidraw's binary-file cache.
  (api.addFiles as (files: unknown[]) => void)([
    {
      id: fileId,
      dataURL,
      mimeType,
      created: Date.now(),
    },
  ]);

  (api.updateScene as (data: object) => void)({
    elements: [
      ...api.getSceneElementsIncludingDeleted(),
      {
        type: "image",
        id,
        fileId,
        x: place.x ?? center.x - elemW / 2,
        y: place.y ?? center.y - elemH / 2,
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
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return id;
}
