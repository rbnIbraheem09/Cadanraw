import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  serializeAsJSON,
  hashElementsVersion,
  serializeLibraryAsJSON,
  loadLibraryFromBlob,
  getLibraryItemsHash,
  exportToBlob,
  exportToSvg,
} from "@excalidraw/excalidraw";

type ExportFormat = "png" | "svg" | "excalidraw";
import type {
  ExcalidrawImperativeAPI,
  LibraryItems,
} from "@excalidraw/excalidraw/types";
import type { CanvasMeta } from "../types/canvas";
import type { VersionMeta } from "../types/version";

export const DEFAULT_SIDEBAR_WIDTH = 264;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 480;
const AUTO_VERSION_INTERVAL_MS = 30 * 60 * 1000; // snapshot at most every 30 min of editing

// Monotonic token so a slow canvas load can't overwrite a newer one (rapid switching).
let loadToken = 0;
let toastSeq = 0;
let librarySaveTimer: ReturnType<typeof setTimeout> | null = null;

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

/** Baseline content hash of a loaded scene, computed from the file (not a mount
 *  onChange) so a first edit can never be mistaken for "no change". */
function hashSceneJson(json: string): number {
  try {
    const data = JSON.parse(json) as { elements?: unknown[] };
    return hashElementsVersion(
      (data.elements ?? []) as unknown as Parameters<typeof hashElementsVersion>[0],
    );
  } catch {
    return 0;
  }
}

interface ExcaliState {
  // ── Data ──
  canvases: CanvasMeta[];
  activeCanvasId: string | null;
  activeCanvasJson: string | null;
  loading: boolean;
  api: ExcalidrawImperativeAPI | null;

  // ── Save / dirty tracking ──
  isDirty: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  savedSceneHash: number;
  currentSceneHash: number;

  // ── Version history (for the active canvas) ──
  versions: VersionMeta[];
  editedSinceVersion: boolean;
  lastVersionAt: number; // ms epoch, for the 30-min auto-version cadence
  previewVersionId: string | null;
  previewJson: string | null;

  // ── Shared library (one .excalidrawlib across all canvases) ──
  libraryItems: LibraryItems;
  savedLibraryHash: number;

  // ── Persisted UI prefs (localStorage) ──
  sidebarOpen: boolean;
  sidebarWidth: number;
  historyOpen: boolean;
  lastActiveCanvasId: string | null;

  // ── Ephemeral UI ──
  newCanvasDialogOpen: boolean;
  saveVersionDialogOpen: boolean;
  exportDialogOpen: boolean;
  pendingDeleteId: string | null;
  searchQuery: string;
  toasts: Toast[];

  // ── Actions ──
  setApi: (api: ExcalidrawImperativeAPI | null) => void;
  markChanged: (sceneHash: number) => void;
  loadLibrary: () => Promise<void>;
  handleLibraryChange: (items: LibraryItems) => void;
  refreshList: () => Promise<void>;
  refreshVersions: () => Promise<void>;
  bootstrap: () => Promise<void>;
  openCanvas: (id: string) => Promise<void>;
  createCanvas: (name: string) => Promise<void>;
  importCanvas: (name: string, json: string) => Promise<void>;
  exportActiveCanvas: (format: ExportFormat) => Promise<void>;
  requestExport: (id: string) => Promise<void>;
  duplicateCanvas: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  saveActiveCanvas: (opts?: {
    notify?: boolean;
    skipAutoVersion?: boolean;
  }) => Promise<string | null>;

  saveVersion: (description: string) => Promise<void>;
  previewVersion: (versionId: string) => Promise<void>;
  exitPreview: () => void;
  restoreVersion: (versionId: string) => Promise<void>;
  deleteVersion: (versionId: string) => Promise<void>;

  toggleSidebar: () => void;
  toggleHistory: () => void;
  setSidebarWidth: (w: number) => void;
  openNewCanvasDialog: () => void;
  closeNewCanvasDialog: () => void;
  openSaveVersionDialog: () => void;
  closeSaveVersionDialog: () => void;
  openExportDialog: () => void;
  closeExportDialog: () => void;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
  pushToast: (message: string, type: Toast["type"]) => void;
  dismissToast: (id: number) => void;
}

// State applied whenever a different canvas becomes active. Baseline hash comes
// from the file, and version/preview tracking resets for the new canvas.
const freshCanvasState = (lastSavedAt: string | null, baseHash: number) => ({
  isDirty: false,
  saving: false,
  lastSavedAt,
  savedSceneHash: baseHash,
  currentSceneHash: baseHash,
  editedSinceVersion: false,
  lastVersionAt: Date.now(),
  previewVersionId: null,
  previewJson: null,
});

export const useStore = create<ExcaliState>()(
  persist(
    (set, get) => ({
      canvases: [],
      activeCanvasId: null,
      activeCanvasJson: null,
      loading: false,
      api: null,

      isDirty: false,
      saving: false,
      lastSavedAt: null,
      savedSceneHash: 0,
      currentSceneHash: 0,

      versions: [],
      editedSinceVersion: false,
      lastVersionAt: 0,
      previewVersionId: null,
      previewJson: null,

      libraryItems: [],
      savedLibraryHash: 0,

      sidebarOpen: true,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      historyOpen: true,
      lastActiveCanvasId: null,

      newCanvasDialogOpen: false,
      saveVersionDialogOpen: false,
      exportDialogOpen: false,
      pendingDeleteId: null,
      searchQuery: "",
      toasts: [],

      setApi: (api) => set({ api }),

      markChanged: (sceneHash) => {
        if (!get().activeCanvasId) return;
        const dirty = sceneHash !== get().savedSceneHash;
        set({
          currentSceneHash: sceneHash,
          isDirty: dirty,
          editedSinceVersion: get().editedSinceVersion || dirty,
        });
      },

      loadLibrary: async () => {
        try {
          const json = await window.excali.library.read();
          const items: LibraryItems = json
            ? await loadLibraryFromBlob(new Blob([json], { type: "application/json" }))
            : [];
          set({ libraryItems: items, savedLibraryHash: getLibraryItemsHash(items) });
        } catch (err) {
          console.error("Failed to load library", err);
          set({ libraryItems: [] });
        }
      },

      // Fired by Excalidraw's built-in library UI. Update the shared state now (so
      // the next canvas seeds correctly) and debounce the disk write.
      handleLibraryChange: (items) => {
        set({ libraryItems: items });
        const hash = getLibraryItemsHash(items);
        if (hash === get().savedLibraryHash) return; // e.g. the initial seed echo
        if (librarySaveTimer) clearTimeout(librarySaveTimer);
        librarySaveTimer = setTimeout(async () => {
          try {
            await window.excali.library.save(serializeLibraryAsJSON(items));
            set({ savedLibraryHash: hash });
          } catch (err) {
            console.error("Failed to save library", err);
            get().pushToast("Couldn't save library", "error");
          }
        }, 600);
      },

      refreshList: async () => {
        set({ canvases: await window.excali.canvases.list() });
      },

      refreshVersions: async () => {
        const id = get().activeCanvasId;
        set({ versions: id ? await window.excali.versions.list(id) : [] });
      },

      bootstrap: async () => {
        await get().refreshList();
        await get().loadLibrary(); // load before opening a canvas so it seeds the editor
        const last = get().lastActiveCanvasId;
        if (last && get().canvases.some((c) => c.id === last)) {
          await get().openCanvas(last);
        }
      },

      openCanvas: async (id) => {
        if (id === get().activeCanvasId) return;
        await get().saveActiveCanvas(); // never lose the current canvas's edits
        const token = ++loadToken;
        set({ loading: true });
        try {
          const json = await window.excali.canvases.read(id);
          if (token !== loadToken) return; // a newer open superseded this one
          set({
            activeCanvasId: id,
            activeCanvasJson: json,
            lastActiveCanvasId: id,
            loading: false,
            ...freshCanvasState(
              get().canvases.find((c) => c.id === id)?.updatedAt ?? null,
              hashSceneJson(json),
            ),
          });
          await get().refreshVersions();
        } catch (err) {
          if (token === loadToken) set({ loading: false });
          console.error("Failed to open canvas", id, err);
          get().pushToast("Couldn't open canvas", "error");
        }
      },

      createCanvas: async (name) => {
        await get().saveActiveCanvas();
        const meta = await window.excali.canvases.create(name);
        await get().refreshList();
        const token = ++loadToken;
        try {
          const json = await window.excali.canvases.read(meta.id);
          if (token !== loadToken) return;
          set({
            activeCanvasId: meta.id,
            activeCanvasJson: json,
            lastActiveCanvasId: meta.id,
            ...freshCanvasState(meta.updatedAt, hashSceneJson(json)),
          });
          await get().refreshVersions();
        } catch (err) {
          console.error("Failed to open new canvas", err);
        }
      },

      importCanvas: async (name, json) => {
        await get().saveActiveCanvas();
        try {
          const meta = await window.excali.canvases.import(name, json);
          await get().refreshList();
          const fresh = await window.excali.canvases.read(meta.id);
          set({
            activeCanvasId: meta.id,
            activeCanvasJson: fresh,
            lastActiveCanvasId: meta.id,
            ...freshCanvasState(meta.updatedAt, hashSceneJson(fresh)),
          });
          await get().refreshVersions();
          get().pushToast(`Imported “${meta.name}”`, "success");
        } catch (err) {
          console.error("Import failed", err);
          get().pushToast("Couldn't import — not a valid Excalidraw file", "error");
        }
      },

      exportActiveCanvas: async (format) => {
        const { api, activeCanvasId, canvases } = get();
        if (!api || !activeCanvasId) return;
        const name = canvases.find((c) => c.id === activeCanvasId)?.name || "canvas";
        const elements = api.getSceneElements();
        const appState = api.getAppState();
        const files = api.getFiles();
        try {
          if (format === "excalidraw") {
            const json = serializeAsJSON(elements, appState, files, "local");
            await window.excali.dialog.export({
              data: json,
              defaultName: `${name}.excalidraw`,
              format,
            });
          } else if (format === "svg") {
            const svg = await exportToSvg({ elements, appState, files });
            const str = new XMLSerializer().serializeToString(svg);
            await window.excali.dialog.export({
              data: str,
              defaultName: `${name}.svg`,
              format,
            });
          } else {
            const blob = await exportToBlob({
              elements,
              appState,
              files,
              mimeType: "image/png",
            });
            const bytes = new Uint8Array(await blob.arrayBuffer());
            await window.excali.dialog.export({
              data: bytes,
              defaultName: `${name}.png`,
              format,
            });
          }
        } catch (err) {
          console.error("Export failed", err);
          get().pushToast("Export failed", "error");
        }
      },

      requestExport: async (id) => {
        if (get().activeCanvasId !== id) await get().openCanvas(id);
        get().openExportDialog();
      },

      duplicateCanvas: async (id) => {
        await get().saveActiveCanvas();
        try {
          const meta = await window.excali.canvases.duplicate(id);
          await get().refreshList();
          const json = await window.excali.canvases.read(meta.id);
          set({
            activeCanvasId: meta.id,
            activeCanvasJson: json,
            lastActiveCanvasId: meta.id,
            ...freshCanvasState(meta.updatedAt, hashSceneJson(json)),
          });
          await get().refreshVersions();
        } catch (err) {
          console.error("Duplicate failed", err);
          get().pushToast("Couldn't duplicate canvas", "error");
        }
      },

      togglePin: async (id) => {
        const current = get().canvases.find((c) => c.id === id);
        if (!current) return;
        try {
          await window.excali.canvases.setPinned(id, !current.isPinned);
          await get().refreshList(); // re-sorts pinned canvases to the top
        } catch (err) {
          console.error("Pin failed", err);
        }
      },

      renameCanvas: async (id, name) => {
        const meta = await window.excali.canvases.rename(id, name);
        set((s) => ({ canvases: s.canvases.map((c) => (c.id === id ? meta : c)) }));
      },

      setSearchQuery: (q) => set({ searchQuery: q }),

      deleteCanvas: async (id) => {
        await window.excali.canvases.remove(id);
        const wasActive = get().activeCanvasId === id;
        set((s) => ({
          canvases: s.canvases.filter((c) => c.id !== id),
          pendingDeleteId: null,
          ...(wasActive
            ? {
                activeCanvasId: null,
                activeCanvasJson: null,
                lastActiveCanvasId: null,
                versions: [],
                ...freshCanvasState(null, 0),
              }
            : {}),
        }));
      },

      saveActiveCanvas: async (opts) => {
        const { activeCanvasId, api } = get();
        if (!activeCanvasId || !api) return null;
        const notify = opts?.notify ?? false;
        const hashAtSave = get().currentSceneHash;
        set({ saving: true });
        let json: string;
        try {
          json = serializeAsJSON(
            api.getSceneElements(),
            api.getAppState(),
            api.getFiles(),
            "local",
          );
          const res = await window.excali.canvases.save(activeCanvasId, json);
          set((s) => ({
            saving: false,
            savedSceneHash: hashAtSave,
            isDirty: s.currentSceneHash !== hashAtSave,
            lastSavedAt: res.updatedAt,
            canvases: s.canvases.map((c) =>
              c.id === activeCanvasId
                ? { ...c, updatedAt: res.updatedAt, elementCount: res.elementCount }
                : c,
            ),
          }));
          if (notify) get().pushToast("Saved", "success");
        } catch (err) {
          console.error("Failed to save canvas", err);
          set({ saving: false });
          get().pushToast("Couldn't save — changes kept in the editor", "error");
          return null;
        }

        // Periodic auto-snapshot (only while actively editing).
        if (!opts?.skipAutoVersion) {
          const now = Date.now();
          if (
            get().activeCanvasId === activeCanvasId &&
            get().editedSinceVersion &&
            now - get().lastVersionAt >= AUTO_VERSION_INTERVAL_MS
          ) {
            try {
              await window.excali.versions.create(activeCanvasId, json, null);
              set({ editedSinceVersion: false, lastVersionAt: now });
              await get().refreshVersions();
            } catch (err) {
              console.error("Auto-version failed", err);
            }
          }
        }
        return json;
      },

      saveVersion: async (description) => {
        const json = await get().saveActiveCanvas({ skipAutoVersion: true });
        const id = get().activeCanvasId;
        if (!json || !id) return;
        try {
          await window.excali.versions.create(id, json, description.trim() || null);
          set({ editedSinceVersion: false, lastVersionAt: Date.now() });
          await get().refreshVersions();
          get().pushToast("Version saved", "success");
        } catch (err) {
          console.error("Failed to save version", err);
          get().pushToast("Couldn't save version", "error");
        }
      },

      previewVersion: async (versionId) => {
        const flushed = await get().saveActiveCanvas();
        try {
          const previewJson = await window.excali.versions.read(versionId);
          set({
            ...(flushed ? { activeCanvasJson: flushed } : {}),
            previewVersionId: versionId,
            previewJson,
            api: null, // the active editor unmounts during preview
          });
        } catch (err) {
          console.error("Failed to preview version", err);
          get().pushToast("Couldn't load version", "error");
        }
      },

      exitPreview: () => set({ previewVersionId: null, previewJson: null }),

      restoreVersion: async (versionId) => {
        const activeCanvasId = get().activeCanvasId;
        if (!activeCanvasId) return;
        await get().saveActiveCanvas(); // flush so the safety snapshot captures latest
        try {
          const { json } = await window.excali.versions.restore(versionId);
          await get().refreshList();
          const updatedAt =
            get().canvases.find((c) => c.id === activeCanvasId)?.updatedAt ?? null;
          set({
            activeCanvasJson: json,
            ...freshCanvasState(updatedAt, hashSceneJson(json)),
          });
          await get().refreshVersions();
          get().pushToast("Version restored", "success");
        } catch (err) {
          console.error("Failed to restore version", err);
          get().pushToast("Couldn't restore version", "error");
        }
      },

      deleteVersion: async (versionId) => {
        try {
          await window.excali.versions.remove(versionId);
          if (get().previewVersionId === versionId) {
            set({ previewVersionId: null, previewJson: null });
          }
          await get().refreshVersions();
        } catch (err) {
          console.error("Failed to delete version", err);
          get().pushToast("Couldn't delete version", "error");
        }
      },

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
      setSidebarWidth: (w) =>
        set({ sidebarWidth: Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, w)) }),
      openNewCanvasDialog: () => set({ newCanvasDialogOpen: true }),
      closeNewCanvasDialog: () => set({ newCanvasDialogOpen: false }),
      openSaveVersionDialog: () => {
        if (get().activeCanvasId) set({ saveVersionDialogOpen: true });
      },
      closeSaveVersionDialog: () => set({ saveVersionDialogOpen: false }),
      openExportDialog: () => {
        if (get().activeCanvasId) set({ exportDialogOpen: true });
      },
      closeExportDialog: () => set({ exportDialogOpen: false }),
      requestDelete: (id) => set({ pendingDeleteId: id }),
      cancelDelete: () => set({ pendingDeleteId: null }),

      pushToast: (message, type) => {
        const id = ++toastSeq;
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => get().dismissToast(id), 2600);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: "excali-ui",
      partialize: (s) => ({
        sidebarOpen: s.sidebarOpen,
        sidebarWidth: s.sidebarWidth,
        historyOpen: s.historyOpen,
        lastActiveCanvasId: s.lastActiveCanvasId,
      }),
    },
  ),
);
