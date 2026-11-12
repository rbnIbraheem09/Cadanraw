// End-to-end smoke test of the real app: boots Electron against a throwaway
// data folder (never your library), with its windows kept off screen, and
// drives the renderer through the things most likely to break.
//
//   npm run dev:renderer        (in another terminal)
//   npm run build:electron && SMOKE_OUT=/tmp/cadanraw-smoke npx electron scripts/smoke-ui.cjs
//
// Add CADANRAW_LOAD_DIST=1 (after `npm run build:renderer`) to test the
// production build loaded from file:// instead of the dev server.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const out = process.env.SMOKE_OUT;
if (!out) throw new Error("Set SMOKE_OUT to a scratch folder");
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", path.join(out, "data"));

// Nothing should appear on the desktop or take focus while this runs.
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};
app.dock?.hide();

require("../dist-electron/main.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

app.whenReady().then(async () => {
  try {
    await sleep(1500);
    const win = BrowserWindow.getAllWindows()[0];
    const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`, true);
    const until = async (code, ms = 15000) => {
      for (const end = Date.now() + ms; Date.now() < end; await sleep(200))
        if (await js(`return !!(${code})`).catch(() => false)) return true;
      return false;
    };

    check("library renders", await until(`document.querySelector(".library-home")`));
    check("theme applied before paint", (await js(`return document.documentElement.dataset.theme`)) === "slate");

    await js(`[...document.querySelectorAll(".template-chip")].find((b) => b.textContent.includes("Project plan")).click()`);
    check("template board opens in the editor", await until(`document.querySelector(".excalidraw canvas") && document.querySelectorAll(".canvas-block").length >= 4`));
    check("insert and share controls are in the toolbar", await js(`return document.querySelectorAll(".canvas-tool").length === 2`));
    const surface = await js(`const s = document.querySelector(".dot-surface"); return [s.dataset.grid, s.style.getPropertyValue("--dot-spacing")].join(" ")`);
    check("board background is driven by the scroll variables", /^dots \d/.test(surface), surface);

    const note = await js(`return JSON.stringify(await window.excali.capture.submit("Smoke note\\nwritten by the smoke test"))`);
    check("quick note is filed", note.includes("Inbox"), note);
    const boards = await js(`return JSON.stringify((await window.excali.canvases.list()).map((c) => [c.name, c.elementCount]))`);
    check("Inbox board holds the note", /\["Inbox",1\]/.test(boards), boards);
    const link = await js(`return JSON.stringify(await window.excali.capture.submit("https://example.com/article"))`);
    const inbox = await js(`const b = (await window.excali.canvases.list()).find((c) => c.name === "Inbox"); const scene = JSON.parse(await window.excali.canvases.read(b.id)); return scene.elements.map((e) => [e.type, e.customData.cadanrawBlock.kind, e.x, e.y].join(":")).join(" ")`);
    check("a link becomes a link card beside the note", link.includes("Inbox") && /embeddable:note:0:0 embeddable:link:392:0/.test(inbox), inbox);

    const sync = await js(`return JSON.stringify(await window.excali.prefs.sync({ scheme: "light", background: "#efeadf", capture: { enabled: false, shortcut: "Control+Alt+Space" } }))`);
    check("preferences reach the main process", sync.includes("captureRegistered"), sync);
    const info = await js(`return JSON.stringify(await window.excali.getAppInfo())`);
    check("data folder is the scratch one", info.includes(path.join(out, "data")), "");

    await js(`window.excali.capture.open()`);
    await sleep(2500);
    const panel = BrowserWindow.getAllWindows().find((w) => w !== win);
    check("quick-note window is created", !!panel, panel ? panel.webContents.getURL().replace(/^.*\//, "") : "none");
    if (panel) {
      const ui = await panel.webContents.executeJavaScript(`!!document.querySelector(".capture textarea") && !document.querySelector(".excalidraw")`, true);
      check("quick-note window shows its field (and no editor)", ui);
    }

    const image = await win.webContents.capturePage().catch(() => null);
    if (image && !image.isEmpty()) fs.writeFileSync(path.join(out, "board.png"), image.toPNG());
    check("screenshot captured", image && !image.isEmpty(), image ? JSON.stringify(image.getSize()) : "");
  } catch (e) {
    check("smoke run completed", false, e && e.stack ? e.stack : e);
  } finally {
    fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
    process.exitCode = results.every((r) => r.ok) ? 0 : 1;
    app.quit();
  }
});
