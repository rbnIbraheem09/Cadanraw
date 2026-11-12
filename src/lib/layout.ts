export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlaps = (a: Box, b: Box, gap: number) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y;

/**
 * The first free cell for a `width`×`height` card, reading left to right in
 * rows of `columns` from the top-left of what's already there. Used to file
 * quick notes into a tidy grid instead of a pile.
 */
export function findFreeSlot(
  existing: readonly Box[],
  width: number,
  height: number,
  { columns = 4, gap = 32 }: { columns?: number; gap?: number } = {},
): { x: number; y: number } {
  if (!existing.length) return { x: 0, y: 0 };
  const left = Math.min(...existing.map((b) => b.x));
  const top = Math.min(...existing.map((b) => b.y));
  for (let cell = 0; cell < columns * 200; cell++) {
    const box = {
      x: left + (cell % columns) * (width + gap),
      y: top + Math.floor(cell / columns) * (height + gap),
      width,
      height,
    };
    if (!existing.some((b) => overlaps(box, b, gap / 2))) return { x: box.x, y: box.y };
  }
  return { x: left, y: Math.max(...existing.map((b) => b.y + b.height)) + gap };
}
