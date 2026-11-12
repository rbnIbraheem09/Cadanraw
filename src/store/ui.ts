import { create } from "zustand";
import type { RoomConnection } from "../lib/collaboration";

/** Where the insert menu opens, and where its block should land. */
export interface InsertMenuState {
  /** Screen position of the menu's corner. */
  x: number;
  y: number;
  /** Screen point to place the block at; omitted = centre of the view. */
  at?: { clientX: number; clientY: number };
  align?: "left" | "right";
}

interface UiState {
  paletteOpen: boolean;
  /** "boards" narrows the palette to a quick switcher. */
  paletteMode: "all" | "boards";
  settingsOpen: boolean;
  focusMode: boolean;
  insertMenu: InsertMenuState | null;
  /** How many dismissable layers (modals, palette, menus) are open. While any
   *  is, keystrokes stay out of the board underneath. */
  layers: number;
  /** The live collaboration session for the open board, if any. */
  room: RoomConnection | null;
  roomStatus: string;
  shareOpen: boolean;
  /** Whether the global quick-capture shortcut could be registered. */
  captureRegistered: boolean | null;

  setRoom: (room: RoomConnection | null) => void;
  setShareOpen: (open: boolean) => void;
  openPalette: (mode?: "all" | "boards") => void;
  closePalette: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleFocusMode: () => void;
  setInsertMenu: (menu: InsertMenuState | null) => void;
  pushLayer: () => void;
  popLayer: () => void;
}

export const useUi = create<UiState>()((set) => ({
  paletteOpen: false,
  paletteMode: "all",
  settingsOpen: false,
  focusMode: false,
  insertMenu: null,
  layers: 0,
  room: null,
  roomStatus: "",
  shareOpen: false,
  captureRegistered: null,

  setRoom: (room) => set({ room, roomStatus: "" }),
  setShareOpen: (shareOpen) => set({ shareOpen }),
  openPalette: (mode = "all") =>
    set({ paletteOpen: true, paletteMode: mode, insertMenu: null }),
  closePalette: () => set({ paletteOpen: false }),
  openSettings: () => set({ settingsOpen: true, paletteOpen: false, insertMenu: null }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  setInsertMenu: (insertMenu) => set({ insertMenu }),
  pushLayer: () => set((s) => ({ layers: s.layers + 1 })),
  popLayer: () => set((s) => ({ layers: Math.max(0, s.layers - 1) })),
}));
