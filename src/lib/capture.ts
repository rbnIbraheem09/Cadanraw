import { useStore } from "../store/excaliStore";
import { usePrefs } from "../store/prefs";
import { blockSize, createBlockElement, insertBlock, newBlockData } from "./blocks";
import type { BlockData, BlockKind } from "./block-data";
import { findFreeSlot, type Box } from "./layout";
import { sfx } from "./sound";

const INBOX_NAME = "Inbox";

/** Split a jotted thought into a block: a lone link becomes a link card, the
 *  first short line becomes the note's title. */
export function parseCapture(raw: string): { kind: BlockKind; url: string; data: Partial<BlockData> } {
  const text = raw.trim();
  if (/^https?:\/\/\S+$/i.test(text)) return { kind: "link", url: text, data: {} };
  const [first, ...rest] = text.split("\n");
  const body = rest.join("\n").trim();
  if (first.length <= 80 && (body || first.length <= 48))
    return { kind: "note", url: "", data: { title: first, text: body, color: "sand" } };
  return { kind: "note", url: "", data: { title: "Quick note", text, color: "sand" } };
}

/** The board quick notes go to, created on first use. */
async function inboxBoardId(): Promise<string> {
  const store = useStore.getState();
  const saved = usePrefs.getState().inboxBoardId;
  if (saved && store.canvases.some((c) => c.id === saved)) return saved;
  const existing = store.canvases.find((c) => c.name === INBOX_NAME);
  const id = existing?.id ?? (await window.excali.canvases.create(INBOX_NAME)).id;
  usePrefs.getState().set("inboxBoardId", id);
  return id;
}

const boxes = (elements: readonly any[]): Box[] =>
  elements
    .filter((e) => e && !e.isDeleted && Number.isFinite(e.x) && Number.isFinite(e.y))
    .map((e) => ({ x: e.x, y: e.y, width: e.width || 0, height: e.height || 0 }));

/**
 * File a quick note onto a board. If that board is open it lands in the live
 * editor (undoable); otherwise it's written straight into the board's file.
 * Returns the board's name for the confirmation.
 */
export async function captureNote(raw: string): Promise<{ board: string }> {
  if (!raw.trim()) throw new Error("Nothing to save");
  const { kind, url, data } = parseCapture(raw);
  const size = blockSize(kind);
  const store = useStore.getState();
  const editing = !store.homeOpen && !store.previewVersionId && !!store.api;
  const id =
    usePrefs.getState().captureTarget === "open" && editing && store.activeCanvasId
      ? store.activeCanvasId
      : await inboxBoardId();

  if (editing && store.api && id === store.activeCanvasId) {
    const slot = findFreeSlot(boxes(store.api.getSceneElements()), size.width, size.height);
    insertBlock(store.api, kind, url, data, slot);
  } else {
    const scene = JSON.parse(await window.excali.canvases.read(id));
    const elements: any[] = Array.isArray(scene.elements) ? scene.elements : [];
    const slot = findFreeSlot(boxes(elements), size.width, size.height);
    scene.elements = [...elements, createBlockElement(newBlockData(kind, url, data), { ...slot, ...size })];
    const json = JSON.stringify(scene);
    await window.excali.canvases.save(id, json);
    // A board that's loaded but not being edited (version preview) must not
    // come back with stale content.
    if (id === store.activeCanvasId) useStore.setState({ activeCanvasJson: json });
  }
  await useStore.getState().refreshList();
  sfx.drop();
  return { board: useStore.getState().canvases.find((c) => c.id === id)?.name ?? INBOX_NAME };
}
