import Database from "better-sqlite3";
import { runMigrations } from "./schema";

/**
 * Opens (creating if needed) the Excali SQLite database, applies the standard
 * pragmas, and brings the schema up to date. Pure — takes an explicit path so
 * it works identically in the app (userData) and in tests (a temp dir).
 *
 * - WAL: better concurrency + crash resilience for a desktop write pattern.
 * - foreign_keys ON: enforces the versions→canvases ON DELETE CASCADE.
 */
export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
