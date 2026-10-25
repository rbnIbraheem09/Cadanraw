import { BLOCK_KINDS } from "./lib/block-data";
import MoveCanvasDialog from "./components/dialogs/MoveCanvasDialog";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import { insertBlock, type BlockKind } from "./lib/blocks";
import { useEffect } from "react";
import AppLayout from "./components/layout/AppLayout";
import NewCanvasDialog from "./components/dialogs/NewCanvasDialog";
import SaveVersionDialog from "./components/dialogs/SaveVersionDialog";
import ExportDialog from "./components/dialogs/ExportDialog";
import ConfirmDeleteDialog from "./components/dialogs/ConfirmDeleteDialog";
import Toast from "./components/ui/Toast";
import { useAutoSave } from "./hooks/useAutoSave";
import { useFileDrop } from "./hooks/useFileDrop";
import { useStore } from "./store/excaliStore";

// Open .excalidraw file(s) via the native Open dialog and import each.
async function runImportDialog() {
  await useStore.getState().importFiles();
}

export default function App() {
  const bootstrap = useStore((s) => s.bootstrap);

  useEffect(
    () =>
      window.excali.agent.onRequest(async ({ id, method, args }) => {
        try {
          const s = useStore.getState();
          if (method === "list_canvases") {
            window.excali.agent.respond({ id, result: s.canvases });
            return;
          }
          const api = s.api;
          if (!api || s.previewVersionId || s.loading)
            throw new Error("Open an editable canvas first");
          let result: unknown;
          if (method === "read_active_canvas")
            result = {
              id: s.activeCanvasId,
              scene: JSON.parse(
                serializeAsJSON(
                  api.getSceneElements(),
                  api.getAppState(),
                  api.getFiles(),
                  "local",
                ),
              ),
            };
          else {
            if (method === "add_block") {
              if (!BLOCK_KINDS.includes(args.kind as BlockKind))
                throw new Error("Invalid block kind");
              if (
                args.kind === "link" &&
                !/^https?:\/\//.test(String(args.url))
              )
                throw new Error("A valid URL is required");
              insertBlock(api, args.kind as BlockKind, String(args.url ?? ""));
            } else if (method === "add_elements") {
              if (!Array.isArray(args.elements) || args.elements.length > 200)
                throw new Error("Supply at most 200 elements");
              const allowed = [
                "rectangle",
                "ellipse",
                "diamond",
                "text",
                "line",
                "arrow",
              ];
              if (
                args.elements.some(
                  (e) =>
                    !e ||
                    !allowed.includes(e.type) ||
                    !Number.isFinite(e.x) ||
                    !Number.isFinite(e.y),
                )
              )
                throw new Error(
                  "Use drawing/text element skeletons with finite x and y",
                );
              const elements = convertToExcalidrawElements(args.elements);
              api.updateScene({
                elements: [
                  ...api.getSceneElementsIncludingDeleted(),
                  ...elements,
                ],
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
              });
            } else throw new Error("Unknown command");
            result = { ok: true };
          }
          window.excali.agent.respond({ id, result });
        } catch (e) {
          window.excali.agent.respond({
            id,
            error: e instanceof Error ? e.message : "Request failed",
          });
        }
      }),
    [],
  );

  useAutoSave();
  useFileDrop();

  // Load the canvas list and reopen the last canvas on startup.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Shortcuts come from the native menu (see electron/main.ts) so they don't
  // clash with Excalidraw's own keys. Each menu item sends a named action here.
  useEffect(() => {
    return window.excali.onMenuAction((action) => {
      const s = useStore.getState();
      switch (action) {
        case "new-canvas":
          s.openNewCanvasDialog();
          break;
        case "open-import":
          void runImportDialog();
          break;
        case "save":
          void s.saveActiveCanvas({ notify: true });
          break;
        case "save-version":
          s.openSaveVersionDialog();
          break;
        case "export":
          s.openExportDialog();
          break;
        case "toggle-sidebar":
          s.toggleSidebar();
          break;
      }
    });
  }, []);

  return (
    <>
      <AppLayout />
      <MoveCanvasDialog />
      <NewCanvasDialog />
      <SaveVersionDialog />
      <ExportDialog />
      <ConfirmDeleteDialog />
      <Toast />
    </>
  );
}
