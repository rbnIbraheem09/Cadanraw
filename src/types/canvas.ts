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
}

export interface SaveResult {
  updatedAt: string;
  elementCount: number;
}
