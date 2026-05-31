// Headless verification that better-sqlite3 loads under Electron's ABI and the
// canvas data layer works in the real runtime. Run via `npm run smoke:db`.
// Creates a throwaway temp DB, exercises the service, prints SMOKE_OK, exits.
const { app } = require("electron");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const { openDatabase } = require("../dist-electron/db/connection");
const {
  createCanvasService,
} = require("../dist-electron/services/canvas-service");
const { ensureDataDirs, dbPath } = require("../dist-electron/utils/paths");

if (app.dock) app.dock.hide(); // no UI for a smoke test

app
  .whenReady()
  .then(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excali-smoke-"));
    ensureDataDirs(dir);
    const db = openDatabase(dbPath(dir));
    const svc = createCanvasService({ db, dataDir: dir, trash: async () => {} });

    const c = svc.create("Smoke");
    svc.save(
      c.id,
      JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "excali",
        elements: [{ id: "1", isDeleted: false }],
        appState: {},
        files: {},
      }),
    );
    const list = svc.list();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });

    console.log(
      "SMOKE_OK " +
        JSON.stringify({
          canvases: list.length,
          elementCount: list[0].elementCount,
          electron: process.versions.electron,
          abi: process.versions.modules,
        }),
    );
    app.exit(0);
  })
  .catch((e) => {
    console.error("SMOKE_FAIL", e);
    app.exit(1);
  });
