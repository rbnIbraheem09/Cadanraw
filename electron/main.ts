import { getLinkMetadata } from "./utils/link-metadata";
import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  screen,
  shell,
  net,
  globalShortcut,
  nativeTheme,
  type MenuItemConstructorOptions,
} from "electron";
import * as path from "path";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { FetchedImage } from "./ipc-contract";
import { createAgentServer } from "./services/agent-server";
import { createAgentSetup } from "./services/agent-setup";
const pendingAgentCalls = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
function askRenderer(method: string, args: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      reject(new Error("App window unavailable"));
      return;
    }
    const id = randomUUID();
    const timer = setTimeout(() => {
      pendingAgentCalls.delete(id);
      reject(new Error("Canvas did not respond"));
    }, 10000);
    pendingAgentCalls.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    mainWindow.webContents.send("agent:request", { id, method, args });
  });
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Resolve an agent image source to a data URL. The renderer then verifies it decodes. */
async function loadAgentImage(source: string): Promise<FetchedImage> {
  if (/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/.test(source))
    return { dataURL: source, mimeType: source.slice(5, source.indexOf(";")) };
  if (/^https?:\/\//i.test(source)) {
    const image = await fetchImage(source);
    if (!image) throw new Error("URL did not return an image");
    return image;
  }
  if (!path.isAbsolute(source))
    throw new Error("Use an http(s) URL, a data:image URL or an absolute path");
  const mimeType = IMAGE_TYPES[path.extname(source).slice(1).toLowerCase()];
  if (!mimeType) throw new Error("Unsupported image type");
  const info = await stat(source);
  if (!info.isFile() || info.size > MAX_IMAGE_BYTES)
    throw new Error("Image must be a file of at most 20 MB");
  const data = await readFile(source);
  return {
    dataURL: `data:${mimeType};base64,${data.toString("base64")}`,
    mimeType,
  };
}

/** Grab the canvas area the renderer reports, scaled for agent viewing. */
async function captureCanvas(
  view: { rect: { x: number; y: number; width: number; height: number } },
  maxSize: unknown,
) {
  if (!mainWindow || mainWindow.isDestroyed())
    throw new Error("App window unavailable");
  const zoom = mainWindow.webContents.getZoomFactor();
  const r = view.rect;
  const image = await mainWindow.webContents.capturePage(
    {
      x: Math.round(r.x * zoom),
      y: Math.round(r.y * zoom),
      width: Math.round(r.width * zoom),
      height: Math.round(r.height * zoom),
    },
    { stayHidden: true },
  );
  if (image.isEmpty())
    throw new Error(
      "Could not capture the canvas. Is the Cadanraw window open?",
    );
  const size = image.getSize();
  const max = Math.min(4096, Math.max(256, Number(maxSize) || 1568));
  const scale = Math.min(1, max / Math.max(size.width, size.height));
  const out =
    scale < 1
      ? image.resize({
          width: Math.round(size.width * scale),
          height: Math.round(size.height * scale),
          quality: "good",
        })
      : image;
  return {
    mcpContent: [
      {
        type: "image",
        data: out.toPNG().toString("base64"),
        mimeType: "image/png",
      },
      { type: "text", text: JSON.stringify({ ...view, rect: undefined }) },
    ],
  };
}

const agentServer = createAgentServer(async (method, args) => {
  if (method === "add_image")
    return askRenderer(method, {
      ...args,
      source: undefined,
      image: await loadAgentImage(String(args.source ?? "")),
    });
  if (method === "screenshot") {
    const view = await askRenderer(method, args);
    try {
      return await captureCanvas(
        view as Parameters<typeof captureCanvas>[0],
        args.maxSize,
      );
    } finally {
      void askRenderer("screenshot_done", {}).catch(() => {});
    }
  }
  return askRenderer(method, args);
}, app.getVersion());

/** Fetch an http(s) image from the main process (no renderer CORS). */
async function fetchImage(url: string): Promise<FetchedImage | null> {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    const res = await net.fetch(url, {
      headers: { "User-Agent": "Cadanraw/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]
      .trim();
    if (!contentType.startsWith("image/")) return null;

    if (Number(res.headers.get("content-length")) > MAX_IMAGE_BYTES)
      return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_IMAGE_BYTES) return null;
        chunks.push(Buffer.from(chunk.value));
      }
    } finally {
      await reader.cancel();
    }
    const buffer = Buffer.concat(chunks);
    return {
      dataURL: `data:${contentType};base64,${buffer.toString("base64")}`,
      mimeType: contentType,
    };
  } catch {
    return null;
  }
}

// Force sRGB color profile so pasted screenshots don't appear brighter due to
// Display P3 → sRGB color space mismatches on wide-gamut macOS displays.
app.commandLine.appendSwitch("force-color-profile", "srgb");
import Store from "electron-store";
import { openDatabase } from "./db/connection";
import { createFolderService } from "./services/folder-service";
import { createCanvasService } from "./services/canvas-service";
import { createVersionService } from "./services/version-service";
import { createLibraryService } from "./services/library-service";
import { registerCanvasHandlers } from "./ipc/canvases";
import { registerVersionHandlers } from "./ipc/versions";
import { registerLibraryHandlers } from "./ipc/library";
import { registerDialogHandlers } from "./ipc/dialogs";
import { ensureDataDirs, dbPath } from "./utils/paths";

// Lock the app name early (before getPath("userData")) so data lives under
// ~/Library/Application Support/Cadanraw consistently in dev and packaged builds.
app.setName("Cadanraw");

// ── Persisted UI state (window geometry, etc.). SQLite is added in Phase 3. ──
interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}
interface AgentSettings {
  enabled: boolean;
  allowWrite: boolean;
  token?: string;
  port?: number;
}
/** What the renderer's preferences mean for the native side. Kept here too so
 *  the window opens in the right colour and the shortcut works before any page loads. */
interface NativePrefs {
  scheme: "dark" | "light";
  background: string;
  capture: { enabled: boolean; shortcut: string };
}
const store = new Store<{
  windowBounds: WindowBounds;
  agent: AgentSettings;
  prefs: NativePrefs;
}>({
  defaults: {
    windowBounds: { width: 1280, height: 800 },
    agent: { enabled: false, allowWrite: false },
    prefs: {
      scheme: "dark",
      background: "#0b1016",
      capture: { enabled: true, shortcut: "Control+Alt+Space" },
    },
  },
});

// The packaged app loads its built files; so does a dev run with
// CADANRAW_LOAD_DIST=1 (the smoke test uses it to check the production build).
const loadsBuiltFiles = app.isPackaged || process.env.CADANRAW_LOAD_DIST === "1";
const pageUrl = (hash = "") =>
  loadsBuiltFiles ? null : `http://localhost:5173/${hash ? `#${hash}` : ""}`;

/** Load the app (or one of its faces, by hash) into a window. */
function loadPage(win: BrowserWindow, hash = "") {
  const url = pageUrl(hash);
  if (url) void win.loadURL(url);
  else
    void win.loadFile(path.join(__dirname, "../dist/index.html"), hash ? { hash } : undefined);
}

// ── Quick note: a small panel summoned from anywhere by a global shortcut ──
let captureWindow: BrowserWindow | null = null;
let captureIdle: NodeJS.Timeout | null = null;
let registeredShortcut: string | null = null;
const CAPTURE_SIZE = { width: 580, height: 156 };
const CAPTURE_IDLE_MS = 10 * 60 * 1000;

function hideCapture() {
  if (!captureWindow || captureWindow.isDestroyed() || !captureWindow.isVisible()) return;
  captureWindow.hide();
  // Keep it warm for a while (showing a built window is instant), then give
  // the memory back.
  if (captureIdle) clearTimeout(captureIdle);
  captureIdle = setTimeout(() => {
    captureWindow?.destroy();
    captureWindow = null;
  }, CAPTURE_IDLE_MS);
}

function showCapture() {
  if (captureIdle) clearTimeout(captureIdle);
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const position = {
    x: Math.round(display.x + (display.width - CAPTURE_SIZE.width) / 2),
    y: Math.round(display.y + display.height * 0.22),
  };
  const reveal = (win: BrowserWindow) => {
    win.setPosition(position.x, position.y);
    win.show();
    win.focus();
    win.webContents.send("capture:show");
  };
  if (captureWindow && !captureWindow.isDestroyed()) return reveal(captureWindow);

  const win = new BrowserWindow({
    ...CAPTURE_SIZE,
    ...position,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: store.get("prefs").background,
    // A panel takes the keyboard without bringing the main window forward.
    ...(process.platform === "darwin" ? { type: "panel" as const } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.on("blur", hideCapture);
  win.on("closed", () => {
    if (captureWindow === win) captureWindow = null;
  });
  win.once("ready-to-show", () => reveal(win));
  loadPage(win, "capture");
  captureWindow = win;
}

function toggleCapture() {
  if (captureWindow && !captureWindow.isDestroyed() && captureWindow.isVisible()) hideCapture();
  else showCapture();
}

/** Bring the native side in line with the preferences. Returns whether the
 *  quick-note shortcut is live, so Settings can say so truthfully. */
function applyNativePrefs(prefs: NativePrefs): { captureRegistered: boolean } {
  nativeTheme.themeSource = prefs.scheme;
  for (const win of [mainWindow, captureWindow])
    if (win && !win.isDestroyed()) win.setBackgroundColor(prefs.background);

  const wanted = prefs.capture.enabled ? prefs.capture.shortcut : null;
  if (wanted !== registeredShortcut) {
    if (registeredShortcut) globalShortcut.unregister(registeredShortcut);
    registeredShortcut = null;
    if (wanted) {
      try {
        if (globalShortcut.register(wanted, toggleCapture)) registeredShortcut = wanted;
      } catch {
        // An accelerator Electron can't parse: leave it unregistered.
      }
    }
  }
  return { captureRegistered: !wanted || registeredShortcut === wanted };
}

let agentSetup: ReturnType<typeof createAgentSetup> | null = null;

/** Start agent access with the saved token and port, and remember it for next launch. */
async function startAgent(allowWrite: boolean, newToken = false) {
  const saved = store.get("agent");
  const info = await agentServer.start(allowWrite, {
    token: newToken ? undefined : saved.token,
    port: saved.port,
  });
  store.set("agent", {
    enabled: true,
    allowWrite,
    token: info.token,
    port: Number(new URL(info.url).port),
  });
  agentSetup?.publish(info);
  return agentStatus();
}

async function stopAgent() {
  store.set("agent", { ...store.get("agent"), enabled: false });
  agentSetup?.publish(null);
  await agentServer.stop();
  return agentStatus();
}

function agentStatus() {
  return { ...agentServer.status(), bridge: agentSetup?.entry };
}

const MIN_WIDTH = 880;
const MIN_HEIGHT = 600;

let mainWindow: BrowserWindow | null = null;
let db: ReturnType<typeof openDatabase> | null = null;
let isQuitting = false;

/** Clamp restored bounds to a currently-visible display so the window can't
 *  open off-screen after a monitor change. */
function sanitizeBounds(b: WindowBounds): WindowBounds {
  const width = Math.max(MIN_WIDTH, Math.round(b.width));
  const height = Math.max(MIN_HEIGHT, Math.round(b.height));
  if (b.x === undefined || b.y === undefined) return { width, height };

  const area = screen.getDisplayMatching({
    x: b.x,
    y: b.y,
    width,
    height,
  }).workArea;
  const x = Math.min(Math.max(b.x, area.x), area.x + area.width - width);
  const y = Math.min(Math.max(b.y, area.y), area.y + area.height - height);
  return { width, height, x, y };
}

function persistBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // getBounds() is valid even while hidden (close → hide), so this is safe.
  const { width, height, x, y } = mainWindow.getBounds();
  store.set("windowBounds", { width, height, x, y });
}

let saveTimer: NodeJS.Timeout | null = null;
function scheduleBoundsSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistBounds, 400);
}

function createWindow(): BrowserWindow {
  const bounds = sanitizeBounds(store.get("windowBounds"));
  const isMac = process.platform === "darwin";

  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false, // reveal once content is ready — avoids a white flash
    backgroundColor: store.get("prefs").background, // the theme's --deep; solid behind the canvas
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 12, y: 14 },
        }
      : {
          frame: false,
        }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload uses Node require (electron-store / better-sqlite3)
    },
  });

  loadPage(win);

  win.once("ready-to-show", () => win.show());

  win.on("resize", scheduleBoundsSave);
  win.on("move", scheduleBoundsSave);
  win.on("maximize", () => emitWindowMaximized(win));
  win.on("unmaximize", () => emitWindowMaximized(win));

  if (isMac) {
    // Cmd+W hides instead of closing — the app keeps running in the background.
    win.webContents.on("before-input-event", (event, input) => {
      if (
        input.type === "keyDown" &&
        input.meta &&
        input.key.toLowerCase() === "w"
      ) {
        event.preventDefault();
        win.hide();
      }
    });
  }

  // macOS red traffic-light / menu Close hides (unless the app is truly quitting).
  // Windows and Linux use the native convention: close the final window and quit.
  win.on("close", (e) => {
    if (isMac && !isQuitting) {
      e.preventDefault();
      persistBounds();
      win.hide();
      return;
    }
    persistBounds();
  });

  return win;
}

function emitWindowMaximized(win = mainWindow) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("window:maximized-change", win.isMaximized());
}

function buildMenu(): Menu {
  // Sends a named action to the renderer (where the store handles it).
  const send = (action: string) => () =>
    mainWindow?.webContents.send("menu:action", action);
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Settings…",
                accelerator: "CmdOrCtrl+,",
                click: send("settings"),
              },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Board…",
          accelerator: "CmdOrCtrl+N",
          click: send("new-canvas"),
        },
        {
          label: "Quick Note",
          click: () => showCapture(),
        },
        {
          label: "Import…",
          accelerator: "CmdOrCtrl+O",
          click: send("open-import"),
        },
        { type: "separator" },
        { label: "Save", accelerator: "CmdOrCtrl+S", click: send("save") },
        {
          label: "Save Version…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: send("save-version"),
        },
        { label: "Export…", accelerator: "CmdOrCtrl+E", click: send("export") },
        ...(!isMac
          ? [
              { type: "separator" as const },
              {
                label: "Settings…",
                accelerator: "CmdOrCtrl+,",
                click: send("settings"),
              },
              { type: "separator" as const },
              { label: "Exit", role: "quit" as const },
            ]
          : []),
      ],
    },
    {
      // Editing shortcuts are owned by Excalidraw — we DON'T register these
      // accelerators (registerAccelerator: false) so ⌘Z / ⌘A etc. reach the
      // canvas instead of being swallowed by the native menu.
      label: "Edit",
      submenu: [
        { role: "undo", registerAccelerator: false },
        { role: "redo", registerAccelerator: false },
        { type: "separator" },
        { role: "cut", registerAccelerator: false },
        { role: "copy", registerAccelerator: false },
        { role: "paste", registerAccelerator: false },
        { role: "selectAll", registerAccelerator: false },
        { type: "separator" },
        { label: "Insert Block…", click: send("insert") },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Search…",
          accelerator: "CmdOrCtrl+K",
          click: send("command-palette"),
        },
        {
          label: "Go to Board…",
          accelerator: "CmdOrCtrl+P",
          click: send("go-to-board"),
        },
        { label: "Home", accelerator: "CmdOrCtrl+1", click: send("home") },
        { type: "separator" },
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: send("toggle-sidebar"),
        },
        {
          label: "Focus Mode",
          accelerator: "CmdOrCtrl+.",
          click: send("focus-mode"),
        },
        { type: "separator" },
        // Reloading would drop the editor mid-thought; it's a development tool.
        ...(app.isPackaged
          ? []
          : [
              { role: "reload" as const },
              { role: "toggleDevTools" as const },
              { type: "separator" as const },
            ]),
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: "Close Window",
          accelerator: "CmdOrCtrl+W",
          click: (_item, win) => win?.close(),
        },
        { role: "minimize" },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

app.whenReady().then(() => {
  // ── Data layer: SQLite (metadata) + on-disk .excalidraw files under userData ──
  const dataDir = app.getPath("userData");
  ensureDataDirs(dataDir);
  db = openDatabase(dbPath(dataDir));
  const trash = (p: string) => shell.trashItem(p);
  registerCanvasHandlers(ipcMain, createCanvasService({ db, dataDir, trash }));
  const folders = createFolderService(db);
  ipcMain.handle("folders:list", () => folders.list());
  ipcMain.handle("folders:create", (_e, { name, parentId }) =>
    folders.create(name, parentId),
  );
  ipcMain.handle("folders:rename", (_e, { id, name }) =>
    folders.rename(id, name),
  );
  ipcMain.handle("folders:remove", (_e, id) => folders.remove(id));
  registerVersionHandlers(
    ipcMain,
    createVersionService({ db, dataDir, trash }),
  );
  registerLibraryHandlers(ipcMain, createLibraryService({ dataDir }));
  registerDialogHandlers(ipcMain, () => mainWindow);

  agentSetup = createAgentSetup({
    userData: dataDir,
    appData: app.getPath("appData"),
    home: app.getPath("home"),
    execPath: process.execPath,
    bridgePath: path.join(__dirname, "mcp-bridge.js"),
    platform: process.platform,
  });
  agentSetup.publish(null); // clear a file left by a crash
  const agentPrefs = store.get("agent");
  if (agentPrefs.enabled)
    startAgent(agentPrefs.allowWrite).catch((e) =>
      console.error("Could not restore agent access", e),
    );
  ipcMain.handle("agent:status", () => agentStatus());
  ipcMain.handle("agent:start", (_e, allowWrite: boolean) =>
    startAgent(allowWrite === true),
  );
  ipcMain.handle("agent:stop", () => stopAgent());
  ipcMain.handle("agent:reset-token", () =>
    startAgent(agentServer.status().allowWrite, true),
  );
  // Returns a terminal command to copy when the CLI can't be run for the user.
  ipcMain.handle(
    "agent:setup",
    async (_e, client: "claude-desktop" | "claude-code") => {
      if (!agentSetup) throw new Error("Not ready");
      if (client === "claude-desktop") {
        agentSetup.addToClaudeDesktop();
        return { done: true };
      }
      try {
        await agentSetup.addToClaudeCode();
        return { done: true };
      } catch {
        return { done: false, command: agentSetup.claudeCodeCommand };
      }
    },
  );
  ipcMain.on("agent:response", (event, response) => {
    if (event.sender !== mainWindow?.webContents) return;
    const pending = pendingAgentCalls.get(response.id);
    if (!pending) return;
    pendingAgentCalls.delete(response.id);
    if (response.error) pending.reject(new Error(response.error));
    else pending.resolve(response.result);
  });

  ipcMain.handle("prefs:sync", (_e, prefs: NativePrefs) => {
    const next: NativePrefs = {
      scheme: prefs?.scheme === "light" ? "light" : "dark",
      background: /^#[0-9a-f]{6}$/i.test(prefs?.background ?? "")
        ? prefs.background
        : store.get("prefs").background,
      capture: {
        enabled: prefs?.capture?.enabled !== false,
        shortcut:
          typeof prefs?.capture?.shortcut === "string" && prefs.capture.shortcut.length < 64
            ? prefs.capture.shortcut
            : store.get("prefs").capture.shortcut,
      },
    };
    store.set("prefs", next);
    return applyNativePrefs(next);
  });
  ipcMain.handle("capture:open", () => showCapture());
  ipcMain.on("capture:hide", () => hideCapture());
  // The panel only collects text; the main window files it onto a board.
  ipcMain.handle("capture:submit", (_e, text: string) =>
    askRenderer("capture_note", { text: String(text ?? "").slice(0, 20000) }),
  );
  ipcMain.handle("app:reveal-data", () => shell.openPath(dataDir));
  ipcMain.handle("window:set-buttons-hidden", (_e, hidden: boolean) => {
    if (process.platform === "darwin" && mainWindow && !mainWindow.isDestroyed())
      mainWindow.setWindowButtonVisibility(!hidden);
  });

  ipcMain.handle("app:get-info", () => ({
    name: app.getName(),
    version: app.getVersion(),
    dataPath: dataDir,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }));

  // Fetch an image URL from the main process (bypasses renderer CORS restrictions).
  // Returns { dataURL, mimeType } if the URL resolves to an image, else null.
  ipcMain.handle("app:fetch-image", (_e, url: string) => fetchImage(url));

  ipcMain.handle("app:link-metadata", (_e, url: string) =>
    getLinkMetadata(url, net.fetch),
  );

  // Fetch a webpage's og:image URL from the main process.
  // Returns the resolved og:image URL string, or null if not found.
  ipcMain.handle("app:get-og-image", async (_e, url: string) => {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return null;

      const res = await net.fetch(url, {
        headers: { "User-Agent": "Cadanraw/1.0", Accept: "text/html" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.startsWith("text/html")) return null;

      const html = await res.text();
      // Extract og:image meta tag (handle both attribute orderings)
      const ogImage =
        html.match(
          /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
        )?.[1] ??
        html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1];

      if (!ogImage) return null;

      // Resolve relative URLs against the page URL
      return new URL(ogImage, url).href;
    } catch {
      return null;
    }
  });

  // Check GitHub for the latest Cadanraw release.
  // Returns { version, url } or null on failure.
  ipcMain.handle("app:check-for-updates", async () => {
    try {
      const res = await net.fetch(
        "https://api.github.com/repos/rbnIbraheem09/Cadanraw/releases/latest",
        { headers: { "User-Agent": "Cadanraw/1.0" } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      return {
        version: data.tag_name as string,
        url: data.html_url as string,
      };
    } catch {
      return null;
    }
  });

  // Open a URL in the user's default browser.
  ipcMain.handle("app:open-external", (_e, url: string) => {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol)) {
      void shell.openExternal(url);
    }
  });

  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:toggle-maximize", () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return mainWindow.isMaximized();
  });
  ipcMain.handle("window:close", () => mainWindow?.close());
  ipcMain.handle(
    "window:is-maximized",
    () => mainWindow?.isMaximized() ?? false,
  );

  Menu.setApplicationMenu(buildMenu());

  mainWindow = createWindow();
  applyNativePrefs(store.get("prefs"));

  if (process.platform === "darwin") {
    // macOS: re-summon the window from the dock after a Cmd+W hide.
    app.on("activate", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        mainWindow = createWindow();
      }
    });
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  captureWindow?.destroy();
  persistBounds();
  agentSetup?.publish(null);
  void agentServer.stop();
  db?.close(); // checkpoints WAL and releases the file
  db = null;
});

// macOS keeps running with no windows; other platforms quit.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
