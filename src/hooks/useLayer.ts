import { useEffect, useRef } from "react";
import { useUi } from "../store/ui";

const stack: { close: () => void }[] = [];

/** Close whatever was opened last. Returns false when nothing is open. */
export function closeTopLayer(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

/**
 * Register a dismissable surface (modal, palette, menu) while `open`. Escape
 * closes the top-most one, and the board underneath stops receiving keys.
 */
export function useLayer(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const entry = { close: () => close.current() };
    stack.push(entry);
    useUi.getState().pushLayer();
    return () => {
      stack.splice(stack.indexOf(entry), 1);
      useUi.getState().popLayer();
    };
  }, [open]);
}
