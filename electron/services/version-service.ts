import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";
import type { VersionMeta } from "../ipc-contract";
import { versionsDir, canvasFilePath } from "../utils/paths";
import { writeFileAtomic } from "../utils/fs-atomic";
import { countElements } from "../utils/scene";

// Auto-snapshots (no description) are capped per canvas; manually-named versions
// (with a description) are kept forever.
const MAX_AUTO_VERSIONS = 25;

interface VersionRow {
  id: string;
  canvas_id: string;
  file_path: string;
  created_at: string;
  description: string | null;
  element_count: number | null;
  size_bytes: number | null;
}

function toMeta(r: VersionRow): VersionMeta {
  return {
    id: r.id,
    canvasId: r.canvas_id,
    createdAt: r.created_at,
    description: r.description,
    elementCount: r.element_count ?? 0,
    sizeBytes: r.size_bytes ?? 0,
  };
}

export interface VersionServiceDeps {
  db: Database.Database;
  dataDir: string;
  trash: (absPath: string) => Promise<void>;
}

/**
 * Timestamped .excalidraw snapshots per canvas, stored under versions/{canvasId}/.
 * Electron-free (DI'd) and unit-testable like the canvas service.
 */
export function createVersionService({ db, dataDir, trash }: VersionServiceDeps) {
  const stmts = {
    list: db.prepare(
      `SELECT * FROM versions WHERE canvas_id = ? ORDER BY created_at DESC, rowid DESC`,
    ),
    get: db.prepare(`SELECT * FROM versions WHERE id = ?`),
    insert: db.prepare(
      `INSERT INTO versions (id, canvas_id, file_path, description, element_count, size_bytes)
       VALUES (@id, @canvas_id, @file_path, @description, @element_count, @size_bytes)`,
    ),
    del: db.prepare(`DELETE FROM versions WHERE id = ?`),
    autos: db.prepare(
      `SELECT * FROM versions WHERE canvas_id = ? AND description IS NULL ORDER BY created_at DESC, rowid DESC`,
    ),
    updateCanvas: db.prepare(
      `UPDATE canvases SET updated_at = datetime('now'), element_count = @element_count WHERE id = @id`,
    ),
  };

  function pruneAutos(canvasId: string): void {
    const autos = stmts.autos.all(canvasId) as VersionRow[];
    for (const stale of autos.slice(MAX_AUTO_VERSIONS)) {
      stmts.del.run(stale.id);
      if (existsSync(stale.file_path)) void trash(stale.file_path).catch(() => {});
    }
  }

  function writeSnapshot(
    canvasId: string,
    json: string,
    description: string | null,
  ): VersionMeta {
    const elementCount = countElements(json); // throws on invalid JSON → no bad snapshot
    const id = randomUUID();
    const filePath = join(versionsDir(dataDir, canvasId), `${id}.excalidraw`);
    writeFileAtomic(filePath, json);
    stmts.insert.run({
      id,
      canvas_id: canvasId,
      file_path: filePath,
      description,
      element_count: elementCount,
      size_bytes: Buffer.byteLength(json, "utf8"),
    });
    pruneAutos(canvasId);
    return toMeta(stmts.get.get(id) as VersionRow);
  }

  return {
    list(canvasId: string): VersionMeta[] {
      return (stmts.list.all(canvasId) as VersionRow[]).map(toMeta);
    },

    create(canvasId: string, json: string, description: string | null): VersionMeta {
      return writeSnapshot(canvasId, json, description?.trim() || null);
    },

    read(versionId: string): string {
      const row = stmts.get.get(versionId) as VersionRow | undefined;
      if (!row) throw new Error(`Version not found: ${versionId}`);
      if (!existsSync(row.file_path)) {
        throw new Error(`Version file missing: ${row.file_path}`);
      }
      return readFileSync(row.file_path, "utf8");
    },

    restore(versionId: string): { json: string } {
      const row = stmts.get.get(versionId) as VersionRow | undefined;
      if (!row) throw new Error(`Version not found: ${versionId}`);
      if (!existsSync(row.file_path)) {
        throw new Error(`Version file missing: ${row.file_path}`);
      }
      const json = readFileSync(row.file_path, "utf8");

      // Non-destructive: snapshot the current canvas before overwriting it.
      const canvasPath = canvasFilePath(dataDir, row.canvas_id);
      if (existsSync(canvasPath)) {
        try {
          writeSnapshot(row.canvas_id, readFileSync(canvasPath, "utf8"), null);
        } catch {
          /* safety snapshot is best-effort */
        }
      }

      writeFileAtomic(canvasPath, json);
      stmts.updateCanvas.run({ id: row.canvas_id, element_count: countElements(json) });
      return { json };
    },

    async remove(versionId: string): Promise<void> {
      const row = stmts.get.get(versionId) as VersionRow | undefined;
      if (!row) return;
      stmts.del.run(versionId);
      if (existsSync(row.file_path)) await trash(row.file_path);
    },
  };
}

export type VersionService = ReturnType<typeof createVersionService>;
