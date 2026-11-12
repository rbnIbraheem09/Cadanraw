import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CheckSquare,
  Columns3,
  FileText,
  LayoutTemplate,
  Link,
  Paperclip,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "../../store/excaliStore";
import { useUi } from "../../store/ui";
import { useLayer } from "../../hooks/useLayer";
import { insertBlock, insertBlockAtPoint, type BlockKind } from "../../lib/blocks";
import { fuzzyFilter } from "../../lib/fuzzy";
import { sfx } from "../../lib/sound";

export const BLOCKS: { kind: BlockKind; label: string; detail: string; icon: LucideIcon }[] = [
  { kind: "note", label: "Note", detail: "A thought, with room to grow", icon: FileText },
  { kind: "checklist", label: "Checklist", detail: "Turn ideas into next steps", icon: CheckSquare },
  { kind: "kanban", label: "Kanban", detail: "Move work from idea to done", icon: Columns3 },
  { kind: "table", label: "Table", detail: "Bring a little structure", icon: Table2 },
  { kind: "calendar", label: "Calendar", detail: "Give your plans a place", icon: CalendarDays },
  { kind: "board", label: "Board link", detail: "Connect a related board", icon: LayoutTemplate },
  { kind: "file", label: "Attachment", detail: "Keep a reference file close", icon: Paperclip },
];

const asUrl = (text: string) => {
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return /\.[a-z]{2,}$/i.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
};

/**
 * The quick way to put a block on the board: "/" opens it under the pointer and
 * the block lands there; the Insert button opens it under itself and the block
 * lands mid-view. Type to filter, or paste a link.
 */
export default function InsertMenu() {
  const menu = useUi((s) => s.insertMenu);
  const close = () => useUi.getState().setInsertMenu(null);
  useLayer(!!menu, close);
  if (!menu) return null;
  return <Menu key={`${menu.x}:${menu.y}`} />;
}

function Menu() {
  const menu = useUi((s) => s.insertMenu)!;
  const api = useStore((s) => s.api);
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [point, setPoint] = useState({ left: menu.x, top: menu.y });
  const close = () => useUi.getState().setInsertMenu(null);

  const url = query.trim().includes(".") && !query.trim().includes(" ") ? asUrl(query.trim()) : null;
  const options = useMemo(
    () => fuzzyFilter(query, BLOCKS, (b) => `${b.label} ${b.detail}`),
    [query],
  );
  const count = options.length + (url ? 1 : 0);

  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const left = menu.align === "right" ? menu.x - rect.width : menu.x;
    setPoint({
      left: Math.max(8, Math.min(left, innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(menu.y, innerHeight - rect.height - 8)),
    });
  }, [menu.x, menu.y, menu.align]);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, []);

  const choose = (i: number) => {
    if (!api) return;
    const kind: BlockKind | undefined = url && i === 0 ? "link" : options[i - (url ? 1 : 0)]?.kind;
    if (!kind) return;
    const link = kind === "link" ? url! : "";
    if (menu.at) insertBlockAtPoint(api, kind, menu.at, link);
    else insertBlock(api, kind, link);
    sfx.drop();
    close();
  };

  return createPortal(
    <div
      ref={ref}
      className="insert-menu pop-enter"
      style={{ ...point, ["--origin" as string]: menu.align === "right" ? "top right" : "top left" }}
      role="dialog"
      aria-label="Insert a block"
    >
      <input
        autoFocus
        value={query}
        placeholder="Insert… or paste a link"
        aria-label="Filter blocks"
        spellCheck={false}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
            e.preventDefault();
            setIndex((i) => (i + 1) % Math.max(count, 1));
          } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
            e.preventDefault();
            setIndex((i) => (i - 1 + count) % Math.max(count, 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(index);
          }
        }}
      />
      <div role="listbox" aria-label="Blocks">
        {url && (
          <button
            role="option"
            aria-selected={index === 0}
            className="insert-option"
            onPointerMove={() => setIndex(0)}
            onClick={() => choose(0)}
          >
            <span className="insert-icon">
              <Link size={16} />
            </span>
            <span>
              <strong>Link or video</strong>
              <small>{new URL(url).hostname}</small>
            </span>
          </button>
        )}
        {options.map(({ kind, label, detail, icon: Icon }, i) => {
          const at = i + (url ? 1 : 0);
          return (
            <button
              key={kind}
              role="option"
              aria-selected={index === at}
              className="insert-option"
              onPointerMove={() => setIndex(at)}
              onClick={() => choose(at)}
            >
              <span className="insert-icon">
                <Icon size={16} />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </button>
          );
        })}
        {!count && <p className="insert-empty">No block by that name.</p>}
      </div>
      <div className="insert-foot">
        <span>↑↓ to choose · ↩ to insert</span>
        <span>{menu.at ? "Lands at the pointer" : "Lands mid-view"}</span>
      </div>
    </div>,
    document.body,
  );
}
