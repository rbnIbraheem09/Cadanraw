import { describe, expect, it } from "vitest";
import { findFreeSlot, type Box } from "../src/lib/layout";

const card = (x: number, y: number): Box => ({ x, y, width: 360, height: 250 });
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe("findFreeSlot", () => {
  it("starts an empty board at the origin", () => {
    expect(findFreeSlot([], 360, 250)).toEqual({ x: 0, y: 0 });
  });

  it("fills a row left to right, then wraps", () => {
    const placed: Box[] = [card(100, 50)];
    for (let i = 0; i < 5; i++) {
      const slot = findFreeSlot(placed, 360, 250);
      placed.push(card(slot.x, slot.y));
    }
    expect(placed.map((b) => [b.x, b.y])).toEqual([
      [100, 50],
      [492, 50],
      [884, 50],
      [1276, 50],
      [100, 332],
      [492, 332],
    ]);
  });

  it("never lands on something that's already there", () => {
    const existing: Box[] = [
      { x: 0, y: 0, width: 900, height: 600 },
      { x: 1000, y: 100, width: 300, height: 300 },
    ];
    const slot = findFreeSlot(existing, 360, 250);
    const placed = card(slot.x, slot.y);
    expect(existing.some((b) => overlaps(placed, b))).toBe(false);
  });
});
