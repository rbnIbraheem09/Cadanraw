// Single source of truth for the renderer↔main canvas API *shape*.
// Type-only — no runtime imports — so preload.ts can use it without pulling in
// better-sqlite3 or any Node-only code. The renderer mirrors CanvasMeta/SaveResult
// in src/types/canvas.ts (the two live on opposite sides of the process boundary).

export interface CanvasMeta {
  id: string;
  name: string;
  elementCount: number;
  /** SQLite datetime('now') string, UTC: "YYYY-MM-DD HH:MM:SS". */
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isPinned: boolean;
  sortOrder: number;
}

export interface SaveResult {
  updatedAt: string;
  elementCount: number;
}

/** Exposed on window.excali.canvases via contextBridge. */
export interface CanvasApi {
  list(): Promise<CanvasMeta[]>;
  create(name: string): Promise<CanvasMeta>;
  /** Create a canvas from existing .excalidraw JSON (drag-drop / Open). */
  import(name: string, json: string): Promise<CanvasMeta>;
  duplicate(id: string): Promise<CanvasMeta>;
  setPinned(id: string, pinned: boolean): Promise<CanvasMeta>;
  /** Raw .excalidraw JSON string for the renderer to loadFromBlob. */
  read(id: string): Promise<string>;
  save(id: string, json: string): Promise<SaveResult>;
  rename(id: string, name: string): Promise<CanvasMeta>;
  remove(id: string): Promise<void>;
}

export type ExportFormat = "png" | "svg" | "excalidraw";

export interface ImportedFile {
  name: string;
  json: string;
}

/** Exposed on window.excali.dialog via contextBridge (native Save/Open). */
export interface DialogApi {
  export(opts: {
    data: string | Uint8Array;
    defaultName: string;
    format: ExportFormat;
  }): Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  openFile(): Promise<ImportedFile[]>;
}

export interface VersionMeta {
  id: string;
  canvasId: string;
  createdAt: string;
  /** User-provided label for a manual version; null for auto-snapshots. */
  description: string | null;
  elementCount: number;
  sizeBytes: number;
}

/** Exposed on window.excali.library via contextBridge. One shared .excalidrawlib. */
export interface LibraryApi {
  read(): Promise<string | null>;
  save(json: string): Promise<void>;
}

/** Exposed on window.excali.versions via contextBridge. */
export interface VersionApi {
  list(canvasId: string): Promise<VersionMeta[]>;
  create(canvasId: string, json: string, description: string | null): Promise<VersionMeta>;
  /** Read a snapshot's JSON without side effects (for read-only preview). */
  read(versionId: string): Promise<string>;
  /** Make a snapshot the current canvas (snapshots current first); returns the JSON. */
  restore(versionId: string): Promise<{ json: string }>;
  remove(versionId: string): Promise<void>;
}
