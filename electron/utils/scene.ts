/** Count non-deleted elements in an .excalidraw JSON string. Throws on invalid JSON. */
export function countElements(json: string): number {
  const data = JSON.parse(json) as { elements?: { isDeleted?: boolean }[] };
  if (!Array.isArray(data.elements)) return 0;
  return data.elements.filter((el) => !el?.isDeleted).length;
}
