import { execFile } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic } from "../utils/fs-atomic";

export interface AgentSetupPaths {
  userData: string;
  /** Where desktop apps keep their settings (Electron's appData path). */
  appData: string;
  home: string;
  /** The Cadanraw executable, run in Node mode to host the stdio bridge. */
  execPath: string;
  bridgePath: string;
  platform: NodeJS.Platform;
}

/**
 * One-time setup for local MCP clients. Clients launch Cadanraw's stdio bridge
 * (the same config works across restarts); the bridge finds the running app
 * through an owner-only connection file.
 */
export function createAgentSetup(p: AgentSetupPaths) {
  const connectionFile = join(p.userData, "agent-connection.json");
  const entry = {
    command: p.execPath,
    args: [p.bridgePath, p.userData],
    env: { ELECTRON_RUN_AS_NODE: "1" },
  };
  const claudeCodeCommand = `claude mcp add cadanraw -s user -e ELECTRON_RUN_AS_NODE=1 -- ${[
    entry.command,
    ...entry.args,
  ]
    .map((arg) => `"${arg}"`)
    .join(" ")}`;

  return {
    entry,
    claudeCodeCommand,

    /** Point the bridge at the running endpoint, or clear it when access is off. */
    publish(info: { url: string; token: string; allowWrite: boolean } | null) {
      rmSync(connectionFile, { force: true });
      if (info)
        writeFileSync(connectionFile, JSON.stringify(info), { mode: 0o600 });
    },

    /** Merge Cadanraw into claude_desktop_config.json, keeping everything else. */
    addToClaudeDesktop() {
      const dir = join(p.appData, "Claude");
      if (!existsSync(dir))
        throw new Error("Claude Desktop isn't installed for this user.");
      const file = join(dir, "claude_desktop_config.json");
      let config: any = {};
      if (existsSync(file)) {
        try {
          config = JSON.parse(readFileSync(file, "utf8"));
        } catch {
          config = null;
        }
      }
      if (!config || typeof config !== "object" || Array.isArray(config))
        throw new Error(
          "Claude Desktop's config file isn't valid JSON, so it was left unchanged.",
        );
      config.mcpServers = { ...config.mcpServers, cadanraw: entry };
      writeFileAtomic(file, JSON.stringify(config, null, 2) + "\n");
    },

    /** Register the bridge with the Claude Code CLI (user scope), replacing any old entry. */
    addToClaudeCode(): Promise<void> {
      if (p.platform === "win32")
        return Promise.reject(new Error("Run the command manually"));
      // GUI apps don't inherit the terminal PATH, so add the usual install spots.
      const PATH = [
        join(p.home, ".local/bin"),
        join(p.home, ".claude/local"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
        process.env.PATH,
      ]
        .filter(Boolean)
        .join(":");
      const shell = /\/(ba|z)sh$/.test(process.env.SHELL ?? "")
        ? process.env.SHELL!
        : p.platform === "darwin"
          ? "/bin/zsh"
          : "/bin/bash";
      return new Promise((resolve, reject) =>
        execFile(
          shell,
          [
            "-lc",
            'claude mcp remove cadanraw -s user >/dev/null 2>&1; claude mcp add cadanraw -s user -e ELECTRON_RUN_AS_NODE=1 -- "$@"',
            "cadanraw",
            entry.command,
            ...entry.args,
          ],
          { env: { ...process.env, PATH }, timeout: 30000 },
          (error) => (error ? reject(error) : resolve()),
        ),
      );
    },
  };
}
