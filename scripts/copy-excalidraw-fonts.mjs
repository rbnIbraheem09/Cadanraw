// Self-hosts Excalidraw's drawing fonts so the app works fully offline.
// Excalidraw fetches fonts at runtime from window.EXCALIDRAW_ASSET_PATH (set to
// "/" in index.html) + "fonts/...". We copy the package's prod fonts into
// public/fonts so Vite serves them from the root in dev and bundles them on build.
//
// Runs automatically on `npm install` (postinstall) and manually via `npm run copy:fonts`.
import { existsSync, rmSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(
  projectRoot,
  "node_modules/@excalidraw/excalidraw/dist/prod/fonts",
);
const dest = join(projectRoot, "public/fonts");

if (!existsSync(src)) {
  console.warn(
    "[copy-fonts] @excalidraw/excalidraw fonts not found — skipping (will run after dependencies install).",
  );
  process.exit(0);
}

// Always overwrite so a version bump picks up new/renamed font files.
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-fonts] Copied Excalidraw fonts → public/fonts");
