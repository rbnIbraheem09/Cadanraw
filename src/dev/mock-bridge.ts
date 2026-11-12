// Development only: `?demo` in a browser runs the desktop app against an
// in-memory library, so the interface can be worked on (and screenshotted)
// without Electron. Never bundled into the app: main.tsx loads it only in dev.
import type { CanvasMeta, FolderMeta } from "../types/canvas";
import type { VersionMeta } from "../types/version";
import { buildTemplateScene, type TemplateId } from "../lib/templates";

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString().slice(0, 19).replace("T", " ");
const EMPTY = JSON.stringify({ type: "excalidraw", version: 2, elements: [], appState: {}, files: {} });
const count = (json: string) =>
  (JSON.parse(json).elements ?? []).filter((e: { isDeleted?: boolean }) => !e.isDeleted).length;

export function installMockBridge() {
  const scenes = new Map<string, string>();
  const versions = new Map<string, { meta: VersionMeta; json: string }>();
  let canvases: CanvasMeta[] = [];
  let folders: FolderMeta[] = [
    { id: "f-work", name: "Work", parentId: null },
    { id: "f-ideas", name: "Ideas", parentId: null },
    { id: "f-launch", name: "Launch", parentId: "f-work" },
  ];
  let menuListener: ((action: string) => void) | null = null;

  const add = (name: string, json: string, extra: Partial<CanvasMeta> = {}) => {
    const meta: CanvasMeta = {
      id: crypto.randomUUID(),
      name,
      elementCount: count(json),
      createdAt: now(),
      updatedAt: now(),
      tags: [],
      isPinned: false,
      sortOrder: 0,
      folderId: null,
      ...extra,
    };
    scenes.set(meta.id, json);
    canvases = [meta, ...canvases];
    return meta;
  };
  const get = (id: string) => {
    const meta = canvases.find((c) => c.id === id);
    if (!meta) throw new Error(`Canvas not found: ${id}`);
    return meta;
  };
  const patch = (id: string, change: Partial<CanvasMeta>) => {
    canvases = canvases.map((c) => (c.id === id ? { ...c, ...change } : c));
    return get(id);
  };

  const seed: [string, TemplateId, Partial<CanvasMeta>][] = [
    ["Meeting notes", "meeting", { updatedAt: ago(60 * 30) }],
    ["Film opening", "storyboard", { updatedAt: ago(60 * 26), folderId: "f-ideas" }],
    ["Brand moodboard", "moodboard", { updatedAt: ago(60 * 5), folderId: "f-work" }],
    ["This week", "week", { updatedAt: ago(180) }],
    ["How the app fits together", "mindmap", { updatedAt: ago(42), folderId: "f-ideas" }],
    ["Launch plan", "plan", { updatedAt: ago(9), folderId: "f-launch", isPinned: true }],
    ["Naming ideas", "brainstorm", { updatedAt: ago(2), isPinned: true }],
  ];
  for (const [name, template, extra] of seed) add(name, buildTemplateScene(template), extra);

  const agent = { enabled: false, url: "", token: "", allowWrite: false };

  const bridge = {
    agent: {
      status: async () => ({ ...agent }),
      start: async (allowWrite: boolean) =>
        Object.assign(agent, {
          enabled: true,
          allowWrite,
          url: "http://127.0.0.1:0/mcp",
          token: "demo",
        }),
      stop: async () => Object.assign(agent, { enabled: false }),
      resetToken: async () => ({ ...agent }),
      setup: async () => ({ done: true }),
      onRequest: () => () => {},
      respond: () => {},
    },
    platform: "darwin" as NodeJS.Platform,
    prefs: { sync: async () => ({ captureRegistered: true }) },
    capture: {
      open: async () => {},
      hide: () => {},
      submit: async () => ({ board: "Inbox" }),
      onShow: () => () => {},
    },
    revealDataFolder: async () => {},
    getAppInfo: async () => ({
      name: "Cadanraw",
      version: "demo",
      dataPath: "~/Library/Application Support/Cadanraw",
      electron: "",
      chrome: "",
    }),
    getLinkMetadata: async () => null,
    fetchImage: async () => null,
    getOgImage: async () => null,
    checkForUpdates: async () => null,
    openExternal: async (url: string) => void window.open(url, "_blank", "noopener"),
    folders: {
      list: async () => folders,
      create: async (name: string, parentId: string | null) => {
        const folder = { id: crypto.randomUUID(), name, parentId };
        folders = [...folders, folder];
        return folder;
      },
      rename: async (id: string, name: string) => {
        folders = folders.map((f) => (f.id === id ? { ...f, name } : f));
        return folders.find((f) => f.id === id)!;
      },
      remove: async (id: string) => {
        const parent = folders.find((f) => f.id === id)?.parentId ?? null;
        folders = folders
          .filter((f) => f.id !== id)
          .map((f) => (f.parentId === id ? { ...f, parentId: parent } : f));
        canvases = canvases.map((c) => (c.folderId === id ? { ...c, folderId: parent } : c));
      },
    },
    canvases: {
      list: async () =>
        [...canvases].sort(
          (a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt),
        ),
      preview: async (id: string) =>
        (JSON.parse(scenes.get(id) ?? EMPTY).elements ?? [])
          .filter((e: any) => !e.isDeleted)
          .slice(0, 300)
          .map((e: any) => ({
            id: String(e.id),
            type: String(e.type),
            x: e.x,
            y: e.y,
            width: e.width || 1,
            height: e.height || 1,
            stroke: e.strokeColor ?? "#a5b5c5",
            background: e.backgroundColor ?? "transparent",
            text: String(e.customData?.cadanrawBlock?.title || e.text || "").slice(0, 120),
            kind: e.customData?.cadanrawBlock?.kind,
            points: Array.isArray(e.points) ? e.points.slice(0, 100) : undefined,
          })),
      move: async (id: string, folderId: string | null) => patch(id, { folderId }),
      create: async (name: string) => add(name, EMPTY),
      import: async (name: string, json: string) => add(name, json),
      duplicate: async (id: string) => add(`${get(id).name} copy`, scenes.get(id) ?? EMPTY),
      setPinned: async (id: string, isPinned: boolean) => patch(id, { isPinned }),
      read: async (id: string) => {
        get(id);
        return scenes.get(id) ?? EMPTY;
      },
      save: async (id: string, json: string) => {
        scenes.set(id, json);
        const meta = patch(id, { updatedAt: now(), elementCount: count(json) });
        return { updatedAt: meta.updatedAt, elementCount: meta.elementCount };
      },
      rename: async (id: string, name: string) => patch(id, { name }),
      remove: async (id: string) => {
        canvases = canvases.filter((c) => c.id !== id);
        scenes.delete(id);
      },
    },
    versions: {
      list: async (canvasId: string) =>
        [...versions.values()]
          .map((v) => v.meta)
          .filter((v) => v.canvasId === canvasId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      create: async (canvasId: string, json: string, description: string | null) => {
        const meta: VersionMeta = {
          id: crypto.randomUUID(),
          canvasId,
          createdAt: now(),
          description,
          elementCount: count(json),
          sizeBytes: json.length,
        };
        versions.set(meta.id, { meta, json });
        return meta;
      },
      read: async (versionId: string) => versions.get(versionId)!.json,
      restore: async (versionId: string) => {
        const version = versions.get(versionId)!;
        scenes.set(version.meta.canvasId, version.json);
        patch(version.meta.canvasId, { updatedAt: now() });
        return { json: version.json };
      },
      remove: async (versionId: string) => void versions.delete(versionId),
    },
    library: { read: async () => null, save: async () => {} },
    dialog: {
      export: async () => ({ ok: true }),
      openFile: async () => [],
    },
    window: {
      minimize: async () => {},
      toggleMaximize: async () => false,
      close: async () => {},
      isMaximized: async () => false,
      onMaximizedChange: () => () => {},
      setButtonsHidden: async () => {},
    },
    onMenuAction: (cb: (action: string) => void) => {
      menuListener = cb;
      return () => {
        menuListener = null;
      };
    },
  };

  // Stand in for the native menu's accelerators.
  const keys: Record<string, string> = {
    k: "command-palette",
    p: "go-to-board",
    n: "new-canvas",
    b: "toggle-sidebar",
    ",": "settings",
    ".": "focus-mode",
    "1": "home",
    s: "save",
    e: "export",
  };
  window.addEventListener(
    "keydown",
    (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const action = e.shiftKey && e.key.toLowerCase() === "s" ? "save-version" : keys[e.key.toLowerCase()];
      if (!action || (e.shiftKey && action !== "save-version")) return;
      e.preventDefault();
      e.stopPropagation();
      menuListener?.(action);
    },
    true,
  );

  (window as unknown as { excali: unknown }).excali = bridge;
}
