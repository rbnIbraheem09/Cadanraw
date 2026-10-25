import { createServer, type Server } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";

export interface AgentConnection {
  enabled: boolean;
  url: string;
  token: string;
  allowWrite: boolean;
}
export function createAgentServer(
  run: (method: string, args: Record<string, unknown>) => Promise<unknown>,
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
            if (Buffer.byteLength(body) > 4 * 1024 * 1024) {
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
                serverInfo: { name: "cadanraw", version: "0.2.0" },
                instructions:
                  "Access the currently open Cadanraw app. Writes require the user to enable editing in the app.",
              };
              break;
            case "ping":
              result = {};
              break;
            case "tools/list":
              result = {
                tools: [
                  {
                    name: "list_canvases",
                    description: "List local canvas names and IDs.",
                    inputSchema: { type: "object", properties: {} },
                    annotations: { readOnlyHint: true },
                  },
                  {
                    name: "read_active_canvas",
                    description:
                      "Read live elements, app state and files from the active canvas, including unsaved changes and rich blocks.",
                    inputSchema: { type: "object", properties: {} },
                    annotations: { readOnlyHint: true },
                  },
                  ...(info.allowWrite
                    ? [
                        {
                          name: "add_elements",
                          description:
                            "Append Excalidraw element skeletons to the active canvas. Existing elements are preserved.",
                          inputSchema: {
                            type: "object",
                            properties: {
                              elements: {
                                type: "array",
                                items: { type: "object" },
                                maxItems: 200,
                              },
                            },
                            required: ["elements"],
                          },
                          annotations: {
                            readOnlyHint: false,
                            destructiveHint: false,
                          },
                        },
                        {
                          name: "add_block",
                          description:
                            "Add a note, checklist, table, calendar, link, kanban, file or board block at the center of the active canvas.",
                          inputSchema: {
                            type: "object",
                            properties: {
                              kind: {
                                enum: [
                                  "kanban",
                                  "file",
                                  "board",
                                  "note",
                                  "checklist",
                                  "table",
                                  "calendar",
                                  "link",
                                ],
                              },
                              url: { type: "string" },
                            },
                            required: ["kind"],
                          },
                          annotations: {
                            readOnlyHint: false,
                            destructiveHint: false,
                          },
                        },
                      ]
                    : []),
                ],
              };
              break;
            case "tools/call": {
              const name = rpc.params?.name;
              if (
                ![
                  "list_canvases",
                  "read_active_canvas",
                  ...(info.allowWrite ? ["add_elements", "add_block"] : []),
                ].includes(name)
              ) {
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
                result = {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify(
                        await run(name, rpc.params?.arguments ?? {}),
                      ),
                    },
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
