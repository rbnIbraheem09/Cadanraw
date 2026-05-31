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
  const files = await window.excali.dialog.openFile();
  for (const f of files) {
    await useStore.getState().importCanvas(f.name, f.json);
  }
}

export default function App() {
  const bootstrap = useStore((s) => s.bootstrap);

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
      <NewCanvasDialog />
      <SaveVersionDialog />
      <ExportDialog />
      <ConfirmDeleteDialog />
      <Toast />
    </>
  );
}
