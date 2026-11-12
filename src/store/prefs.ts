import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_THEME,
  accentColors,
  themeById,
  type AccentId,
  type GridId,
  type GridStrength,
  type ThemeId,
} from "../lib/themes";
import { configureSound } from "../lib/sound";

export const PREFS_KEY = "cadanraw-prefs";
export const DEFAULT_CAPTURE_SHORTCUT = "Control+Alt+Space";

export interface Prefs {
  theme: ThemeId;
  accent: AccentId;
  grid: GridId;
  gridStrength: GridStrength;
  sounds: boolean;
  volume: number;
  motion: "system" | "full" | "reduced";
  celebrations: boolean;
  /** What the app shows first: the library, or the board you had open. */
  launch: "home" | "last";
  captureEnabled: boolean;
  captureShortcut: string;
  /** Where a quick note lands: a dedicated Inbox board, or whatever is open. */
  captureTarget: "inbox" | "open";
  inboxBoardId: string | null;
}

interface PrefsState extends Prefs {
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
}

export const DEFAULT_PREFS: Prefs = {
  theme: DEFAULT_THEME,
  accent: "theme",
  grid: "dots",
  gridStrength: "normal",
  sounds: true,
  volume: 0.35,
  motion: "system",
  celebrations: true,
  launch: "home",
  captureEnabled: true,
  captureShortcut: DEFAULT_CAPTURE_SHORTCUT,
  captureTarget: "inbox",
  inboxBoardId: null,
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      set: (key, value) => set({ [key]: value } as Partial<PrefsState>),
    }),
    { name: PREFS_KEY },
  ),
);

/** Reflect preferences onto <html>, where the stylesheet reads them. */
export function applyPrefs(p: Prefs) {
  const root = document.documentElement;
  const theme = themeById(p.theme);
  root.dataset.theme = theme.id;
  root.dataset.scheme = theme.scheme;
  root.dataset.gridStrength = p.gridStrength;
  root.dataset.motion = p.motion;
  const accent = accentColors(p.accent, theme.scheme);
  if (accent) {
    root.style.setProperty("--accent", accent[0]);
    root.style.setProperty("--accent-ink", accent[1]);
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-ink");
  }
  configureSound(p.sounds, p.volume);
}

/** True when animation should be skipped (the setting, else the system). */
export function reducedMotion(): boolean {
  const { motion } = usePrefs.getState();
  if (motion !== "system") return motion === "reduced";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Apply now, keep applying, and stay in step with other windows (the capture
 *  panel shares this storage). Call once per window. */
export function startPrefs(onChange?: (p: Prefs) => void) {
  const run = (p: Prefs) => {
    applyPrefs(p);
    onChange?.(p);
  };
  run(usePrefs.getState());
  usePrefs.subscribe(run);
  window.addEventListener("storage", (e) => {
    if (e.key === PREFS_KEY) void usePrefs.persist.rehydrate();
  });
}
