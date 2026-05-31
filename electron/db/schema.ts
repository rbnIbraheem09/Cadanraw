import type Database from "better-sqlite3";

// Initial schema. Canvas *content* lives on disk as .excalidraw JSON; this DB
// holds only queryable metadata. element_count is denormalised here so the
// sidebar can show counts without reading every file.
const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS canvases (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  file_path     TEXT NOT NULL UNIQUE,
  element_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  thumbnail     BLOB,
  tags          TEXT NOT NULL DEFAULT '[]',
  is_pinned     INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS versions (
  id            TEXT PRIMARY KEY,
  canvas_id     TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  description   TEXT,
  element_count INTEGER,
  size_bytes    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_versions_canvas ON versions(canvas_id, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// Ordered list — index N upgrades the DB from user_version N to N+1.
// Append future migrations; never edit a shipped one.
const MIGRATIONS: string[] = [INITIAL_SCHEMA];

export function runMigrations(db: Database.Database): void {
  let current = db.pragma("user_version", { simple: true }) as number;
  while (current < MIGRATIONS.length) {
    db.exec(MIGRATIONS[current]);
    db.pragma(`user_version = ${current + 1}`);
    current++;
  }
}
