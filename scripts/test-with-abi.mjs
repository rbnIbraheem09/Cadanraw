// better-sqlite3 is a native module compiled for ONE runtime at a time.
// The app needs the Electron build; Vitest (plain Node) needs the Node build.
// This runner flips to Node, runs the tests, then ALWAYS restores the Electron
// build — even when tests fail — so the app is never left unable to launch.
import { spawnSync } from "node:child_process";

const run = (cmd, args) =>
  spawnSync(cmd, args, { stdio: "inherit" }).status ?? 1;

console.log("[test] rebuilding better-sqlite3 for Node (test runtime)…");
run("npm", ["rebuild", "better-sqlite3"]);

const code = run("npx", ["vitest", "run"]);

console.log("[test] restoring better-sqlite3 for Electron (app runtime)…");
run("npm", ["run", "rebuild-sqlite"]);

process.exit(code); // preserve the real test result
