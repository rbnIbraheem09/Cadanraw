import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLibraryService } from "../electron/services/library-service";

describe("library-service", () => {
  let dataDir: string;
  let lib: ReturnType<typeof createLibraryService>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "excali-lib-"));
    lib = createLibraryService({ dataDir });
  });

  afterEach(() => rmSync(dataDir, { recursive: true, force: true }));

  it("returns null when no library has been saved", () => {
    expect(lib.read()).toBeNull();
  });

  it("round-trips the library JSON", () => {
    const json = '{"type":"excalidrawlib","version":2,"libraryItems":[]}';
    lib.save(json);
    expect(lib.read()).toBe(json);
  });
});
