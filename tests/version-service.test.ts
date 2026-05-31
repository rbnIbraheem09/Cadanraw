import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../electron/db/connection";
import {
  createCanvasService,
  type CanvasService,
} from "../electron/services/canvas-service";
import {
  createVersionService,
  type VersionService,
} from "../electron/services/version-service";
import { ensureDataDirs, dbPath, canvasFilePath } from "../electron/utils/paths";

const scene = (n: number) =>
  JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "test",
    elements: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, isDeleted: false })),
    appState: {},
    files: {},
  });

describe("version-service", () => {
  let dataDir: string;
  let db: ReturnType<typeof openDatabase>;
  let canvases: CanvasService;
  let versions: VersionService;
  let trashed: string[];

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "excali-vtest-"));
    ensureDataDirs(dataDir);
    db = openDatabase(dbPath(dataDir));
    trashed = [];
    const trash = async (p: string) => {
      trashed.push(p);
      rmSync(p, { recursive: true, force: true });
    };
    canvases = createCanvasService({ db, dataDir, trash });
    versions = createVersionService({ db, dataDir, trash });
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("creates and lists versions newest-first", () => {
    const c = canvases.create("C");
    const v1 = versions.create(c.id, scene(1), "first");
    const v2 = versions.create(c.id, scene(2), null);
    expect(v1.elementCount).toBe(1);
    const list = versions.list(c.id);
    expect(list.map((v) => v.id)).toEqual([v2.id, v1.id]);
    expect(list[0].description).toBeNull();
    expect(list[1].description).toBe("first");
  });

  it("reads a version's json without side effects", () => {
    const c = canvases.create("C");
    const v = versions.create(c.id, scene(3), "x");
    expect(JSON.parse(versions.read(v.id)).elements).toHaveLength(3);
    expect(versions.list(c.id)).toHaveLength(1); // read added nothing
  });

  it("restore overwrites the canvas and snapshots the previous state first", () => {
    const c = canvases.create("C");
    canvases.save(c.id, scene(5)); // current = 5 elements
    const v = versions.create(c.id, scene(2), "two");
    const countBefore = versions.list(c.id).length;

    const { json } = versions.restore(v.id);
    expect(JSON.parse(json).elements).toHaveLength(2);
    expect(
      JSON.parse(readFileSync(canvasFilePath(dataDir, c.id), "utf8")).elements,
    ).toHaveLength(2);
    // A safety auto-snapshot of the previous (5-element) state was added.
    expect(versions.list(c.id).length).toBe(countBefore + 1);
  });

  it("removes a version (row dropped + file trashed)", async () => {
    const c = canvases.create("C");
    const v = versions.create(c.id, scene(1), "x");
    await versions.remove(v.id);
    expect(versions.list(c.id)).toHaveLength(0);
    expect(trashed.length).toBeGreaterThanOrEqual(1);
  });

  it("prunes auto-snapshots past the cap but keeps labelled versions", () => {
    const c = canvases.create("C");
    const manual = versions.create(c.id, scene(1), "keep me");
    for (let i = 0; i < 30; i++) versions.create(c.id, scene(1), null);
    const list = versions.list(c.id);
    expect(list.filter((v) => v.description === null).length).toBeLessThanOrEqual(25);
    expect(list.some((v) => v.id === manual.id)).toBe(true);
  });

  it("cascades version cleanup when its canvas is deleted", async () => {
    const c = canvases.create("C");
    versions.create(c.id, scene(1), "x");
    await canvases.remove(c.id);
    expect(versions.list(c.id)).toHaveLength(0); // ON DELETE CASCADE
    expect(existsSync(canvasFilePath(dataDir, c.id))).toBe(false);
  });
});
