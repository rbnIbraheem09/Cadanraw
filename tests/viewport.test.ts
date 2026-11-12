import { beforeEach, describe, expect, it } from "vitest";
import { forgetView, loadView, saveView } from "../src/lib/viewport";

beforeEach(() => {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
});

describe("board view memory", () => {
  it("returns nothing for a board that was never opened", () => {
    expect(loadView("a")).toBeNull();
  });

  it("round-trips where you were looking", () => {
    saveView("a", { scrollX: 120.4, scrollY: -80.6, zoom: 0.75 });
    expect(loadView("a")).toEqual({ scrollX: 120, scrollY: -81, zoom: 0.75 });
  });

  it("ignores unusable values instead of saving them", () => {
    saveView("a", { scrollX: NaN, scrollY: 0, zoom: 1 });
    expect(loadView("a")).toBeNull();
  });

  it("survives corrupted storage", () => {
    localStorage.setItem("cadanraw-views", "{not json");
    expect(loadView("a")).toBeNull();
    saveView("a", { scrollX: 1, scrollY: 2, zoom: 1 });
    expect(loadView("a")).toEqual({ scrollX: 1, scrollY: 2, zoom: 1 });
  });

  it("forgets a deleted board and keeps only the most recent 200", () => {
    for (let i = 0; i < 205; i++) saveView(`b${i}`, { scrollX: i, scrollY: 0, zoom: 1 });
    expect(loadView("b0")).toBeNull();
    expect(loadView("b204")).not.toBeNull();
    forgetView("b204");
    expect(loadView("b204")).toBeNull();
  });
});
