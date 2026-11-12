import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import MoveCanvasDialog from "./components/dialogs/MoveCanvasDialog";
import AppLayout from "./components/layout/AppLayout";
import NewCanvasDialog from "./components/dialogs/NewCanvasDialog";
import SaveVersionDialog from "./components/dialogs/SaveVersionDialog";
import ExportDialog from "./components/dialogs/ExportDialog";
import ConfirmDeleteDialog from "./components/dialogs/ConfirmDeleteDialog";
import CommandPalette from "./components/commands/CommandPalette";
import Toast from "./components/ui/Toast";
import { useAutoSave } from "./hooks/useAutoSave";
import { useFileDrop } from "./hooks/useFileDrop";
import { openInsertMenu, useGlobalKeys } from "./hooks/useGlobalKeys";
import { runAgentTool } from "./lib/agent";
import { goHome } from "./lib/board-actions";
import { captureNote } from "./lib/capture";
import { themeById } from "./lib/themes";
import { useStore } from "./store/excaliStore";
import { startPrefs, usePrefs, type Prefs } from "./store/prefs";
import { useUi } from "./store/ui";

/** Tell the main process what it needs to know: the window colour (so there is
 *  no flash on launch), light or dark, and the quick-note shortcut. */
let lastSync = "";
function syncNative(p: Prefs) {
  const payload = {
    scheme: themeById(p.theme).scheme,
    background: getComputedStyle(document.documentElement).getPropertyValue("--chrome").trim(),
    capture: { enabled: p.captureEnabled, shortcut: p.captureShortcut },
  };
  const key = JSON.stringify(payload);
  if (key === lastSync) return;
  lastSync = key;
  void window.excali.prefs
    .sync(payload)
    .then((r) => useUi.setState({ captureRegistered: r.captureRegistered }))
    .catch(() => {});
}

export default function App() {
  const bootstrap = useStore((s) => s.bootstrap);
  const motion = usePrefs((s) => s.motion);

  // Requests from the main process: MCP tool calls, and quick notes.
  useEffect(
    () =>
      window.excali.agent.onRequest(async ({ id, method, args }) => {
        try {
          window.excali.agent.respond({
            id,
            result:
              method === "capture_note"
                ? await captureNote(String(args.text ?? ""))
                : await runAgentTool(method, args),
          });
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
  useGlobalKeys();

  useEffect(() => startPrefs(syncNative), []);

  // Load the board list (and reopen the last board, if that's the preference).
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // ⌘ shortcuts come from the native menu (see electron/main.ts) so they don't
  // clash with Excalidraw's own keys. Each menu item sends a named action here.
  useEffect(() => {
    return window.excali.onMenuAction((action) => {
      const s = useStore.getState();
      const ui = useUi.getState();
      switch (action) {
        case "new-canvas":
          s.openNewCanvasDialog();
          break;
        case "open-import":
          void s.importFiles();
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
        case "command-palette":
          if (ui.paletteOpen) ui.closePalette();
          else ui.openPalette();
          break;
        case "go-to-board":
          ui.openPalette("boards");
          break;
        case "settings":
          if (ui.settingsOpen) ui.closeSettings();
          else ui.openSettings();
          break;
        case "home":
          void goHome();
          break;
        case "focus-mode":
          ui.toggleFocusMode();
          break;
        case "insert":
          openInsertMenu();
          break;
      }
    });
  }, []);

  return (
    <MotionConfig
      reducedMotion={motion === "system" ? "user" : motion === "reduced" ? "always" : "never"}
    >
      <AppLayout />
      <MoveCanvasDialog />
      <NewCanvasDialog />
      <SaveVersionDialog />
      <ExportDialog />
      <ConfirmDeleteDialog />
      <CommandPalette />
      <Toast />
    </MotionConfig>
  );
}
