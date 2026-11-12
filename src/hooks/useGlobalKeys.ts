import { useEffect } from "react";
import { closeTopLayer } from "./useLayer";
import { useStore } from "../store/excaliStore";
import { useUi } from "../store/ui";
import { canvasPointer } from "../lib/canvas-pointer";
import { sfx } from "../lib/sound";

const isTyping = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');

/** Open the insert menu under the pointer (or mid-board when it's elsewhere). */
export function openInsertMenu() {
  const s = useStore.getState();
  if (!s.api || s.homeOpen || s.previewVersionId) return false;
  const at = canvasPointer.point;
  sfx.open();
  useUi.getState().setInsertMenu(
    at
      ? { x: at.clientX + 6, y: at.clientY + 6, at }
      : { x: innerWidth / 2 - 146, y: Math.max(90, innerHeight / 2 - 220) },
  );
  return true;
}

/**
 * Page-owned keys. Shortcuts with ⌘ belong to the native menu (electron/main.ts);
 * this handles Escape, the "/" insert menu, and keeps keystrokes out of the
 * board while something is open on top of it.
 *
 * It listens on <html> in the bubble phase: after React's own handlers (so
 * fields and menus get their keys first) and before Excalidraw's, which sits
 * on `document`.
 */
export function useGlobalKeys() {
  useEffect(() => {
    const root = document.documentElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const ui = useUi.getState();

      if (e.key === "Escape") {
        if (closeTopLayer()) {
          e.preventDefault();
          e.stopPropagation();
        } else if (ui.settingsOpen) {
          ui.closeSettings();
          e.stopPropagation();
        }
        return; // otherwise it's the board's (cancel a shape, deselect)
      }

      if (ui.layers > 0 || ui.settingsOpen) {
        e.stopPropagation();
        return;
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        if (openInsertMenu()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, []);
}
