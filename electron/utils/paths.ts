import { mkdirSync } from "node:fs";
import { join } from "node:path";

// All paths are derived from a base data directory (app.getPath("userData") in
// the app, a temp dir in tests). Canvas files are keyed by id, NOT name, so
// renaming never touches the filesystem.

export const canvasesDir = (dataDir: string): string => join(dataDir, "canvases");

export const versionsRootDir = (dataDir: string): string =>
  join(dataDir, "versions");

export const versionsDir = (dataDir: string, canvasId: string): string =>
  join(versionsRootDir(dataDir), canvasId);

export const canvasFilePath = (dataDir: string, id: string): string =>
  join(canvasesDir(dataDir), `${id}.excalidraw`);

export const libraryPath = (dataDir: string): string =>
  join(dataDir, "library.excalidrawlib");

export const dbPath = (dataDir: string): string => join(dataDir, "excali.db");

/** Create the on-disk folder structure. Idempotent. */
export function ensureDataDirs(dataDir: string): void {
  mkdirSync(canvasesDir(dataDir), { recursive: true });
  mkdirSync(versionsRootDir(dataDir), { recursive: true });
}
