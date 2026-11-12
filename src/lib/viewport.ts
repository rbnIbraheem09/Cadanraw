// Where you were looking on each board. Excalidraw files don't carry the
// viewport, so without this every board reopens at the origin at 100%.
// It's a per-device convenience, so it lives in localStorage.

const KEY = "cadanraw-views";
const MAX_BOARDS = 200;

export interface BoardView {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

type Stored = Record<string, [number, number, number]>;

function readAll(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return raw && typeof raw === "object" ? (raw as Stored) : {};
  } catch {
    return {};
  }
}

export function loadView(id: string): BoardView | null {
  const v = readAll()[id];
  if (!Array.isArray(v) || !v.every(Number.isFinite) || v[2] <= 0) return null;
  return { scrollX: v[0], scrollY: v[1], zoom: v[2] };
}

export function saveView(id: string, view: BoardView) {
  if (![view.scrollX, view.scrollY, view.zoom].every(Number.isFinite)) return;
  const all = readAll();
  delete all[id]; // re-insert so the most recent boards are last
  all[id] = [Math.round(view.scrollX), Math.round(view.scrollY), +view.zoom.toFixed(3)];
  const ids = Object.keys(all);
  for (const old of ids.slice(0, Math.max(0, ids.length - MAX_BOARDS))) delete all[old];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full or unavailable: the board simply opens fitted next time.
  }
}

export function forgetView(id: string) {
  const all = readAll();
  if (!(id in all)) return;
  delete all[id];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
