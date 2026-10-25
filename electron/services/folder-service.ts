import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { FolderMeta } from "../ipc-contract";
export function createFolderService(db: Database.Database) {
  const get = (id: string) => {
    const row = db
      .prepare(
        "SELECT id, name, parent_id AS parentId FROM folders WHERE id = ?",
      )
      .get(id) as FolderMeta | undefined;
    if (!row) throw new Error("Folder not found");
    return row;
  };
  const nameOf = (name: string) => {
    const value = name.trim();
    if (!value || value.length > 200)
      throw new Error("Use a folder name between 1 and 200 characters");
    return value;
  };
  return {
    list: () =>
      db
        .prepare(
          "SELECT id, name, parent_id AS parentId FROM folders ORDER BY name COLLATE NOCASE",
        )
        .all() as FolderMeta[],
    create(name: string, parentId: string | null): FolderMeta {
      const trimmed = nameOf(name);
      if (parentId) get(parentId);
      const id = randomUUID();
      db.prepare(
        "INSERT INTO folders (id, name, parent_id) VALUES (?, ?, ?)",
      ).run(id, trimmed, parentId);
      return get(id);
    },
    rename(id: string, name: string): FolderMeta {
      const trimmed = nameOf(name);
      get(id);
      db.prepare("UPDATE folders SET name = ? WHERE id = ?").run(trimmed, id);
      return get(id);
    },
    remove(id: string) {
      const folder = get(id);
      // Keep every board and subfolder: removing a folder promotes its contents.
      db.transaction(() => {
        db.prepare("UPDATE canvases SET folder_id = ? WHERE folder_id = ?").run(
          folder.parentId,
          id,
        );
        db.prepare("UPDATE folders SET parent_id = ? WHERE parent_id = ?").run(
          folder.parentId,
          id,
        );
        db.prepare("DELETE FROM folders WHERE id = ?").run(id);
      })();
    },
  };
}
