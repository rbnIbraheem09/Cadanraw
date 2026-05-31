import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../electron/db/connection";
import {
  createCanvasService,
  type CanvasService,
} from "../electron/services/canvas-service";
import { ensureDataDirs, dbPath, canvasFilePath } from "../electron/utils/paths";

// Runs under plain Node (the host ABI build of better-sqlite3). Exercises the
// full metadata + filesystem round-trip against a throwaway temp directory.
describe("canvas-service", () => {
  let dataDir: string;
  let db: ReturnType<typeof openDatabase>;
  let service: CanvasService;
  let trashed: string[];

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "excali-test-"));
    ensureDataDirs(dataDir);
    db = openDatabase(dbPath(dataDir));
    trashed = [];
    service = createCanvasService({
      db,
      dataDir,
      trash: async (p) => {
        trashed.push(p);
        rmSync(p, { recursive: true, force: true });
      },
    });
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      /* may already be closed by a test */
    }
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("creates a canvas with a valid empty scene on disk", () => {
    const meta = service.create("My Canvas");
    expect(meta.id).toBeTruthy();
    expect(meta.name).toBe("My Canvas");
    expect(meta.elementCount).toBe(0);
    expect(existsSync(canvasFilePath(dataDir, meta.id))).toBe(true);

    const scene = JSON.parse(service.read(meta.id));
    expect(scene.type).toBe("excalidraw");
    expect(scene.elements).toEqual([]);
  });

  it("blank name falls back to 'Untitled'", () => {
    expect(service.create("   ").name).toBe("Untitled");
  });

  it("saves content and counts only non-deleted elements", () => {
    const meta = service.create("Doc");
    const scene = {
      type: "excalidraw",
      version: 2,
      source: "excali",
      elements: [
        { id: "a", isDeleted: false },
        { id: "b", isDeleted: false },
        { id: "c", isDeleted: true },
      ],
      appState: {},
      files: {},
    };
    const res = service.save(meta.id, JSON.stringify(scene));
    expect(res.elementCount).toBe(2);

    const reread = JSON.parse(service.read(meta.id));
    expect(reread.elements).toHaveLength(3); // deleted element still persisted
    expect(service.list().find((c) => c.id === meta.id)?.elementCount).toBe(2);
  });

  it("rejects invalid JSON without corrupting the existing file", () => {
    const meta = service.create("Doc");
    const before = service.read(meta.id);
    expect(() => service.save(meta.id, "{ not valid json")).toThrow();
    expect(service.read(meta.id)).toBe(before);
  });

  it("renames without changing content or updated_at", () => {
    const meta = service.create("Old");
    const renamed = service.rename(meta.id, "New");
    expect(renamed.name).toBe("New");
    expect(renamed.updatedAt).toBe(meta.updatedAt);
  });

  it("persists across a simulated app restart", () => {
    const meta = service.create("Persist");
    db.close();

    const db2 = openDatabase(dbPath(dataDir));
    const service2 = createCanvasService({
      db: db2,
      dataDir,
      trash: async () => {},
    });
    expect(service2.list().map((c) => c.id)).toContain(meta.id);
    db2.close();

    db = openDatabase(dbPath(dataDir)); // reopen so afterEach can close cleanly
  });

  it("removes a canvas: trashes the file and drops the row", async () => {
    const meta = service.create("Trash me");
    const file = canvasFilePath(dataDir, meta.id);
    await service.remove(meta.id);
    expect(service.list()).toHaveLength(0);
    expect(trashed).toContain(file);
    expect(existsSync(file)).toBe(false);
  });

  it("throws when reading or saving an unknown id", () => {
    expect(() => service.read("nope")).toThrow();
    expect(() => service.save("nope", "{}")).toThrow();
  });

  it("imports a valid .excalidraw file as a new canvas", () => {
    const json = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "x",
      elements: [{ id: "a", isDeleted: false }],
      appState: {},
      files: {},
    });
    const meta = service.importCanvas("Imported Doc", json);
    expect(meta.name).toBe("Imported Doc");
    expect(meta.elementCount).toBe(1);
    expect(JSON.parse(service.read(meta.id)).elements).toHaveLength(1);
  });

  it("rejects importing a non-Excalidraw file", () => {
    expect(() => service.importCanvas("Bad", '{"type":"excalidrawlib"}')).toThrow();
    expect(() => service.importCanvas("Bad", "not json")).toThrow();
    expect(service.list()).toHaveLength(0); // nothing created
  });

  it("duplicates a canvas with a (copy) suffix and identical content", () => {
    const c = service.create("Original");
    service.save(
      c.id,
      JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "x",
        elements: [{ id: "a", isDeleted: false }],
        appState: {},
        files: {},
      }),
    );
    const dup = service.duplicate(c.id);
    expect(dup.name).toBe("Original (copy)");
    expect(dup.id).not.toBe(c.id);
    expect(dup.elementCount).toBe(1);
    expect(JSON.parse(service.read(dup.id)).elements).toHaveLength(1);
    expect(service.list()).toHaveLength(2);
  });

  it("pins a canvas to the top of the list", () => {
    const a = service.create("A");
    service.create("B");
    expect(service.setPinned(a.id, true).isPinned).toBe(true);
    expect(service.list()[0].id).toBe(a.id);
    expect(service.setPinned(a.id, false).isPinned).toBe(false);
  });
});
