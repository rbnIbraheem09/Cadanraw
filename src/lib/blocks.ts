import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  newElementWith,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";

import { parseBlockData } from "./block-data";
import type { Placement } from "./images";
export type { BlockKind, BlockData } from "./block-data";
import type { BlockKind, BlockData } from "./block-data";
export function youtubeId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\.|^m\./g, "");
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1).split("/")[0]
        : ["youtube.com", "youtube-nocookie.com"].includes(host)
          ? (u.searchParams.get("v") ??
            u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1])
          : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function blockData(element: ExcalidrawElement): BlockData | undefined {
  return parseBlockData(element.customData?.cadanrawBlock);
}
/** Default card size for each kind of block, in scene units. */
export function blockSize(kind: BlockKind): { width: number; height: number } {
  return {
    width:
      kind === "kanban"
        ? 840
        : kind === "calendar"
          ? 560
          : kind === "table"
            ? 540
            : kind === "checklist"
              ? 480
              : 360,
    height:
      kind === "kanban"
        ? 420
        : kind === "calendar"
          ? 480
          : kind === "board"
            ? 300
            : kind === "link" || kind === "file"
              ? 280
              : 250,
  };
}

/** A fresh block's content, with anything in `initial` laid over the defaults. */
export function newBlockData(
  kind: BlockKind,
  url = "",
  initial: Partial<BlockData> = {},
): BlockData {
  return parseBlockData({
    createdAt: Date.now(),
    columns: ["To do", "In progress", "Done"].map((title) => ({
      id: crypto.randomUUID(),
      title,
      cards: [],
    })),
    boardId: "",
    title: {
      note: "Untitled note",
      checklist: "Checklist",
      table: "Table",
      kanban: "Project plan",
      file: "Attachment",
      board: "Related board",
      calendar: "Calendar",
      link: youtubeId(url) ? "YouTube video" : "Link",
    }[kind],
    text: "",
    items: [{ id: crypto.randomUUID(), text: "", done: false }],
    rows: [
      ["Name", "Notes"],
      ["", ""],
      ["", ""],
    ],
    month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    events: {},
    url,
    color: kind === "note" ? "slate" : "charcoal",
    ...initial,
    kind,
  })!;
}

/**
 * Build a block element without an editor. A native embeddable remains
 * movable, resizable, undoable and serializable.
 */
export function createBlockElement(
  data: BlockData,
  box: { x: number; y: number; width: number; height: number },
): ExcalidrawEmbeddableElement {
  const base = convertToExcalidrawElements([
    {
      type: "rectangle",
      ...box,
      roughness: 0,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      strokeWidth: 0,
      roundness: { type: 3, value: 22 },
    },
  ])[0];
  return {
    ...base,
    type: "embeddable",
    link: "https://cadanraw.local/block",
    backgroundColor: "transparent",
    customData: { cadanrawBlock: data },
  } as ExcalidrawEmbeddableElement;
}

export function insertBlock(
  api: ExcalidrawImperativeAPI,
  kind: BlockKind,
  url = "",
  initial: Partial<BlockData> = {},
  place: Placement = {},
): string {
  const state = api.getAppState();
  const size = blockSize(kind);
  const width = place.width ?? size.width;
  const height = place.height ?? size.height;
  const center = viewportCoordsToSceneCoords(
    {
      clientX: state.offsetLeft + state.width / 2,
      clientY: state.offsetTop + state.height / 2,
    },
    state,
  );
  const data = newBlockData(kind, url, initial);
  let x = place.x ?? center.x - width / 2;
  const y = place.y ?? center.y - height / 2;
  const existing = api.getSceneElements();
  // Keep the new card beside existing content instead of hiding it in a stack.
  for (
    let attempt = 0;
    place.x === undefined &&
    attempt < 50 &&
    existing.some(
      (e) =>
        x < e.x + e.width + 24 &&
        x + width + 24 > e.x &&
        y < e.y + e.height + 24 &&
        y + height + 24 > e.y,
    );
    attempt++
  )
    x += width + 32;
  const element = createBlockElement(data, { x, y, width, height });
  api.setActiveTool({ type: "selection" });
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), element],
    appState: {
      selectedElementIds: {},
      activeEmbeddable: {
        element: element as NonDeletedExcalidrawElement,
        state: "active",
      },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  if (
    place.x === undefined &&
    (x !== center.x - width / 2 ||
      width * state.zoom.value > state.width * 0.85)
  )
    api.scrollToContent(element, {
      fitToViewport: true,
      maxZoom: state.zoom.value,
      viewportZoomFactor: 0.85,
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  return element.id;
}
/** Insert a block centred on a screen point (the "/" menu drops it under the cursor). */
export function insertBlockAtPoint(
  api: ExcalidrawImperativeAPI,
  kind: BlockKind,
  point: { clientX: number; clientY: number },
  url = "",
): string {
  const { width, height } = blockSize(kind);
  const scene = viewportCoordsToSceneCoords(point, api.getAppState());
  return insertBlock(api, kind, url, {}, {
    x: scene.x - width / 2,
    y: scene.y - height / 2,
  });
}
export function updateBlock(
  api: ExcalidrawImperativeAPI,
  id: string,
  patch: Partial<BlockData>,
) {
  let replacement: ExcalidrawElement | undefined;
  const elements = api.getSceneElementsIncludingDeleted().map((e) => {
    if (e.id !== id) return e;
    replacement = newElementWith(e, {
      customData: {
        ...e.customData,
        cadanrawBlock: { ...blockData(e), ...patch },
      },
    });
    return replacement;
  });
  const active = api.getAppState().activeEmbeddable;
  api.updateScene({
    elements,
    ...(active?.element.id === id && replacement
      ? {
          appState: {
            activeEmbeddable: {
              ...active,
              element: replacement as NonDeletedExcalidrawElement,
            },
          },
        }
      : {}),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}

/** Upgrade early rich blocks whose native outline was visible behind the card. */
export function normalizeBlockElements<T extends ExcalidrawElement>(
  elements: readonly T[],
): readonly T[] {
  return elements.map((element) => {
    if (
      !blockData(element) ||
      (element.type === "embeddable" &&
        element.link === "https://cadanraw.local/block" &&
        element.strokeColor === "transparent" &&
        element.strokeWidth === 0 &&
        element.backgroundColor === "transparent" &&
        element.roundness?.type === 3 &&
        element.roundness.value === 22)
    )
      return element;
    return newElementWith(element as ExcalidrawElement, {
      type: "embeddable",
      link: "https://cadanraw.local/block",
      strokeColor: "transparent",
      backgroundColor: "transparent",
      strokeWidth: 0,
      roughness: 0,
      roundness: { type: 3, value: 22 },
    }) as T;
  });
}
