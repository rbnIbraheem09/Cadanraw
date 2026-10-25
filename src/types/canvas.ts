// Renderer-side mirror of electron/ipc-contract.ts (the two sit on opposite
// sides of the process boundary and can't share a module). Keep in sync.

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
  folderId: string | null;
}

export interface SaveResult {
  updatedAt: string;
  elementCount: number;
}

export interface FolderMeta {
  id: string;
  name: string;
  parentId: string | null;
}

export interface CanvasPreviewElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  background: string;
  text?: string;
  kind?: string;
  points?: number[][];
}
