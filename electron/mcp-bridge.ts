// Stdio MCP server for Claude Desktop, Claude Code and other local clients.
// Started as `ELECTRON_RUN_AS_NODE=1 <Cadanraw executable> mcp-bridge.js <userData>`,
// so no separate Node install is needed. It relays each JSON-RPC line to the
// running app's local HTTP endpoint, found through agent-connection.json.
import { readFileSync, unwatchFile, watchFile } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { listTools, SERVER_INSTRUCTIONS } from "./services/agent-server";

const connectionFile = join(process.argv[2] ?? ".", "agent-connection.json");
const OFFLINE =
  "Cadanraw isn't reachable. Open the Cadanraw app and turn on Connect → Agent access, then try again.";

const write = (message: unknown) =>
  process.stdout.write(JSON.stringify(message) + "\n");

async function relay(message: { id?: unknown; method?: string }) {
  const { url, token } = JSON.parse(readFileSync(connectionFile, "utf8"));
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(60000),
  });
  if (res.status === 202) return undefined;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Answers while the app is closed, so clients still connect and see the tools. */
function offline(message: { id?: unknown; method?: string; params?: any }) {
  const result =
    message.method === "initialize"
      ? {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "cadanraw", version: "offline" },
          instructions: SERVER_INSTRUCTIONS,
        }
      : message.method === "tools/list"
        ? { tools: listTools(true) }
        : message.method === "tools/call"
          ? { isError: true, content: [{ type: "text", text: OFFLINE }] }
          : message.method === "ping"
            ? {}
            : undefined;
  return result
    ? { jsonrpc: "2.0", id: message.id, result }
    : {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: OFFLINE },
      };
}

createInterface({ input: process.stdin })
  .on("line", async (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      write({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }
    let reply;
    try {
      reply = await relay(message);
    } catch {
      if (message.id === undefined) return; // notifications need no reply
      reply = offline(message);
    }
    if (reply === undefined) return;
    // The bridge announces tool changes when access is switched on or off.
    if (message.method === "initialize" && reply.result)
      reply.result.capabilities = { tools: { listChanged: true } };
    write(reply);
  })
  .on("close", () => {
    unwatchFile(connectionFile);
    process.exit(0);
  });

watchFile(connectionFile, { interval: 1500 }, () =>
  write({ jsonrpc: "2.0", method: "notifications/tools/list_changed" }),
);
