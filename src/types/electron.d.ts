// Mirror of the surface exposed by electron/preload.ts via contextBridge.
// Keep these two files in lockstep.
import type {
  CanvasMeta,
  SaveResult,
  FolderMeta,
  CanvasPreviewElement,
} from "./canvas";
import type { VersionMeta } from "./version";

export {};

declare global {
  interface Window {
    excali: {
      agent: {
        status(): Promise<{
          enabled: boolean;
          url: string;
          token: string;
          allowWrite: boolean;
          /** Local (stdio) MCP config entry; works across restarts. */
          bridge?: {
            command: string;
            args: string[];
            env: Record<string, string>;
          };
        }>;
        start(
          allowWrite: boolean,
        ): ReturnType<Window["excali"]["agent"]["status"]>;
        stop(): ReturnType<Window["excali"]["agent"]["status"]>;
        resetToken(): ReturnType<Window["excali"]["agent"]["status"]>;
        /** Adds Cadanraw to a local client; returns a command to copy if it can't. */
        setup(
          client: "claude-desktop" | "claude-code",
        ): Promise<{ done: boolean; command?: string }>;
        onRequest(
          cb: (request: {
            id: string;
            method: string;
            args: Record<string, unknown>;
          }) => void,
        ): () => void;
        respond(response: {
          id: string;
          result?: unknown;
          error?: string;
        }): void;
      };
      platform: NodeJS.Platform;
      getAppInfo: () => Promise<{
        name: string;
        version: string;
        electron: string;
        chrome: string;
      }>;
      getLinkMetadata: (
        url: string,
      ) => Promise<{ title: string; image: string | null } | null>;
      fetchImage: (
        url: string,
      ) => Promise<{ dataURL: string; mimeType: string } | null>;
      getOgImage: (url: string) => Promise<string | null>;
      checkForUpdates: () => Promise<{ version: string; url: string } | null>;
      openExternal: (url: string) => Promise<void>;
      folders: {
        list(): Promise<FolderMeta[]>;
        create(name: string, parentId: string | null): Promise<FolderMeta>;
        rename(id: string, name: string): Promise<FolderMeta>;
        remove(id: string): Promise<void>;
      };
      canvases: {
        preview(id: string): Promise<CanvasPreviewElement[]>;
        move(id: string, folderId: string | null): Promise<CanvasMeta>;
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
