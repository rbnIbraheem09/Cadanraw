import { getLinkMetadata } from "./utils/link-metadata";
/** Standalone self-hosted relay. Run after npm run build:electron and build:renderer. */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomBytes } from "node:crypto";
import {
  readFileSync,
  existsSync,
  statSync,
  mkdirSync,
  readdirSync,
  renameSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import * as path from "node:path";

type Element = {
  id: string;
  version: number;
  versionNonce: number;
  [key: string]: unknown;
};
interface Participant {
  username: string;
  pointer?: { x: number; y: number };
  seen: number;
}
interface Room {
  adminKey: string;
  key: string;
  viewKey: string;
  elements: Element[];
  files: Record<string, unknown>;
  participants: Map<string, Participant>;
  touched: number;
}
export function mergeElements(
  current: Element[],
  incoming: Element[],
): Element[] {
  const merged = new Map(current.map((e) => [e.id, e]));
  for (const e of incoming) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !Number.isFinite(e.version) ||
      !Number.isFinite(e.versionNonce)
    )
      throw new Error("Invalid element");
    const old = merged.get(e.id);
    if (
      !old ||
      e.version > old.version ||
      (e.version === old.version && e.versionNonce < old.versionNonce)
    )
      merged.set(e.id, e);
  }
  return [...merged.values()];
}
export function createCollaborationServer({
  distDir = path.resolve(__dirname, "../dist"),
  allowedOrigin = "",
  dataDir = "",
} = {}) {
  const rooms = new Map<string, Room>();
  const persist = (id: string, room: Room) => {
    if (!dataDir) return;
    const file = path.join(dataDir, `${id}.json`);
    writeFileSync(
      file + ".tmp",
      JSON.stringify({ ...room, participants: undefined }),
      { mode: 0o600 },
    );
    renameSync(file + ".tmp", file);
  };
  const remove = (id: string) => {
    rooms.delete(id);
    if (dataDir) {
      const file = path.join(dataDir, `${id}.json`);
      if (existsSync(file)) unlinkSync(file);
    }
  };
  if (dataDir) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    for (const file of readdirSync(dataDir).filter((f) =>
      /^[a-f0-9]{32}\.json$/.test(f),
    )) {
      try {
        const room = JSON.parse(readFileSync(path.join(dataDir, file), "utf8"));
        rooms.set(file.slice(0, -5), { ...room, participants: new Map() });
      } catch {
        console.warn(`Could not load collaboration room ${file}`);
      }
    }
  }
  const json = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  const readBody = async (req: IncomingMessage) => {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const c of req) {
      size += c.length;
      if (size > 32 * 1024 * 1024) throw new Error("Request exceeds 32 MB");
      chunks.push(c);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  };
  const server = createServer(async (req, res) => {
    // Desktop file origins are null. Browser guests use the relay's own origin.
    const origin = req.headers.origin;
    if (origin) {
      let own = false;
      try {
        own = new URL(origin).host === req.headers.host;
      } catch {
        /* null or malformed origin */
      }
      if (
        origin !== "null" &&
        origin !== allowedOrigin &&
        !own &&
        !/^http:\/\/localhost:5173$/.test(origin)
      ) {
        json(res, 403, { error: "Origin not allowed" });
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/api/rooms" && req.method === "POST") {
        for (const [id, room] of rooms)
          if (Date.now() - room.touched > 24 * 60 * 60 * 1000) remove(id);
        if (rooms.size >= 100) {
          json(res, 503, { error: "Server room limit reached" });
          return;
        }
        const body = await readBody(req);
        const id = randomBytes(16).toString("hex");
        const key = randomBytes(32).toString("hex");
        const viewKey = randomBytes(32).toString("hex");
        const adminKey = randomBytes(32).toString("hex");
        if (!Array.isArray(body.elements) || body.elements.length > 10000)
          throw new Error("Supply at most 10000 elements");
        const elements = mergeElements([], body.elements);
        const files = body.files ?? {};
        const room: Room = {
          adminKey,
          key,
          viewKey,
          elements,
          files,
          participants: new Map(),
          touched: Date.now(),
        };
        persist(id, room);
        rooms.set(id, room);
        json(res, 201, { id, key, viewKey, adminKey });
        return;
      }
      const metadata = url.pathname.match(
        /^\/api\/rooms\/([a-f0-9]{32})\/link-metadata$/,
      );
      if (metadata && req.method === "POST") {
        const room = rooms.get(metadata[1]);
        if (!room || req.headers.authorization !== `Bearer ${room.key}`) {
          json(res, 404, { error: "Room unavailable" });
          return;
        }
        const body = await readBody(req);
        if (typeof body.url !== "string" || body.url.length > 8192)
          throw new Error("Invalid link");
        json(res, 200, await getLinkMetadata(body.url, fetch, true));
        return;
      }
      const close = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{32})\/close$/);
      if (close && req.method === "POST") {
        const room = rooms.get(close[1]);
        if (!room || req.headers.authorization !== `Bearer ${room.adminKey}`) {
          json(res, 404, { error: "Room unavailable" });
          return;
        }
        remove(close[1]);
        json(res, 200, { ok: true });
        return;
      }
      const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{32})\/sync$/);
      if (match && req.method === "POST") {
        const room = rooms.get(match[1]);
        const key = req.headers.authorization?.replace(/^Bearer /, "");
        if (!room || (key !== room.key && key !== room.viewKey)) {
          json(res, 404, { error: "Room unavailable or link revoked" });
          return;
        }
        const body = await readBody(req);
        if (key === room.key && body.elements) {
          if (!Array.isArray(body.elements) || body.elements.length > 10000)
            throw new Error("Too many elements");
          const merged = mergeElements(room.elements, body.elements);
          const files = { ...room.files, ...body.files };
          if (
            Buffer.byteLength(JSON.stringify({ elements: merged, files })) >
            64 * 1024 * 1024
          )
            throw new Error("Room exceeds 64 MB");
          const next = {
            ...room,
            elements: merged,
            files,
            touched: Date.now(),
          };
          persist(match[1], next);
          room.elements = merged;
          room.files = files;
        }
        const now = Date.now();
        room.touched = now;
        if (typeof body.clientId === "string" && body.clientId.length <= 100) {
          const pointer = body.pointer;
          room.participants.set(body.clientId, {
            username: String(body.username || "Guest").slice(0, 40),
            ...(pointer &&
            Number.isFinite(pointer.x) &&
            Number.isFinite(pointer.y)
              ? { pointer: { x: pointer.x, y: pointer.y } }
              : {}),
            seen: now,
          });
        }
        for (const [id, person] of room.participants)
          if (now - person.seen > 10000) room.participants.delete(id);
        json(res, 200, {
          elements: room.elements,
          files: room.files,
          participants: Object.fromEntries(room.participants),
          readOnly: key === room.viewKey,
        });
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        json(res, 404, { error: "Not found" });
        return;
      }
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end();
        return;
      }
      const target = path.resolve(
        distDir,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
      if (
        !target.startsWith(distDir + path.sep) ||
        !existsSync(target) ||
        !statSync(target).isFile()
      ) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      };
      res.writeHead(200, {
        "Content-Type":
          mime[path.extname(target)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      });
      res.end(readFileSync(target));
    } catch (e) {
      json(res, 400, {
        error: e instanceof Error ? e.message : "Invalid request",
      });
    }
  });
  server.requestTimeout = 20000;
  return server;
}
if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  createCollaborationServer({
    allowedOrigin: process.env.ALLOWED_ORIGIN,
    dataDir: path.resolve(
      process.env.CADANRAW_COLLAB_DATA_DIR || "cadanraw-collab-data",
    ),
  }).listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Cadanraw collaboration listening on port ${port}`),
  );
}
