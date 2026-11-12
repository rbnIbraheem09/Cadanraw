// The palettes themselves live in src/styles/tokens.css. This file only names
// them, so the picker, the command palette and the main process agree.

export const THEMES = [
  { id: "slate", name: "Slate", scheme: "dark", blurb: "Cool and calm. The original." },
  { id: "midnight", name: "Midnight", scheme: "dark", blurb: "Near-black with a violet spark." },
  { id: "ember", name: "Ember", scheme: "dark", blurb: "Warm charcoal and amber." },
  { id: "forest", name: "Forest", scheme: "dark", blurb: "Deep green, soft mint." },
  { id: "plum", name: "Plum", scheme: "dark", blurb: "Aubergine with a rose accent." },
  { id: "paper", name: "Paper", scheme: "light", blurb: "Warm daylight, ink on cream." },
  { id: "glacier", name: "Glacier", scheme: "light", blurb: "Crisp, cool and bright." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Scheme = "dark" | "light";

export const DEFAULT_THEME: ThemeId = "slate";

export function themeById(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Board background patterns. All of them are drawn from the same scroll/zoom
 *  variables as the dots (see styles/canvas.css). */
export const GRIDS = [
  { id: "dots", name: "Dots", blurb: "Quiet reference points" },
  { id: "lines", name: "Grid", blurb: "Ruled for structure" },
  { id: "cross", name: "Crosses", blurb: "Marks, not lines" },
  { id: "iso", name: "Isometric", blurb: "For sketching in 3D" },
  { id: "none", name: "Blank", blurb: "Nothing but space" },
] as const;

export type GridId = (typeof GRIDS)[number]["id"];
export type GridStrength = "subtle" | "normal" | "bold";

/** Optional accent override. Each has a pastel for dark themes and a deeper
 *  ink for light ones, with a readable text colour to sit on top. */
export const ACCENTS = [
  { id: "blue", name: "Blue", dark: ["#8fbcff", "#0e1f3a"], light: ["#2c6cdb", "#f4f8ff"] },
  { id: "violet", name: "Violet", dark: ["#b3a4ff", "#1a1238"], light: ["#6a4fd6", "#f6f3ff"] },
  { id: "pink", name: "Pink", dark: ["#f2a3c9", "#3a1028"], light: ["#c93f85", "#fff4f9"] },
  { id: "coral", name: "Coral", dark: ["#f5a08c", "#3a140c"], light: ["#c94a34", "#fff5f2"] },
  { id: "amber", name: "Amber", dark: ["#f2c06b", "#33230a"], light: ["#b27412", "#fffaf0"] },
  { id: "green", name: "Green", dark: ["#8fd9a8", "#0d2a18"], light: ["#2b8a57", "#f2fbf5"] },
  { id: "teal", name: "Teal", dark: ["#7fd6d0", "#0b2b29"], light: ["#1f8a85", "#f0fbfa"] },
] as const;

export type AccentId = "theme" | (typeof ACCENTS)[number]["id"];

/** [accent, text-on-accent] for an override, or null to use the theme's own. */
export function accentColors(id: AccentId, scheme: Scheme): readonly [string, string] | null {
  const accent = ACCENTS.find((a) => a.id === id);
  return accent ? (accent[scheme] as readonly [string, string]) : null;
}
