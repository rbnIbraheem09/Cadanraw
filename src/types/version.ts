// Renderer-side mirror of the VersionMeta in electron/ipc-contract.ts.
export interface VersionMeta {
  id: string;
  canvasId: string;
  createdAt: string;
  /** User-provided label for a manual version; null for auto-snapshots. */
  description: string | null;
  elementCount: number;
  sizeBytes: number;
}
