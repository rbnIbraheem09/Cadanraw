import type { IpcMain } from "electron";
import type { CanvasService } from "../services/canvas-service";

// Maps IPC channels to the canvas service. Handlers throw on error; the
// rejection surfaces in the renderer's invoke() call (Phase 5 adds toasts).
export function registerCanvasHandlers(
  ipcMain: IpcMain,
  service: CanvasService,
): void {
  ipcMain.handle("canvases:list", () => service.list());
  ipcMain.handle("canvases:create", (_e, name: string) => service.create(name));
  ipcMain.handle(
    "canvases:import",
    (_e, { name, json }: { name: string; json: string }) =>
      service.importCanvas(name, json),
  );
  ipcMain.handle("canvases:duplicate", (_e, id: string) => service.duplicate(id));
  ipcMain.handle(
    "canvases:set-pinned",
    (_e, { id, pinned }: { id: string; pinned: boolean }) =>
      service.setPinned(id, pinned),
  );
  ipcMain.handle("canvases:read", (_e, id: string) => service.read(id));
  ipcMain.handle(
    "canvases:save",
    (_e, { id, json }: { id: string; json: string }) => service.save(id, json),
  );
  ipcMain.handle(
    "canvases:rename",
    (_e, { id, name }: { id: string; name: string }) => service.rename(id, name),
  );
  ipcMain.handle("canvases:delete", (_e, id: string) => service.remove(id));
}
