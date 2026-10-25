import type { FolderMeta } from "../types/canvas";
export function folderTrail(
  folders: FolderMeta[],
  id: string | null,
): FolderMeta[] {
  const trail: FolderMeta[] = [];
  const visited = new Set<string>();
  while (id && !visited.has(id)) {
    visited.add(id);
    const f = folders.find((item) => item.id === id);
    if (!f) break;
    trail.unshift(f);
    id = f.parentId;
  }
  return trail;
}
export function folderPath(folders: FolderMeta[], id: string | null) {
  return (
    folderTrail(folders, id)
      .map((f) => f.name)
      .join(" / ") || "Unfiled"
  );
}
