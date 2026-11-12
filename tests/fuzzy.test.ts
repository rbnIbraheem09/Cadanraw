import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyScore } from "../src/lib/fuzzy";

describe("fuzzyScore", () => {
  it("matches everything for an empty query", () => {
    expect(fuzzyScore("", "Launch plan")).toBeGreaterThan(0);
  });

  it("rejects text that doesn't contain the letters in order", () => {
    expect(fuzzyScore("xyz", "Launch plan")).toBe(0);
    expect(fuzzyScore("nalp", "plan")).toBe(0);
  });

  it("ranks exact over prefix over word start over scattered", () => {
    const exact = fuzzyScore("plan", "plan");
    const prefix = fuzzyScore("plan", "planner");
    const word = fuzzyScore("plan", "Launch plan");
    const inside = fuzzyScore("lan", "Launch plan");
    const scattered = fuzzyScore("lnp", "Launch plan");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(scattered);
    expect(scattered).toBeGreaterThan(0);
  });

  it("ignores case and spaces in the query", () => {
    expect(fuzzyScore("LAUNCH", "launch plan")).toBeGreaterThan(0);
    expect(fuzzyScore("l p", "Launch plan")).toBeGreaterThan(0);
  });
});

describe("fuzzyFilter", () => {
  const boards = ["Meeting notes", "Moodboard", "Mind map", "Launch plan"];

  it("keeps the original order without a query", () => {
    expect(fuzzyFilter("  ", boards, (b) => b)).toEqual(boards);
  });

  it("drops non-matches and puts the best match first", () => {
    expect(fuzzyFilter("mood", boards, (b) => b)).toEqual(["Moodboard"]);
    expect(fuzzyFilter("mi", boards, (b) => b)[0]).toBe("Mind map");
  });
});
