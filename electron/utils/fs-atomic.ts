import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Writes a file atomically: write to a sibling temp file, then rename over the
 * target. rename(2) on the same filesystem is atomic, so a crash or full disk
 * mid-write leaves the previous good file intact rather than a truncated one.
 */
export function writeFileAtomic(filePath: string, data: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, data, "utf8");
  renameSync(tmp, filePath);
}
