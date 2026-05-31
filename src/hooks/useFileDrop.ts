import { useEffect } from "react";
import { useStore } from "../store/excaliStore";

/**
 * Window-level drop handler for importing .excalidraw files as NEW canvases.
 * Runs in the capture phase and only hijacks .excalidraw drops — image/other
 * drops fall through to Excalidraw's own handling untouched. (Without this,
 * dropping a .excalidraw would replace the current canvas's contents.)
 */
export function useFileDrop() {
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
        f.name.toLowerCase().endsWith(".excalidraw"),
      );
      if (files.length === 0) return; // not ours — let Excalidraw handle it
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        for (const file of files) {
          try {
            await useStore
              .getState()
              .importCanvas(file.name.replace(/\.excalidraw$/i, ""), await file.text());
          } catch (err) {
            console.error("Drop import failed", err);
          }
        }
      })();
    };

    window.addEventListener("dragover", onDragOver, true);
    window.addEventListener("drop", onDrop, true);
    return () => {
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("drop", onDrop, true);
    };
  }, []);
}
