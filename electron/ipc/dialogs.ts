import { dialog, type BrowserWindow, type IpcMain } from "electron";
import { writeFile, readFile } from "node:fs/promises";
import { basename } from "node:path";

type ExportFormat = "png" | "svg" | "excalidraw";

const FILTERS: Record<ExportFormat, { name: string; extensions: string[] }> = {
  png: { name: "PNG Image", extensions: ["png"] },
  svg: { name: "SVG Image", extensions: ["svg"] },
  excalidraw: { name: "Excalidraw", extensions: ["excalidraw"] },
};

// Native Save / Open dialogs. The renderer produces the bytes (it has the DOM
// to render PNG/SVG); main handles the OS dialog + disk write/read.
export function registerDialogHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(
    "dialog:export",
    async (
      _e,
      {
        data,
        defaultName,
        format,
      }: { data: string | Uint8Array; defaultName: string; format: ExportFormat },
    ) => {
      const win = getWindow();
      const opts = { defaultPath: defaultName, filters: [FILTERS[format]] };
      const res = win
        ? await dialog.showSaveDialog(win, opts)
        : await dialog.showSaveDialog(opts);
      if (res.canceled || !res.filePath) return { ok: false, canceled: true };
      if (typeof data === "string") {
        await writeFile(res.filePath, data, "utf8");
      } else {
        await writeFile(res.filePath, Buffer.from(data));
      }
      return { ok: true, path: res.filePath };
    },
  );

  ipcMain.handle("dialog:open-file", async () => {
    const win = getWindow();
    const opts = {
      properties: ["openFile", "multiSelections"] as Array<
        "openFile" | "multiSelections"
      >,
      filters: [FILTERS.excalidraw],
    };
    const res = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (res.canceled) return [];
    return Promise.all(
      res.filePaths.map(async (p) => ({
        name: basename(p).replace(/\.excalidraw$/i, ""),
        json: await readFile(p, "utf8"),
      })),
    );
  });
}
