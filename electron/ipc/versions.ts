import type { IpcMain } from "electron";
import type { VersionService } from "../services/version-service";

export function registerVersionHandlers(
  ipcMain: IpcMain,
  service: VersionService,
): void {
  ipcMain.handle("versions:list", (_e, canvasId: string) => service.list(canvasId));
  ipcMain.handle(
    "versions:create",
    (
      _e,
      {
        canvasId,
        json,
        description,
      }: { canvasId: string; json: string; description: string | null },
    ) => service.create(canvasId, json, description),
  );
  ipcMain.handle("versions:read", (_e, versionId: string) => service.read(versionId));
  ipcMain.handle("versions:restore", (_e, versionId: string) =>
    service.restore(versionId),
  );
  ipcMain.handle("versions:delete", (_e, versionId: string) =>
    service.remove(versionId),
  );
}
