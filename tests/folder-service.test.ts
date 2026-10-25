import Database from "better-sqlite3";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../electron/db/connection";
import { createFolderService } from "../electron/services/folder-service";
import { createCanvasService } from "../electron/services/canvas-service";
import {
  ensureDataDirs,
  dbPath,
  canvasFilePath,
} from "../electron/utils/paths";
let root: string;
let db: ReturnType<typeof openDatabase>;
let folders: ReturnType<typeof createFolderService>;
let canvases: ReturnType<typeof createCanvasService>;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cadanraw-folders-"));
  ensureDataDirs(root);
  db = openDatabase(dbPath(root));
  folders = createFolderService(db);
  canvases = createCanvasService({ db, dataDir: root, trash: async () => {} });
});
afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});
describe("folder organization", () => {
  it("upgrades an existing v1 library without changing its boards or saved versions", () => {
    const legacyPath = join(root, "legacy.sqlite");
    const legacy = new Database(legacyPath);
    legacy.exec(`CREATE TABLE canvases(id TEXT PRIMARY KEY, name TEXT, file_path TEXT, element_count INTEGER, created_at TEXT, updated_at TEXT, thumbnail BLOB, tags TEXT, is_pinned INTEGER, sort_order INTEGER);
  CREATE TABLE versions(id TEXT PRIMARY KEY,canvas_id TEXT REFERENCES canvases(id),file_path TEXT,created_at TEXT,description TEXT,element_count INTEGER,size_bytes INTEGER);
  CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);
  INSERT INTO canvases VALUES('kept','Existing board','board.excalidraw',5,'before','before',NULL,'[]',1,0);
  INSERT INTO versions VALUES('checkpoint','kept','snapshot.excalidraw','before','Keep this',5,100);
  PRAGMA user_version=1;`);
    legacy.close();
    const upgraded = openDatabase(legacyPath);
    try {
      expect(upgraded.pragma("user_version", { simple: true })).toBe(2);
      expect(
        upgraded.prepare("SELECT name,is_pinned,folder_id FROM canvases").get(),
      ).toEqual({ name: "Existing board", is_pinned: 1, folder_id: null });
      expect(
        upgraded.prepare("SELECT description FROM versions").get(),
      ).toEqual({ description: "Keep this" });
      expect(
        createFolderService(upgraded).create("New folder", null).name,
      ).toBe("New folder");
    } finally {
      upgraded.close();
    }
  });
  it("moves boards into nested folders and preserves their content across reopening", () => {
    const project = folders.create("Project", null),
      child = folders.create("Research", project.id),
      board = canvases.create("Reference");
    const before = readFileSync(canvasFilePath(root, board.id), "utf8");
    expect(canvases.move(board.id, child.id).folderId).toBe(child.id);
    expect(readFileSync(canvasFilePath(root, board.id), "utf8")).toBe(before);
    const duplicate = canvases.duplicate(board.id);
    expect(duplicate.folderId).toBe(child.id);
    db.close();
    db = openDatabase(dbPath(root));
    folders = createFolderService(db);
    canvases = createCanvasService({
      db,
      dataDir: root,
      trash: async () => {},
    });
    expect(folders.list()).toHaveLength(2);
    expect(canvases.list().find((b) => b.id === board.id)?.folderId).toBe(
      child.id,
    );
  });
  it("promotes boards and subfolders on removal instead of deleting their files", () => {
    const parent = folders.create("Parent", null),
      child = folders.create("Child", parent.id),
      grandchild = folders.create("Grandchild", child.id),
      board = canvases.create("Keep me");
    canvases.move(board.id, child.id);
    folders.remove(child.id);
    expect(canvases.list().find((b) => b.id === board.id)?.folderId).toBe(
      parent.id,
    );
    expect(folders.list().find((f) => f.id === grandchild.id)?.parentId).toBe(
      parent.id,
    );
    expect(canvases.read(board.id)).toContain("excalidraw");
    folders.remove(parent.id);
    expect(canvases.list()[0].folderId).toBeNull();
    expect(folders.list()[0].parentId).toBeNull();
  });
  it("rejects missing destinations and invalid folder names without moving boards", () => {
    const board = canvases.create("Safe");
    expect(() => canvases.move(board.id, "missing")).toThrow();
    expect(canvases.list()[0].folderId).toBeNull();
    expect(() => folders.create(" ", null)).toThrow();
    expect(() => folders.create("Child", "missing")).toThrow();
  });
  it("builds bounded board previews without returning embedded file data", () => {
    const board = canvases.create("Preview");
    canvases.save(
      board.id,
      JSON.stringify({
        type: "excalidraw",
        elements: [
          {
            id: "card",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 360,
            height: 250,
            customData: { cadanrawBlock: { kind: "note", title: "Hello" } },
          },
          { id: "deleted", type: "rectangle", x: 1, y: 1, isDeleted: true },
        ],
        files: { secret: { dataURL: "large-data" } },
      }),
    );
    const preview = canvases.preview(board.id);
    expect(preview).toHaveLength(1);
    expect(preview[0]).toMatchObject({ text: "Hello", kind: "note" });
    expect(JSON.stringify(preview)).not.toContain("large-data");
  });
});
