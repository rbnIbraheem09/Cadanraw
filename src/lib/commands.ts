import {
  ArrowLeftRight,
  Bookmark,
  Download,
  Focus,
  FolderPlus,
  Grid3X3,
  Home,
  Import,
  Keyboard,
  Link,
  Maximize,
  Palette,
  PanelLeft,
  Pin,
  Plus,
  RefreshCw,
  Settings,
  StickyNote,
  Volume2,
  VolumeX,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "../store/excaliStore";
import { usePrefs } from "../store/prefs";
import { useUi } from "../store/ui";
import { BLOCKS } from "../components/canvas/InsertMenu";
import { goHome, openBoard } from "./board-actions";
import { insertBlock } from "./blocks";
import { GRIDS, THEMES } from "./themes";
import { formatAccelerator, mod } from "./platform";
import { reducedMotion } from "../store/prefs";
import { sfx } from "./sound";
import { checkForUpdates } from "./updates";

export interface Command {
  id: string;
  title: string;
  section: string;
  icon: LucideIcon;
  shortcut?: string;
  /** Extra words to match on. */
  keywords?: string;
  /** Shown on the right for the current choice (theme, grid). */
  active?: boolean;
  run: () => void | Promise<void>;
}

/** Everything the app can do, for the palette (and one place to add more). */
export function buildCommands(): Command[] {
  const s = useStore.getState();
  const ui = useUi.getState();
  const prefs = usePrefs.getState();
  const api = !s.homeOpen && !s.previewVersionId ? s.api : null;
  const board = s.homeOpen ? null : s.canvases.find((c) => c.id === s.activeCanvasId);
  const previous = s.recentIds.find(
    (id) => (s.homeOpen || id !== s.activeCanvasId) && s.canvases.some((c) => c.id === id),
  );
  const selected = api ? Object.keys(api.getAppState().selectedElementIds) : [];

  const commands: Command[] = [
    {
      id: "new-board",
      title: "New board…",
      section: "Create",
      icon: Plus,
      shortcut: mod("N"),
      keywords: "create canvas template",
      run: s.openNewCanvasDialog,
    },
    {
      id: "import",
      title: "Import an Excalidraw file…",
      section: "Create",
      icon: Import,
      shortcut: mod("O"),
      keywords: "open file",
      run: () => s.importFiles(),
    },
    {
      id: "quick-note",
      title: "Quick note",
      section: "Create",
      icon: StickyNote,
      shortcut: prefs.captureEnabled ? formatAccelerator(prefs.captureShortcut) : undefined,
      keywords: "capture jot inbox",
      run: () => window.excali.capture.open(),
    },
  ];

  if (api && board)
    commands.push(
      ...BLOCKS.map((b) => ({
        id: `insert-${b.kind}`,
        title: `Insert ${b.label.toLowerCase()}`,
        section: "On this board",
        icon: b.icon,
        keywords: `add block ${b.detail}`,
        run: () => {
          insertBlock(api, b.kind);
          sfx.drop();
        },
      })),
      {
        id: "zoom-fit",
        title: "Zoom to fit everything",
        section: "On this board",
        icon: Maximize,
        shortcut: "⇧1",
        keywords: "view all center",
        run: () =>
          api.scrollToContent(undefined, {
            fitToViewport: true,
            viewportZoomFactor: 0.88,
            animate: !reducedMotion(),
          }),
      },
      ...(selected.length === 1
        ? [
            {
              id: "link-selection",
              title: "Add a link to the selection",
              section: "On this board",
              icon: Link,
              keywords: "hyperlink url",
              run: () => api.updateScene({ appState: { showHyperlinkPopup: "editor" } }),
            },
          ]
        : []),
      {
        id: "save-version",
        title: "Save a version…",
        section: "On this board",
        icon: Bookmark,
        shortcut: mod("⇧", "S"),
        keywords: "checkpoint snapshot history",
        run: s.openSaveVersionDialog,
      },
      {
        id: "export",
        title: "Export…",
        section: "On this board",
        icon: Download,
        shortcut: mod("E"),
        keywords: "png svg download share",
        run: s.openExportDialog,
      },
      {
        id: "duplicate",
        title: "Duplicate this board",
        section: "On this board",
        icon: Copy,
        run: () => s.duplicateCanvas(board.id),
      },
      {
        id: "pin",
        title: board.isPinned ? "Unpin this board" : "Pin this board",
        section: "On this board",
        icon: Pin,
        run: () => s.togglePin(board.id),
      },
    );

  commands.push(
    {
      id: "home",
      title: "Go home",
      section: "Go to",
      icon: Home,
      shortcut: mod("1"),
      keywords: "library boards all",
      run: () => goHome(),
    },
    ...(previous
      ? [
          {
            id: "previous-board",
            title: `Back to “${s.canvases.find((c) => c.id === previous)!.name}”`,
            section: "Go to",
            icon: ArrowLeftRight,
            keywords: "previous last switch",
            run: () => openBoard(previous),
          },
        ]
      : []),
    {
      id: "pinned",
      title: "Go to pinned boards",
      section: "Go to",
      icon: Pin,
      run: () => goHome(null, "pinned"),
    },
    {
      id: "new-folder",
      title: "New folder",
      section: "Go to",
      icon: FolderPlus,
      keywords: "create organise",
      run: async () => {
        await goHome();
        await s.createFolder("New folder", null);
      },
    },
    {
      id: "settings",
      title: "Settings",
      section: "App",
      icon: Settings,
      shortcut: mod(","),
      keywords: "preferences options",
      run: ui.openSettings,
    },
    {
      id: "sidebar",
      title: s.sidebarOpen ? "Hide the sidebar" : "Show the sidebar",
      section: "App",
      icon: PanelLeft,
      shortcut: mod("B"),
      run: s.toggleSidebar,
    },
    {
      id: "focus",
      title: ui.focusMode ? "Leave focus mode" : "Focus mode",
      section: "App",
      icon: Focus,
      shortcut: mod("."),
      keywords: "zen distraction free fullscreen hide",
      run: ui.toggleFocusMode,
    },
    {
      id: "sounds",
      title: prefs.sounds ? "Turn sounds off" : "Turn sounds on",
      section: "App",
      icon: prefs.sounds ? VolumeX : Volume2,
      keywords: "mute audio",
      run: () => prefs.set("sounds", !prefs.sounds),
    },
    {
      id: "shortcuts",
      title: "Keyboard shortcuts",
      section: "App",
      icon: Keyboard,
      keywords: "keys help",
      run: () => {
        ui.openSettings();
        requestAnimationFrame(() =>
          document.getElementById("settings-shortcuts")?.scrollIntoView({ block: "start" }),
        );
      },
    },
    {
      id: "updates",
      title: "Check for updates",
      section: "App",
      icon: RefreshCw,
      keywords: "version release",
      run: checkForUpdates,
    },
    ...THEMES.map((t) => ({
      id: `theme-${t.id}`,
      title: `Theme: ${t.name}`,
      section: "Appearance",
      icon: Palette,
      keywords: `${t.scheme} colour color look ${t.blurb}`,
      active: prefs.theme === t.id,
      run: () => prefs.set("theme", t.id),
    })),
    ...GRIDS.map((g) => ({
      id: `grid-${g.id}`,
      title: `Board background: ${g.name}`,
      section: "Appearance",
      icon: Grid3X3,
      keywords: `grid pattern dots lines ${g.blurb}`,
      active: prefs.grid === g.id,
      run: () => prefs.set("grid", g.id),
    })),
  );
  return commands;
}
