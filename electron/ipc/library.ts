import type { IpcMain } from "electron";
import type { LibraryService } from "../services/library-service";

export function registerLibraryHandlers(
  ipcMain: IpcMain,
  service: LibraryService,
): void {
  ipcMain.handle("library:read", () => service.read());
  ipcMain.handle("library:save", (_e, json: string) => service.save(json));
}
