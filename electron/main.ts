import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  screen,
  shell,
  type MenuItemConstructorOptions,
} from "electron";
import * as path from "path";
import Store from "electron-store";
import { openDatabase } from "./db/connection";
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
const store = new Store<{ windowBounds: WindowBounds }>({
  defaults: { windowBounds: { width: 1280, height: 800 } },
});

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

  const area = screen.getDisplayMatching({ x: b.x, y: b.y, width, height })
    .workArea;
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
    backgroundColor: "#0A0A10", // --deep; solid (no vibrancy behind the canvas)
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

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }

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
        { label: "New Canvas", accelerator: "CmdOrCtrl+N", click: send("new-canvas") },
        { label: "Open…", accelerator: "CmdOrCtrl+O", click: send("open-import") },
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
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: send("toggle-sidebar"),
        },
        { type: "separator" },
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
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
  registerVersionHandlers(ipcMain, createVersionService({ db, dataDir, trash }));
  registerLibraryHandlers(ipcMain, createLibraryService({ dataDir }));
  registerDialogHandlers(ipcMain, () => mainWindow);

  ipcMain.handle("app:get-info", () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }));

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
  ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);

  Menu.setApplicationMenu(buildMenu());

  mainWindow = createWindow();

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
  persistBounds();
  db?.close(); // checkpoints WAL and releases the file
  db = null;
});

// macOS keeps running with no windows; other platforms quit.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
