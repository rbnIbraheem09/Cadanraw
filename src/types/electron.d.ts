// Mirror of the surface exposed by electron/preload.ts via contextBridge.
// Keep these two files in lockstep.
import type { CanvasMeta, SaveResult } from "./canvas";
import type { VersionMeta } from "./version";

export {};

declare global {
  interface Window {
    excali: {
      platform: NodeJS.Platform;
      getAppInfo: () => Promise<{
        name: string;
        version: string;
        electron: string;
        chrome: string;
      }>;
      canvases: {
        list(): Promise<CanvasMeta[]>;
        create(name: string): Promise<CanvasMeta>;
        import(name: string, json: string): Promise<CanvasMeta>;
        duplicate(id: string): Promise<CanvasMeta>;
        setPinned(id: string, pinned: boolean): Promise<CanvasMeta>;
        read(id: string): Promise<string>;
        save(id: string, json: string): Promise<SaveResult>;
        rename(id: string, name: string): Promise<CanvasMeta>;
        remove(id: string): Promise<void>;
      };
      versions: {
        list(canvasId: string): Promise<VersionMeta[]>;
        create(
          canvasId: string,
          json: string,
          description: string | null,
        ): Promise<VersionMeta>;
        read(versionId: string): Promise<string>;
        restore(versionId: string): Promise<{ json: string }>;
        remove(versionId: string): Promise<void>;
      };
      library: {
        read(): Promise<string | null>;
        save(json: string): Promise<void>;
      };
      dialog: {
        export(opts: {
          data: string | Uint8Array;
          defaultName: string;
          format: "png" | "svg" | "excalidraw";
        }): Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
        openFile(): Promise<{ name: string; json: string }[]>;
      };
      window: {
        minimize(): Promise<void>;
        toggleMaximize(): Promise<boolean>;
        close(): Promise<void>;
        isMaximized(): Promise<boolean>;
        onMaximizedChange(cb: (maximized: boolean) => void): () => void;
      };
      onMenuAction(cb: (action: string) => void): () => void;
    };
  }
}
