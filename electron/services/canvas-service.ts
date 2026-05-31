import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import type Database from "better-sqlite3";
import type { CanvasMeta, SaveResult } from "../ipc-contract";
import { canvasFilePath, versionsDir } from "../utils/paths";
import { writeFileAtomic } from "../utils/fs-atomic";
import { countElements } from "../utils/scene";

// Shape of a row in the `canvases` table (snake_case, as stored).
interface CanvasRow {
  id: string;
  name: string;
  file_path: string;
  element_count: number;
  created_at: string;
  updated_at: string;
  tags: string;
  is_pinned: number;
  sort_order: number;
}

function toMeta(row: CanvasRow): CanvasMeta {
  return {
    id: row.id,
    name: row.name,
    elementCount: row.element_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: safeParseTags(row.tags),
    isPinned: row.is_pinned === 1,
    sortOrder: row.sort_order,
  };
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// A fresh canvas is a valid, empty Excalidraw scene so read() never returns
// junk and the renderer can loadFromBlob it immediately.
const EMPTY_SCENE = JSON.stringify(
  { type: "excalidraw", version: 2, source: "cadanraw", elements: [], appState: {}, files: {} },
  null,
  2,
);

export interface CanvasServiceDeps {
  db: Database.Database;
  dataDir: string;
  /** Send a path to the OS trash (shell.trashItem in the app; a stub in tests). */
  trash: (absPath: string) => Promise<void>;
}

/**
 * Canvas metadata (SQLite) + content (.excalidraw files on disk), kept in sync.
 * Electron-free by design: all I/O goes through injected `db` / `dataDir` / `trash`,
 * so the full round-trip is unit-testable under plain Node.
 */
export function createCanvasService({ db, dataDir, trash }: CanvasServiceDeps) {
  const stmts = {
    list: db.prepare(
      `SELECT * FROM canvases ORDER BY is_pinned DESC, sort_order ASC, updated_at DESC`,
    ),
    get: db.prepare(`SELECT * FROM canvases WHERE id = ?`),
    insert: db.prepare(
      `INSERT INTO canvases (id, name, file_path, element_count)
       VALUES (@id, @name, @file_path, @element_count)`,
    ),
    touchSave: db.prepare(
      `UPDATE canvases SET updated_at = datetime('now'), element_count = @element_count WHERE id = @id`,
    ),
    rename: db.prepare(`UPDATE canvases SET name = @name WHERE id = @id`),
    setPinned: db.prepare(`UPDATE canvases SET is_pinned = @pinned WHERE id = @id`),
    del: db.prepare(`DELETE FROM canvases WHERE id = ?`),
  };

  function getRow(id: string): CanvasRow {
    const row = stmts.get.get(id) as CanvasRow | undefined;
    if (!row) throw new Error(`Canvas not found: ${id}`);
    return row;
  }

  return {
    list(): CanvasMeta[] {
      return (stmts.list.all() as CanvasRow[]).map(toMeta);
    },

    create(name: string): CanvasMeta {
      const id = randomUUID();
      const filePath = canvasFilePath(dataDir, id);
      writeFileAtomic(filePath, EMPTY_SCENE);
      stmts.insert.run({
        id,
        name: name.trim() || "Untitled",
        file_path: filePath,
        element_count: 0,
      });
      return toMeta(getRow(id));
    },

    importCanvas(name: string, json: string): CanvasMeta {
      let data: { type?: string };
      try {
        data = JSON.parse(json);
      } catch {
        throw new Error("File is not valid JSON");
      }
      if (data?.type !== "excalidraw") {
        throw new Error("Not an Excalidraw file");
      }
      const id = randomUUID();
      const filePath = canvasFilePath(dataDir, id);
      writeFileAtomic(filePath, json);
      stmts.insert.run({
        id,
        name: name.trim() || "Imported",
        file_path: filePath,
        element_count: countElements(json),
      });
      return toMeta(getRow(id));
    },

    read(id: string): string {
      const row = getRow(id);
      if (!existsSync(row.file_path)) {
        throw new Error(`Canvas file missing on disk: ${row.file_path}`);
      }
      return readFileSync(row.file_path, "utf8");
    },

    save(id: string, json: string): SaveResult {
      const row = getRow(id);
      // Count first — JSON.parse throws on garbage BEFORE we touch the file,
      // so a malformed payload can never overwrite a good canvas.
      const elementCount = countElements(json);
      writeFileAtomic(row.file_path, json);
      stmts.touchSave.run({ id, element_count: elementCount });
      return { updatedAt: getRow(id).updated_at, elementCount };
    },

    duplicate(id: string): CanvasMeta {
      const row = getRow(id);
      const json = existsSync(row.file_path)
        ? readFileSync(row.file_path, "utf8")
        : EMPTY_SCENE;
      const newId = randomUUID();
      const filePath = canvasFilePath(dataDir, newId);
      writeFileAtomic(filePath, json);
      stmts.insert.run({
        id: newId,
        name: `${row.name} (copy)`,
        file_path: filePath,
        element_count: row.element_count,
      });
      return toMeta(getRow(newId));
    },

    setPinned(id: string, pinned: boolean): CanvasMeta {
      getRow(id);
      stmts.setPinned.run({ id, pinned: pinned ? 1 : 0 });
      return toMeta(getRow(id));
    },

    rename(id: string, name: string): CanvasMeta {
      getRow(id);
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Canvas name cannot be empty");
      // Content + updated_at deliberately untouched — a rename isn't an edit.
      stmts.rename.run({ id, name: trimmed });
      return toMeta(getRow(id));
    },

    async remove(id: string): Promise<void> {
      const row = stmts.get.get(id) as CanvasRow | undefined;
      if (!row) return;
      // Trash the file + any version snapshots, then drop the row
      // (ON DELETE CASCADE clears version rows).
      if (existsSync(row.file_path)) await trash(row.file_path);
      const vDir = versionsDir(dataDir, id);
      if (existsSync(vDir)) await trash(vDir);
      stmts.del.run(id);
    },
  };
}

export type CanvasService = ReturnType<typeof createCanvasService>;
