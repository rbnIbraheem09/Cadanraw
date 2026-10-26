import { createServer, type Server } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});
const num = { type: "number" };
const ids = { type: "array", items: { type: "string" }, maxItems: 500 };
const place = {
  x: num,
  y: num,
  width: { ...num, description: "Scene units; omit for the default size" },
  height: num,
};
const BLOCK_DATA = {
  type: "object",
  description:
    "Block content (all optional): title; text (note); items [{text,done}|string] (checklist); rows string[][] (table); month 'YYYY-MM' and events {'YYYY-MM-DD': text} (calendar); columns [{title,cards:[string]}] (kanban); url (link); boardId (board, from list_canvases); color slate|charcoal|sage|sand|rose|peach|lavender. Lists replace the existing list.",
};

/** MCP tools. `write` tools exist only when the user allowed editing. */
export const TOOLS: {
  name: string;
  description: string;
  inputSchema: object;
  write?: boolean;
  destructive?: boolean;
}[] = [
  {
    name: "list_canvases",
    description: "List canvases (IDs, names, folders) and the open canvas ID.",
    inputSchema: obj({}),
  },
  {
    name: "read_canvas",
    description:
      "Read a canvas's elements (including rich-block data in customData.cadanrawBlock) and files. Defaults to the open canvas, which includes unsaved edits, the visible scene bounds [x1,y1,x2,y2] and the user's selection. Embedded file data is summarized.",
    inputSchema: obj({ id: { type: "string" } }),
  },
  {
    name: "screenshot",
    description:
      "Capture what the canvas looks like, rich blocks included. By default zooms to fit everything (or `ids`) first; fit=false keeps the current view. Returns an image plus the scene bounds it shows.",
    inputSchema: obj({
      ids,
      fit: { type: "boolean" },
      maxSize: {
        ...num,
        description: "Longest image side in px (default 1568)",
      },
    }),
  },
  {
    name: "manage_canvas",
    description:
      "Create (and open), open, rename or delete a canvas. Deleted canvases go to the system trash.",
    inputSchema: obj(
      {
        action: { enum: ["create", "open", "rename", "delete"] },
        id: { type: "string" },
        name: { type: "string" },
      },
      ["action"],
    ),
    write: true,
    destructive: true,
  },
  {
    name: "add_elements",
    description:
      "Append Excalidraw element skeletons (rectangle, ellipse, diamond, text, line, arrow) to the open canvas. Returns the created IDs.",
    inputSchema: obj(
      { elements: { type: "array", items: { type: "object" }, maxItems: 200 } },
      ["elements"],
    ),
    write: true,
  },
  {
    name: "add_image",
    description:
      "Add an image from an http(s) URL, a data:image URL or a local file path (png, jpg, gif, webp, svg; max 20 MB). Defaults to the view center, at most 800 units wide.",
    inputSchema: obj({ source: { type: "string" }, ...place }, ["source"]),
    write: true,
  },
  {
    name: "add_block",
    description:
      "Add a Cadanraw block (note, checklist, table, calendar, link, kanban, file, board) with optional content and placement. Returns its ID.",
    inputSchema: obj(
      {
        kind: {
          enum: [
            "note",
            "checklist",
            "table",
            "calendar",
            "link",
            "kanban",
            "file",
            "board",
          ],
        },
        url: { type: "string" },
        data: BLOCK_DATA,
        ...place,
      },
      ["kind"],
    ),
    write: true,
  },
  {
    name: "update_elements",
    description:
      "Move, resize or restyle elements by ID, edit text, or patch rich-block content via `block`. Editable: x, y, width, height, angle, text, fontSize, fontFamily, textAlign, verticalAlign, strokeColor, backgroundColor, fillStyle, strokeWidth, strokeStyle, roughness, opacity.",
    inputSchema: obj(
      {
        updates: {
          type: "array",
          maxItems: 200,
          items: obj({ id: { type: "string" }, block: BLOCK_DATA }, ["id"]),
        },
      },
      ["updates"],
    ),
    write: true,
  },
  {
    name: "delete_elements",
    description:
      "Delete elements by ID from the open canvas (their labels go too). The user can undo.",
    inputSchema: obj({ ids }, ["ids"]),
    write: true,
    destructive: true,
  },
];

export interface AgentConnection {
  enabled: boolean;
  url: string;
  token: string;
  allowWrite: boolean;
}
export function createAgentServer(
  run: (method: string, args: Record<string, unknown>) => Promise<unknown>,
  version = "0.0.0",
) {
  let server: Server | null = null;
  let info: AgentConnection = {
    enabled: false,
    url: "",
    token: "",
    allowWrite: false,
  };
  async function stop() {
    const old = server;
    server = null;
    info = { enabled: false, url: "", token: "", allowWrite: false };
    if (old) {
      old.closeAllConnections();
      await new Promise<void>((resolve) => old.close(() => resolve()));
    }
    return info;
  }
  return {
    status: () => ({ ...info }),
    stop,
    async start(allowWrite = false) {
      await stop();
      const token = randomBytes(32).toString("hex");
      const next = createServer(async (req, res) => {
        const send = (status: number, body?: unknown) => {
          res.writeHead(status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(body === undefined ? undefined : JSON.stringify(body));
        };
        const expected = `Bearer ${token}`;
        const received = req.headers.authorization ?? "";
        if (
          Buffer.byteLength(received) !== Buffer.byteLength(expected) ||
          !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
        ) {
          send(401, { error: "Bearer token required" });
          return;
        }
        const host = req.headers.host;
        if (
          host !== new URL(info.url).host ||
          (req.headers.origin &&
            req.headers.origin !== new URL(info.url).origin)
        ) {
          send(403, { error: "Invalid origin or host" });
          return;
        }
        if (req.url !== "/mcp") {
          send(404);
          return;
        }
        if (req.method !== "POST") {
          res.setHeader("Allow", "POST");
          send(405);
          return;
        }
        let id: unknown = null;
        try {
          req.setEncoding("utf8");
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (Buffer.byteLength(body) > 16 * 1024 * 1024) {
              send(413);
              return;
            }
          }
          const rpc = JSON.parse(body);
          id = rpc.id ?? null;
          if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string")
            throw new Error("Invalid JSON-RPC request");
          if (rpc.id === undefined && rpc.method.startsWith("notifications/")) {
            send(202);
            return;
          }
          let result: unknown;
          switch (rpc.method) {
            case "initialize":
              result = {
                protocolVersion: "2025-03-26",
                capabilities: { tools: {} },
                serverInfo: { name: "cadanraw", version },
                instructions:
                  "Read and edit boards in the open Cadanraw app. Element tools act on the open canvas; use manage_canvas to create or switch canvases. Coordinates are scene units. Edits are undoable by the user. Writes require the user to enable editing in the app.",
              };
              break;
            case "ping":
              result = {};
              break;
            case "tools/list":
              result = {
                tools: TOOLS.filter((t) => info.allowWrite || !t.write).map(
                  ({ write, destructive, ...tool }) => ({
                    ...tool,
                    annotations: {
                      readOnlyHint: !write,
                      ...(write ? { destructiveHint: !!destructive } : {}),
                    },
                  }),
                ),
              };
              break;
            case "tools/call": {
              const name = rpc.params?.name;
              const tool = TOOLS.find((t) => t.name === name);
              if (!tool || (tool.write && !info.allowWrite)) {
                result = {
                  isError: true,
                  content: [
                    {
                      type: "text",
                      text: "Unknown tool or editing is disabled.",
                    },
                  ],
                };
                break;
              }
              try {
                const value = await run(name, rpc.params?.arguments ?? {});
                result = {
                  // Tools may return MCP content directly (e.g. screenshots).
                  content: (value as { mcpContent?: unknown })?.mcpContent ?? [
                    { type: "text", text: JSON.stringify(value) },
                  ],
                };
              } catch (e) {
                result = {
                  isError: true,
                  content: [
                    {
                      type: "text",
                      text: e instanceof Error ? e.message : "Tool failed",
                    },
                  ],
                };
              }
              break;
            }
            default:
              send(200, {
                jsonrpc: "2.0",
                id,
                error: { code: -32601, message: "Method not found" },
              });
              return;
          }
          send(200, { jsonrpc: "2.0", id, result });
        } catch (e) {
          send(200, {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32600,
              message: e instanceof Error ? e.message : "Invalid request",
            },
          });
        }
      });
      next.requestTimeout = 15000;
      try {
        await new Promise<void>((resolve, reject) => {
          next.once("error", reject);
          next.listen(0, "127.0.0.1", resolve);
        });
        const address = next.address();
        if (!address || typeof address === "string")
          throw new Error("Could not bind agent server");
        server = next;
        info = {
          enabled: true,
          url: `http://127.0.0.1:${address.port}/mcp`,
          token,
          allowWrite,
        };
        return { ...info };
      } catch (e) {
        next.close();
        throw e;
      }
    },
  };
}
