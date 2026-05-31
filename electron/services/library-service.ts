import { readFileSync, existsSync } from "node:fs";
import { libraryPath } from "../utils/paths";
import { writeFileAtomic } from "../utils/fs-atomic";

// One global .excalidrawlib shared across all canvases (matches Excalidraw's own
// model). Just file I/O — no DB. Electron-free for testability.
export interface LibraryServiceDeps {
  dataDir: string;
}

export function createLibraryService({ dataDir }: LibraryServiceDeps) {
  return {
    /** Raw .excalidrawlib JSON, or null if the user hasn't saved any library yet. */
    read(): string | null {
      const path = libraryPath(dataDir);
      return existsSync(path) ? readFileSync(path, "utf8") : null;
    },
    save(json: string): void {
      writeFileAtomic(libraryPath(dataDir), json);
    },
  };
}

export type LibraryService = ReturnType<typeof createLibraryService>;
