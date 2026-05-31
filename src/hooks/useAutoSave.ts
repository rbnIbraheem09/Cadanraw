import { useEffect } from "react";
import { useStore } from "../store/excaliStore";

/**
 * Debounced autosave: saves 3s after the last real edit, and immediately when
 * the window loses focus (cmd-tab / quit safety). `currentSceneHash` changes on
 * every content edit, so the timer resets per edit and fires once things settle.
 */
export function useAutoSave() {
  const isDirty = useStore((s) => s.isDirty);
  const sceneHash = useStore((s) => s.currentSceneHash);
  const save = useStore((s) => s.saveActiveCanvas);

  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => save(), 3000);
    return () => clearTimeout(timer);
  }, [isDirty, sceneHash, save]);

  useEffect(() => {
    const flushOnBlur = () => {
      if (useStore.getState().isDirty) useStore.getState().saveActiveCanvas();
    };
    window.addEventListener("blur", flushOnBlur);
    return () => window.removeEventListener("blur", flushOnBlur);
  }, []);
}
