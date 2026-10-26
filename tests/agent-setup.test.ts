import { afterEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentSetup } from "../electron/services/agent-setup";
import { createAgentServer } from "../electron/services/agent-server";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function setup() {
  const root = mkdtempSync(join(tmpdir(), "cadanraw-setup-"));
  dirs.push(root);
  const paths = {
    userData: join(root, "Cadanraw"),
    appData: root,
    home: root,
    execPath: "/Applications/Cadanraw.app/Contents/MacOS/Cadanraw",
    bridgePath:
      "/Applications/Cadanraw.app/Contents/Resources/app.asar/dist-electron/mcp-bridge.js",
    platform: "darwin" as const,
  };
  mkdirSync(paths.userData);
  return { root, paths, agent: createAgentSetup(paths) };
}

describe("agent setup", () => {
  it("adds Cadanraw to Claude Desktop without touching other settings", () => {
    const { root, agent } = setup();
    expect(() => agent.addToClaudeDesktop()).toThrow(/isn't installed/);
    const file = join(root, "Claude", "claude_desktop_config.json");
    mkdirSync(join(root, "Claude"));
    writeFileSync(
      file,
      JSON.stringify({
        mcpServers: { vault: { command: "vault-mcp", args: ["stdio"] } },
        preferences: { theme: "dark" },
      }),
    );
    agent.addToClaudeDesktop();
    agent.addToClaudeDesktop(); // idempotent
    const config = JSON.parse(readFileSync(file, "utf8"));
    expect(config.preferences).toEqual({ theme: "dark" });
    expect(config.mcpServers.vault.command).toBe("vault-mcp");
    expect(config.mcpServers.cadanraw).toEqual({
      command: "/Applications/Cadanraw.app/Contents/MacOS/Cadanraw",
      args: [
        "/Applications/Cadanraw.app/Contents/Resources/app.asar/dist-electron/mcp-bridge.js",
        join(root, "Cadanraw"),
      ],
      env: { ELECTRON_RUN_AS_NODE: "1" },
    });
    writeFileSync(file, "{ not json");
    expect(() => agent.addToClaudeDesktop()).toThrow(/left unchanged/);
    expect(readFileSync(file, "utf8")).toBe("{ not json");
  });

  it("publishes the running endpoint privately and clears it", () => {
    const { paths, agent } = setup();
    const file = join(paths.userData, "agent-connection.json");
    agent.publish({
      url: "http://127.0.0.1:1/mcp",
      token: "t",
      allowWrite: true,
    });
    expect(JSON.parse(readFileSync(file, "utf8")).token).toBe("t");
    if (process.platform !== "win32")
      expect(statSync(file).mode & 0o777).toBe(0o600);
    agent.publish(null);
    expect(existsSync(file)).toBe(false);
    expect(agent.claudeCodeCommand).toBe(
      `claude mcp add cadanraw -s user -e ELECTRON_RUN_AS_NODE=1 -- "${paths.execPath}" "${paths.bridgePath}" "${paths.userData}"`,
    );
  });

  it("restarts with the saved token and port so saved configs keep working", async () => {
    const server = createAgentServer(async () => ({ ok: true }));
    try {
      const first = await server.start(false);
      const port = Number(new URL(first.url).port);
      const again = await server.start(true, { token: first.token, port });
      expect(again.url).toBe(first.url);
      expect(again.token).toBe(first.token);
      const fresh = await server.start(true, { port });
      expect(fresh.token).not.toBe(first.token);
    } finally {
      await server.stop();
    }
  });
});
