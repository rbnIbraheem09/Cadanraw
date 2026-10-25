import { normalizeBlockElements } from "./blocks";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  BinaryFiles,
  Collaborator,
  SocketId,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
export interface RoomConnection {
  base: string;
  id: string;
  key: string;
  viewKey?: string;
  adminKey?: string;
}
export function roomLink(room: RoomConnection, viewOnly = false) {
  return `${room.base}/#room=${room.id}&key=${viewOnly ? room.viewKey : room.key}`;
}
export async function createRoom(
  base: string,
  api: ExcalidrawImperativeAPI,
): Promise<RoomConnection> {
  const u = new URL(base);
  if (
    u.protocol !== "https:" &&
    !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))
  )
    throw new Error("Use an HTTPS address (or localhost for testing).");
  const clean = u.origin;
  const res = await fetch(`${clean}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      elements: api.getSceneElementsIncludingDeleted(),
      files: api.getFiles(),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Could not create room");
  return { base: clean, ...body };
}
// Version-based merging preserves independent edits and deletion tombstones.
export function connectRoom(
  room: RoomConnection,
  api: ExcalidrawImperativeAPI,
  username: string,
  status: (message: string, readOnly?: boolean) => void,
  pointer: { current: { x: number; y: number } | null },
) {
  const clientId = crypto.randomUUID();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController | null = null;
  let readOnly = !room.viewKey; // First exchange joins without writing before permissions are known.
  let hydrated = !!room.viewKey;
  let lastSignature = "";
  const sync = async () => {
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 15000);
    try {
      const elements = api.getSceneElementsIncludingDeleted();
      const signature = JSON.stringify(
        elements.map((e) => [e.id, e.version, e.versionNonce]),
      );
      const sendScene = !readOnly && signature !== lastSignature;
      const response = await fetch(`${room.base}/api/rooms/${room.id}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${room.key}`,
        },
        body: JSON.stringify({
          clientId,
          username,
          pointer: pointer.current,
          ...(sendScene ? { elements, files: api.getFiles() } : {}),
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection failed");
      if (stopped) return;
      readOnly = data.readOnly;
      const current = new Map(
        api.getSceneElementsIncludingDeleted().map((e) => [e.id, e]),
      );
      let changed = !hydrated;
      // Joining a room starts with the room scene. Subsequent polls merge versions.
      if (!hydrated) current.clear();
      for (const remote of normalizeBlockElements(
        data.elements as OrderedExcalidrawElement[],
      )) {
        const local = current.get(remote.id);
        if (
          !local ||
          remote.version > local.version ||
          (remote.version === local.version &&
            remote.versionNonce < local.versionNonce)
        ) {
          current.set(remote.id, remote);
          changed = true;
        }
      }
      const files = data.files as BinaryFiles;
      const freshFiles = Object.values(files).filter(
        (f) => !api.getFiles()[f.id],
      );
      if (freshFiles.length) api.addFiles(freshFiles);
      const collaborators = new Map<SocketId, Collaborator>();
      for (const [id, person] of Object.entries(data.participants) as [
        string,
        { username: string; pointer?: { x: number; y: number } },
      ][])
        if (id !== clientId)
          collaborators.set(id as SocketId, {
            username: person.username,
            pointer: person.pointer
              ? { ...person.pointer, tool: "pointer" }
              : undefined,
            color: { background: "#74bfa4", stroke: "#74bfa4" },
          });
      api.updateScene({
        ...(changed ? { elements: [...current.values()] } : {}),
        collaborators,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      if (!hydrated && current.size)
        api.scrollToContent([...current.values()], {
          fitToViewport: true,
          viewportZoomFactor: 0.85,
          animate: false,
        });
      hydrated = true;
      // Remember only what was submitted, so edits made during the request still send.
      if (sendScene) lastSignature = signature;
      status(
        `Live · ${collaborators.size + 1} ${collaborators.size ? "people" : "person"}${readOnly ? " · View only" : ""}`,
        readOnly,
      );
    } catch (e) {
      if (!stopped)
        status(
          e instanceof Error ? `Reconnecting · ${e.message}` : "Reconnecting…",
        );
    } finally {
      clearTimeout(timeout);
      if (!stopped) timer = setTimeout(sync, 650);
    }
  };
  void sync();
  return () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
    api.updateScene({ collaborators: new Map() });
  };
}

export async function closeRoom(room: RoomConnection) {
  const response = await fetch(`${room.base}/api/rooms/${room.id}/close`, {
    method: "POST",
    headers: { Authorization: `Bearer ${room.adminKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Could not end the shared session");
}
