import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  getCommonBounds,
  getVisibleSceneBounds,
  newElementWith,
  restoreElements,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useStore } from "../store/excaliStore";
import {
  BLOCK_KINDS,
  parseBlockData,
  withBlockIds,
  type BlockKind,
} from "./block-data";
import { blockData, insertBlock } from "./blocks";
import { embedImageIntoCanvas, type Placement } from "./images";

// Renderer side of the local MCP server (electron/services/agent-server.ts).
// Every edit goes through the live editor, so it is undoable and autosaved.

type Args = Record<string, any>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function editor(): ExcalidrawImperativeAPI {
  const s = useStore.getState();
  if (!s.api || s.homeOpen || s.previewVersionId || s.loading)
    throw new Error('Open an editable canvas first (manage_canvas "open")');
  return s.api;
}

/** Wait for a canvas's own editor (not the previous one) to finish loading. */
async function opened(id: string, previous: ExcalidrawImperativeAPI | null) {
  for (let i = 0; i < 160; i++) {
    const s = useStore.getState();
    if (
      s.activeCanvasId === id &&
      s.api &&
      s.api !== previous &&
      !s.homeOpen &&
      !s.api.getAppState().isLoading
    )
      return sleep(400); // let images decode before the next read or screenshot
    await sleep(50);
  }
  throw new Error("Canvas did not open");
}

const NOISE = new Set([
  "seed",
  "version",
  "versionNonce",
  "updated",
  "index",
  "isDeleted",
  "lastCommittedPoint",
  "pressures",
  "created",
  "lastRetrieved",
]);
const EMPTY_NOISE = new Set(["groupIds", "boundElements", "selectedIds"]);
/** Drop bookkeeping fields and summarize embedded data so reads stay small. */
function slim<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (
        NOISE.has(key) ||
        v === null ||
        (EMPTY_NOISE.has(key) && Array.isArray(v) && !v.length)
      )
        return undefined;
      if (typeof v === "string" && v.startsWith("data:") && v.length > 200)
        return `${v.slice(0, v.indexOf(","))},<${Math.round(v.length / 1365)} KB omitted>`;
      return v;
    }),
  );
}

function placement(a: Args): Placement {
  const out: Placement = {};
  for (const k of ["x", "y", "width", "height"] as const) {
    if (a[k] === undefined) continue;
    if (
      !Number.isFinite(a[k]) ||
      ((k === "width" || k === "height") && a[k] <= 0)
    )
      throw new Error(`Invalid ${k}`);
    out[k] = a[k];
  }
  return out;
}

async function readCanvas(id?: string) {
  const s = useStore.getState();
  const target = id || (s.homeOpen ? null : s.activeCanvasId);
  if (!target) throw new Error("No canvas is open; pass an id");
  const name = s.canvases.find((c) => c.id === target)?.name;
  if (name === undefined) throw new Error("Unknown canvas id");
  const live =
    target === s.activeCanvasId && !s.homeOpen && !s.previewVersionId
      ? s.api
      : null;
  if (live) {
    const state = live.getAppState();
    return slim({
      id: target,
      name,
      viewport: getVisibleSceneBounds(state).map(Math.round),
      selectedIds: Object.keys(state.selectedElementIds).filter(
        (k) => state.selectedElementIds[k],
      ),
      elements: live.getSceneElements(),
      files: live.getFiles(),
    });
  }
  const scene = JSON.parse(await window.excali.canvases.read(target));
  return slim({
    id: target,
    name,
    elements: (scene.elements ?? []).filter((e: any) => !e.isDeleted),
    files: scene.files ?? {},
  });
}

const endCapture = () => document.body.classList.remove("agent-capture");

/** Frame the target, hide the editor chrome, and report the screen rect to capture. */
async function screenshot(a: Args) {
  const api = editor();
  const all = api.getSceneElements();
  const ids = Array.isArray(a.ids) ? new Set(a.ids) : null;
  const target = ids ? all.filter((e) => ids.has(e.id)) : all;
  if (ids && !target.length) throw new Error("None of those IDs exist");
  const fit = a.fit !== false && target.length > 0;
  const [bx1, by1, bx2, by2] = getCommonBounds(target);
  if (fit) {
    // Exact fit (Excalidraw's own fit rounds zoom down to 10% steps).
    const view = api.getAppState();
    const zoom = Math.min(
      3,
      Math.max(
        0.1,
        Math.min(
          view.width / (bx2 - bx1 || 1),
          view.height / (by2 - by1 || 1),
        ) * 0.92,
      ),
    );
    api.updateScene({
      appState: {
        zoom: { value: zoom as AppState["zoom"]["value"] },
        scrollX: view.width / 2 / zoom - (bx1 + bx2) / 2,
        scrollY: view.height / 2 / zoom - (by1 + by2) / 2,
      },
    });
  }
  document.body.classList.add("agent-capture");
  setTimeout(endCapture, 3000); // safety net if the capture never reports back
  await sleep(250); // let the canvas and block overlays repaint
  const s = api.getAppState();
  const z = s.zoom.value;
  let [x1, y1, x2, y2] = getVisibleSceneBounds(s);
  if (fit) {
    // Crop to the content plus a small margin.
    const pad = 24 / z;
    [x1, y1, x2, y2] = [
      Math.max(x1, bx1 - pad),
      Math.max(y1, by1 - pad),
      Math.min(x2, bx2 + pad),
      Math.min(y2, by2 + pad),
    ];
  }
  return {
    rect: {
      x: s.offsetLeft + (x1 + s.scrollX) * z,
      y: s.offsetTop + (y1 + s.scrollY) * z,
      width: (x2 - x1) * z,
      height: (y2 - y1) * z,
    },
    sceneBounds: [x1, y1, x2, y2].map(Math.round),
    zoom: Math.round(z * 1000) / 1000,
  };
}

async function manageCanvas(a: Args) {
  const s = useStore.getState();
  const name = typeof a.name === "string" ? a.name.trim().slice(0, 200) : "";
  const previous = s.api;
  if (a.action === "create") {
    await s.createCanvas(name || "Untitled");
    const id = useStore.getState().activeCanvasId!;
    await opened(id, previous);
    return { id, opened: true };
  }
  const id = String(a.id ?? "");
  if (!s.canvases.some((c) => c.id === id))
    throw new Error("Unknown canvas id");
  switch (a.action) {
    case "open":
      if (s.previewVersionId) s.exitPreview();
      if (s.activeCanvasId !== id || s.homeOpen || !s.api) {
        await s.openCanvas(id);
        await opened(id, previous);
      }
      return { id, opened: true };
    case "rename":
      if (!name) throw new Error("A name is required");
      await s.renameCanvas(id, name);
      return { id, name };
    case "delete":
      await s.deleteCanvas(id);
      return { id, deleted: true, note: "Moved to the system trash" };
  }
  throw new Error("Unknown action");
}

function addElements(a: Args) {
  const api = editor();
  const allowed = ["rectangle", "ellipse", "diamond", "text", "line", "arrow"];
  if (!Array.isArray(a.elements) || a.elements.length > 200)
    throw new Error("Supply at most 200 elements");
  const existing = new Set(
    api.getSceneElementsIncludingDeleted().map((e) => e.id),
  );
  for (const e of a.elements) {
    if (
      !e ||
      !allowed.includes(e.type) ||
      !Number.isFinite(e.x) ||
      !Number.isFinite(e.y)
    )
      throw new Error("Use drawing/text element skeletons with finite x and y");
    if (e.id !== undefined && (typeof e.id !== "string" || existing.has(e.id)))
      throw new Error(`Element id ${e.id} is already in use`);
  }
  // Keep agent-chosen IDs so later calls can reference them.
  const elements = convertToExcalidrawElements(a.elements, {
    regenerateIds: false,
  });
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return { created: elements.map(({ id, type }) => ({ id, type })) };
}

const NUMERIC = [
  "x",
  "y",
  "width",
  "height",
  "angle",
  "strokeWidth",
  "roughness",
  "opacity",
  "fontSize",
  "fontFamily",
];
const TEXTUAL = [
  "text",
  "textAlign",
  "verticalAlign",
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeStyle",
];

function updateElements(a: Args) {
  const api = editor();
  if (!Array.isArray(a.updates) || a.updates.length > 200)
    throw new Error("Supply at most 200 updates");
  const updates = new Map(a.updates.map((u: Args) => [u?.id, u]));
  const touched = new Set<string>();
  let elements = api.getSceneElementsIncludingDeleted().map((e) => {
    const u = updates.get(e.id) as Args | undefined;
    if (!u || e.isDeleted) return e;
    touched.add(e.id);
    const patch: Args = {};
    for (const k of NUMERIC)
      if (k in u) {
        if (
          !Number.isFinite(u[k]) ||
          (/width|height|fontSize/.test(k) && u[k] <= 0)
        )
          throw new Error(`Invalid ${k} for ${e.id}`);
        patch[k] = u[k];
      }
    for (const k of TEXTUAL)
      if (k in u) {
        if (typeof u[k] !== "string")
          throw new Error(`Invalid ${k} for ${e.id}`);
        patch[k] = u[k];
      }
    if ("text" in patch) patch.originalText = patch.text;
    // Lines, arrows and freehand strokes resize by scaling their points.
    if ("points" in e && ("width" in patch || "height" in patch)) {
      const sx = e.width ? (patch.width ?? e.width) / e.width : 1;
      const sy = e.height ? (patch.height ?? e.height) / e.height : 1;
      patch.points = e.points.map(([px, py]) => [px * sx, py * sy]);
    }
    if (u.block !== undefined) {
      const data = blockData(e);
      if (!data) throw new Error(`${e.id} is not a Cadanraw block`);
      patch.customData = {
        ...e.customData,
        cadanrawBlock: parseBlockData({
          ...data,
          ...withBlockIds(u.block ?? {}),
          kind: data.kind,
        }),
      };
    }
    return newElementWith(e, patch);
  });
  const missing = [...updates.keys()].filter(
    (id) => !touched.has(id as string),
  );
  if (missing.length)
    throw new Error(`Unknown element ids: ${missing.join(", ")}`);

  // Re-measure edited text and keep labels centred in moved/resized containers.
  const byId = new Map(elements.map((e) => [e.id, e]));
  elements = elements.map((e) => {
    if (e.type !== "text" || e.isDeleted) return e;
    const container = e.containerId ? byId.get(e.containerId) : undefined;
    if (!touched.has(e.id) && !(container && touched.has(container.id)))
      return e;
    const fresh = restoreElements(
      [...(container ? [container] : []), { ...e, text: e.originalText }],
      null,
      { refreshDimensions: true, repairBindings: true },
    ).find((r) => r.id === e.id) as typeof e | undefined;
    if (!fresh) return e;
    const box = {
      text: fresh.text,
      x: fresh.x,
      y: fresh.y,
      width: fresh.width,
      height: fresh.height,
    };
    if (container && !("points" in container)) {
      const pad = 5;
      box.x =
        e.textAlign === "left"
          ? container.x + pad
          : e.textAlign === "right"
            ? container.x + container.width - box.width - pad
            : container.x + (container.width - box.width) / 2;
      box.y =
        e.verticalAlign === "top"
          ? container.y + pad
          : e.verticalAlign === "bottom"
            ? container.y + container.height - box.height - pad
            : container.y + (container.height - box.height) / 2;
    }
    return newElementWith(e, box);
  });
  api.updateScene({
    elements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return { updated: [...touched] };
}

function deleteElements(a: Args) {
  const api = editor();
  if (!Array.isArray(a.ids)) throw new Error("ids must be an array");
  const ids = new Set<string>(a.ids);
  const all = api.getSceneElementsIncludingDeleted();
  const missing = [...ids].filter(
    (id) => !all.some((e) => e.id === id && !e.isDeleted),
  );
  if (missing.length)
    throw new Error(`Unknown element ids: ${missing.join(", ")}`);
  const doomed = (e: ExcalidrawElement) =>
    ids.has(e.id) ||
    ("containerId" in e && !!e.containerId && ids.has(e.containerId));
  api.updateScene({
    elements: all.map((e) =>
      doomed(e) && !e.isDeleted ? newElementWith(e, { isDeleted: true }) : e,
    ),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return { deleted: [...ids] };
}

export async function runAgentTool(method: string, a: Args): Promise<unknown> {
  const s = useStore.getState();
  switch (method) {
    case "list_canvases":
      await s.refreshList();
      return {
        activeCanvasId: s.homeOpen ? null : s.activeCanvasId,
        canvases: useStore
          .getState()
          .canvases.map(
            ({ id, name, folderId, elementCount, updatedAt, isPinned }) => ({
              id,
              name,
              folderId,
              elementCount,
              updatedAt,
              isPinned: isPinned || undefined,
            }),
          ),
        folders: useStore.getState().folders,
      };
    case "read_canvas":
      return readCanvas(typeof a.id === "string" ? a.id : undefined);
    case "screenshot":
      return screenshot(a);
    case "screenshot_done": // internal: sent by the main process after capture
      return endCapture();
    case "manage_canvas":
      return manageCanvas(a);
    case "add_elements":
      return addElements(a);
    case "add_image": {
      const api = editor();
      const id = await embedImageIntoCanvas(
        api,
        a.image.dataURL,
        a.image.mimeType,
        null,
        placement(a),
      );
      return { id };
    }
    case "add_block": {
      const api = editor();
      if (!BLOCK_KINDS.includes(a.kind)) throw new Error("Invalid block kind");
      const url = String(a.url ?? a.data?.url ?? "");
      if (a.kind === "link" && !/^https?:\/\//.test(url))
        throw new Error("A valid URL is required");
      const data =
        a.data && typeof a.data === "object" ? withBlockIds(a.data) : {};
      return {
        id: insertBlock(api, a.kind as BlockKind, url, data, placement(a)),
      };
    }
    case "update_elements":
      return updateElements(a);
    case "delete_elements":
      return deleteElements(a);
  }
  throw new Error("Unknown command");
}
