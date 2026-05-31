import { contextBridge, ipcRenderer } from "electron";
import type {
  CanvasApi,
  VersionApi,
  LibraryApi,
  DialogApi,
  FetchedImage,
  ReleaseInfo,
} from "./ipc-contract";

// The single, typed bridge the renderer is allowed to touch. One namespace per
// feature area. Keep in lockstep with src/types/electron.d.ts.

const canvases: CanvasApi = {
  list: () => ipcRenderer.invoke("canvases:list"),
  create: (name) => ipcRenderer.invoke("canvases:create", name),
  import: (name, json) => ipcRenderer.invoke("canvases:import", { name, json }),
  duplicate: (id) => ipcRenderer.invoke("canvases:duplicate", id),
  setPinned: (id, pinned) => ipcRenderer.invoke("canvases:set-pinned", { id, pinned }),
  read: (id) => ipcRenderer.invoke("canvases:read", id),
  save: (id, json) => ipcRenderer.invoke("canvases:save", { id, json }),
  rename: (id, name) => ipcRenderer.invoke("canvases:rename", { id, name }),
  remove: (id) => ipcRenderer.invoke("canvases:delete", id),
};

const versions: VersionApi = {
  list: (canvasId) => ipcRenderer.invoke("versions:list", canvasId),
  create: (canvasId, json, description) =>
    ipcRenderer.invoke("versions:create", { canvasId, json, description }),
  read: (versionId) => ipcRenderer.invoke("versions:read", versionId),
  restore: (versionId) => ipcRenderer.invoke("versions:restore", versionId),
  remove: (versionId) => ipcRenderer.invoke("versions:delete", versionId),
};

const library: LibraryApi = {
  read: () => ipcRenderer.invoke("library:read"),
  save: (json) => ipcRenderer.invoke("library:save", json),
};

const dialogApi: DialogApi = {
  export: (opts) => ipcRenderer.invoke("dialog:export", opts),
  openFile: () => ipcRenderer.invoke("dialog:open-file"),
};

const api = {
  platform: process.platform,
  getAppInfo: (): Promise<{
    name: string;
    version: string;
    electron: string;
    chrome: string;
  }> => ipcRenderer.invoke("app:get-info"),
  fetchImage: (url: string): Promise<FetchedImage | null> =>
    ipcRenderer.invoke("app:fetch-image", url),
  getOgImage: (url: string): Promise<string | null> =>
    ipcRenderer.invoke("app:get-og-image", url),
  checkForUpdates: (): Promise<ReleaseInfo | null> =>
    ipcRenderer.invoke("app:check-for-updates"),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("app:open-external", url),
  canvases,
  versions,
  library,
  dialog: dialogApi,
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: (): Promise<boolean> =>
      ipcRenderer.invoke("window:toggle-maximize"),
    close: (): Promise<void> => ipcRenderer.invoke("window:close"),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window:is-maximized"),
    onMaximizedChange: (cb: (maximized: boolean) => void): (() => void) => {
      const handler = (_e: unknown, maximized: boolean) => cb(maximized);
      ipcRenderer.on("window:maximized-change", handler);
      return () => ipcRenderer.removeListener("window:maximized-change", handler);
    },
  },
  /** Subscribe to native-menu actions (New, Open, Export…). Returns an unsubscribe. */
  onMenuAction: (cb: (action: string) => void): (() => void) => {
    const handler = (_e: unknown, action: string) => cb(action);
    ipcRenderer.on("menu:action", handler);
    return () => ipcRenderer.removeListener("menu:action", handler);
  },
};

contextBridge.exposeInMainWorld("excali", api);
