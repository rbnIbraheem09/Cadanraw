import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CornerDownLeft, Folder, LayoutTemplate, Plus, Search } from "lucide-react";
import { useStore } from "../../store/excaliStore";
import { useUi } from "../../store/ui";
import { useLayer } from "../../hooks/useLayer";
import { buildCommands, type Command } from "../../lib/commands";
import { goHome, openBoard } from "../../lib/board-actions";
import { folderPath } from "../../lib/folders";
import { formatRelativeTime } from "../../lib/format";
import { fuzzyScore } from "../../lib/fuzzy";
import { fade, pop } from "../../lib/motion";
import { mod } from "../../lib/platform";
import { sfx } from "../../lib/sound";

interface Row {
  id: string;
  title: string;
  detail?: string;
  section: string;
  icon: Command["icon"];
  shortcut?: string;
  active?: boolean;
  run: () => void | Promise<void>;
}

export default function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const close = useUi((s) => s.closePalette);
  useLayer(open, close);
  useEffect(() => {
    if (open) sfx.open();
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-scrim"
          variants={fade}
          initial="initial"
          animate="animate"
          exit="exit"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <motion.div className="palette" variants={pop} role="dialog" aria-label="Search">
            <Palette />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Palette() {
  const mode = useUi((s) => s.paletteMode);
  const close = useUi((s) => s.closePalette);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.trim();

  // Built once per opening: the palette is a snapshot of what's possible now.
  const { commands, boards, folders } = useMemo(() => {
    const s = useStore.getState();
    const order = new Map(s.recentIds.map((id, i) => [id, i]));
    const current = s.homeOpen ? null : s.activeCanvasId;
    return {
      commands: buildCommands(),
      folders: s.folders,
      boards: [...s.canvases]
        .filter((b) => b.id !== current)
        .sort(
          (a, b) =>
            (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99) ||
            b.updatedAt.localeCompare(a.updatedAt),
        ),
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    const boardRow = (b: (typeof boards)[number]): Row => ({
      id: `board-${b.id}`,
      title: b.name,
      detail: `${b.folderId ? `${folderPath(folders, b.folderId)} · ` : ""}${formatRelativeTime(b.updatedAt)}`,
      section: "Boards",
      icon: LayoutTemplate,
      run: () => openBoard(b.id),
    });
    if (!q) {
      const recent = boards.slice(0, mode === "boards" ? 40 : 5).map((b) => ({
        ...boardRow(b),
        section: mode === "boards" ? "Boards" : "Jump back in",
      }));
      return mode === "boards" ? recent : [...recent, ...commands];
    }
    const scored: { row: Row; score: number }[] = [];
    for (const b of boards) {
      const score = fuzzyScore(q, b.name);
      if (score) scored.push({ row: boardRow(b), score: score + 40 });
    }
    if (mode === "all") {
      for (const f of folders) {
        const score = fuzzyScore(q, f.name);
        if (score)
          scored.push({
            score,
            row: {
              id: `folder-${f.id}`,
              title: f.name,
              detail: "Folder",
              section: "Folders",
              icon: Folder,
              run: () => goHome(f.id, "folder"),
            },
          });
      }
      for (const c of commands) {
        const score = Math.max(fuzzyScore(q, c.title), fuzzyScore(q, c.keywords ?? "") * 0.6);
        if (score) scored.push({ row: c, score });
      }
    }
    const ranked = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map(({ row }) => ({ ...row, section: "Results" }));
    return [
      ...ranked,
      {
        id: "create",
        title: `Create board “${q}”`,
        section: "Create",
        icon: Plus,
        shortcut: mod("↩"),
        run: () => useStore.getState().createCanvas(q),
      },
    ];
  }, [q, mode, boards, folders, commands]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index, rows]);

  const run = (row: Row | undefined) => {
    if (!row) return;
    sfx.tap();
    close();
    void row.run();
  };

  return (
    <>
      <div className="palette-field">
        <Search size={16} />
        <input
          autoFocus
          value={query}
          placeholder={mode === "boards" ? "Go to a board…" : "Search boards, or type a command…"}
          aria-label="Search"
          spellCheck={false}
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            const down = e.key === "ArrowDown" || (e.ctrlKey && e.key === "n");
            const up = e.key === "ArrowUp" || (e.ctrlKey && e.key === "p");
            if (down || up) {
              e.preventDefault();
              setIndex((i) => (i + (down ? 1 : rows.length - 1)) % Math.max(rows.length, 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(e.metaKey || e.ctrlKey ? (rows.find((r) => r.id === "create") ?? rows[index]) : rows[index]);
            }
          }}
        />
        <kbd>esc</kbd>
      </div>
      <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
        {rows.map((row, i) => {
          const Icon = row.icon;
          const heading = i === 0 || rows[i - 1].section !== row.section;
          return (
            <div key={row.id}>
              {heading && <div className="palette-section">{row.section}</div>}
              <button
                role="option"
                aria-selected={i === index}
                className="palette-item"
                onPointerMove={() => i !== index && setIndex(i)}
                onClick={() => run(row)}
              >
                <span className="palette-icon">
                  <Icon size={15} />
                </span>
                <span className="palette-title">{row.title}</span>
                {row.detail && <span className="palette-detail">{row.detail}</span>}
                {row.active && <Check size={14} className="palette-check" />}
                {row.shortcut && <kbd>{row.shortcut}</kbd>}
              </button>
            </div>
          );
        })}
        {!rows.length && <p className="palette-empty">No boards yet. Type a name to create one.</p>}
      </div>
      <div className="palette-foot">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> to move
        </span>
        <span>
          <kbd>
            <CornerDownLeft size={10} />
          </kbd>{" "}
          to open
        </span>
        {mode === "all" && (
          <span>
            <kbd>{mod("P")}</kbd> boards only
          </span>
        )}
      </div>
    </>
  );
}
