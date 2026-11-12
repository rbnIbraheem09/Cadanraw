import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  Grid2X2,
  Import,
  List,
  MoreHorizontal,
  PenLine,
  Pin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useStore } from "../../store/excaliStore";
import { folderPath, folderTrail } from "../../lib/folders";
import { formatRelativeTime, pluralize } from "../../lib/format";
import { boardMenuItems, goHome, openBoard } from "../../lib/board-actions";
import { TEMPLATES, type TemplateId } from "../../lib/templates";
import { mod } from "../../lib/platform";
import type { CanvasMeta, FolderMeta } from "../../types/canvas";
import ContextMenu from "../ui/ContextMenu";
import BoardPreview from "./BoardPreview";
import TemplateIcon from "./TemplateIcon";

const BOARD_MIME = "application/x-cadanraw-board";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type Sort = "recent" | "name" | "oldest";
type Editing =
  | { kind: "new-folder" }
  | { kind: "folder"; id: string }
  | { kind: "board"; id: string }
  | null;

export default function HomeView() {
  const s = useStore(
    useShallow((s) => ({
      canvases: s.canvases,
      folders: s.folders,
      libraryScope: s.libraryScope,
      libraryView: s.libraryView,
      currentFolderId: s.currentFolderId,
      setLibraryView: s.setLibraryView,
      moveCanvas: s.moveCanvas,
      createFolder: s.createFolder,
      renameFolder: s.renameFolder,
      removeFolder: s.removeFolder,
      renameCanvas: s.renameCanvas,
      createCanvas: s.createCanvas,
      importFiles: s.importFiles,
      openNewCanvasDialog: s.openNewCanvasDialog,
    })),
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    board?: CanvasMeta;
    folder?: FolderMeta;
  } | null>(null);

  const scopeFolderId = s.libraryScope === "folder" ? s.currentFolderId : null;
  const trail = folderTrail(s.folders, s.currentFolderId);
  const needle = query.trim().toLowerCase();
  const title =
    s.libraryScope === "pinned"
      ? "Pinned"
      : s.libraryScope === "folder"
        ? trail[trail.length - 1]?.name || "Unfiled"
        : greeting();

  const visible = useMemo(
    () =>
      s.canvases
        .filter(
          (b) =>
            (s.libraryScope === "all" ||
              (s.libraryScope === "pinned" ? b.isPinned : b.folderId === s.currentFolderId)) &&
            b.name.toLowerCase().includes(needle),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "oldest"
              ? a.updatedAt.localeCompare(b.updatedAt)
              : Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt),
        ),
    [s.canvases, s.currentFolderId, s.libraryScope, needle, sort],
  );
  const folders =
    s.libraryScope === "pinned"
      ? []
      : s.folders.filter(
          (f) => f.parentId === scopeFolderId && f.name.toLowerCase().includes(needle),
        );
  const menuBoard = s.canvases.find((b) => b.id === menu?.board?.id);

  const edit = (next: Editing, initial = "") => {
    setEditing(next);
    setName(initial);
  };
  const commit = () => {
    const value = name.trim();
    const target = editing;
    setEditing(null);
    if (!value || !target) return;
    if (target.kind === "new-folder") void s.createFolder(value, scopeFolderId);
    else if (target.kind === "folder") void s.renameFolder(target.id, value);
    else void s.renameCanvas(target.id, value);
  };
  const nameField = (label: string) => (
    <input
      autoFocus
      className="inline-rename"
      aria-label={label}
      value={name}
      maxLength={200}
      spellCheck={false}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(null);
      }}
    />
  );

  const startFromTemplate = (id: TemplateId) => {
    if (id === "blank") return s.openNewCanvasDialog();
    const template = TEMPLATES.find((t) => t.id === id)!;
    void s.createCanvas(template.name, id);
  };

  return (
    <section
      className="library-home"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(BOARD_MIME)) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.defaultPrevented) return;
        const id = e.dataTransfer.getData(BOARD_MIME);
        if (id) {
          e.preventDefault();
          void s.moveCanvas(id, scopeFolderId);
        }
      }}
    >
      {/* Keyed so each place you go arrives with its own entrance. */}
      <div className="library-content view-enter" key={`${s.libraryScope}:${s.currentFolderId}`}>
        <header className="library-heading">
          <div>
            <h1>{title}</h1>
            <p>
              {s.libraryScope === "all"
                ? s.canvases.length
                  ? `${pluralize(s.canvases.length, "board")} on this device. Pick one up, or start something new.`
                  : "Everything you make stays on this device."
                : `${pluralize(visible.length, "board")}${folders.length ? ` · ${pluralize(folders.length, "folder")}` : ""}`}
            </p>
          </div>
          <div className="library-actions">
            <button className="btn btn-soft press" onClick={() => void s.importFiles()}>
              <Import size={15} />
              Import
            </button>
            <button className="btn btn-soft press" onClick={() => edit({ kind: "new-folder" })}>
              <FolderPlus size={15} />
              New folder
            </button>
            <button className="btn btn-primary press" onClick={s.openNewCanvasDialog}>
              <Plus size={16} strokeWidth={2.2} />
              New board
              <kbd>{mod("N")}</kbd>
            </button>
          </div>
        </header>

        {s.libraryScope === "all" && !needle && (
          <div className="template-strip" aria-label="Start from a template">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.id}
                className="template-chip press stagger"
                style={{ ["--i" as string]: i }}
                title={t.blurb}
                onClick={() => startFromTemplate(t.id)}
              >
                <span>
                  <TemplateIcon id={t.id} />
                </span>
                {t.name}
              </button>
            ))}
          </div>
        )}

        {(folders.length > 0 || editing?.kind === "new-folder") && (
          <div className="library-folders">
            {editing?.kind === "new-folder" && (
              <div className="library-folder is-editing">
                <div className="folder-open">
                  <Folder size={20} strokeWidth={1.4} />
                  <span>{nameField("New folder name")}</span>
                </div>
              </div>
            )}
            {folders.map((folder, i) => (
              <div
                className="library-folder stagger"
                style={{ ["--i" as string]: i }}
                key={folder.id}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(BOARD_MIME)) {
                    e.preventDefault();
                    e.currentTarget.classList.add("drop-active");
                  }
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove("drop-active")}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("drop-active");
                  const id = e.dataTransfer.getData(BOARD_MIME);
                  if (id) void s.moveCanvas(id, folder.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, folder });
                }}
              >
                {editing?.kind === "folder" && editing.id === folder.id ? (
                  <div className="folder-open">
                    <Folder size={20} strokeWidth={1.4} />
                    <span>{nameField("Folder name")}</span>
                  </div>
                ) : (
                  <button
                    className="folder-open"
                    onClick={() => void goHome(folder.id, "folder")}
                  >
                    <Folder size={20} strokeWidth={1.4} />
                    <span>
                      <strong>{folder.name}</strong>
                      <small>
                        {pluralize(
                          s.canvases.filter((b) => b.folderId === folder.id).length,
                          "board",
                        )}
                      </small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                )}
                <button
                  className="folder-menu"
                  aria-label={`Actions for ${folder.name}`}
                  onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, folder })}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="library-toolbar">
          <h2>
            {s.libraryScope === "all" ? "Boards" : title} <span>{visible.length}</span>
          </h2>
          <label className="library-search">
            <Search size={14} />
            <input
              aria-label="Filter boards and folders"
              placeholder="Filter…"
              value={query}
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Sort boards"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="recent">Last edited</option>
            <option value="name">Name A–Z</option>
            <option value="oldest">Oldest first</option>
          </select>
          <div className="library-view-toggle">
            <button
              aria-label="Grid view"
              aria-pressed={s.libraryView === "grid"}
              onClick={() => s.setLibraryView("grid")}
            >
              <Grid2X2 size={15} />
            </button>
            <button
              aria-label="List view"
              aria-pressed={s.libraryView === "list"}
              onClick={() => s.setLibraryView("list")}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {visible.length ? (
          <div className={`board-collection view-${s.libraryView}`}>
            {visible.map((board, i) => (
              <article
                className="board-card stagger"
                style={{ ["--i" as string]: i }}
                key={board.id}
                draggable={!(editing?.kind === "board" && editing.id === board.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(BOARD_MIME, board.id);
                  e.dataTransfer.setData("text/plain", board.name);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, board });
                }}
              >
                <button
                  className="board-open"
                  onClick={(e) => {
                    // The preview is what grows into the board.
                    const preview = e.currentTarget.querySelector<HTMLElement>(".board-preview");
                    preview?.style.setProperty("view-transition-name", "board-stage");
                    void openBoard(board.id).finally(() =>
                      preview?.style.removeProperty("view-transition-name"),
                    );
                  }}
                >
                  <BoardPreview id={board.id} revision={board.updatedAt} />
                  <div className="board-card-copy">
                    <div className="board-name">
                      {editing?.kind === "board" && editing.id === board.id ? (
                        nameField("Board name")
                      ) : (
                        <strong>{board.name}</strong>
                      )}
                      {board.isPinned && <Pin size={12} aria-label="Pinned" />}
                    </div>
                    <span className="board-meta">
                      {s.libraryScope !== "folder" && board.folderId && (
                        <>{folderPath(s.folders, board.folderId)} · </>
                      )}
                      {formatRelativeTime(board.updatedAt)}
                    </span>
                  </div>
                </button>
                <button
                  className="board-menu"
                  aria-label={`Actions for ${board.name}`}
                  onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, board })}
                >
                  <MoreHorizontal size={17} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="library-empty">
            <div className="empty-mark">
              <Folder size={24} strokeWidth={1.4} />
            </div>
            <h3>{needle ? "Nothing by that name" : "Nothing here yet"}</h3>
            <p>
              {needle
                ? "Try a different word, or look in another folder."
                : "Start a board, import an Excalidraw file, or drag boards in from the sidebar."}
            </p>
            {!needle && (
              <button className="btn btn-primary press" onClick={s.openNewCanvasDialog}>
                <Plus size={15} strokeWidth={2.2} />
                New board
              </button>
            )}
          </div>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={
            menuBoard
              ? boardMenuItems(menuBoard, {
                  onRename: () => edit({ kind: "board", id: menuBoard.id }, menuBoard.name),
                })
              : menu.folder
                ? [
                    {
                      label: "Open folder",
                      icon: <Folder size={14} />,
                      onClick: () => void goHome(menu.folder!.id, "folder"),
                    },
                    {
                      label: "Rename",
                      icon: <PenLine size={14} />,
                      onClick: () =>
                        edit({ kind: "folder", id: menu.folder!.id }, menu.folder!.name),
                    },
                    {
                      label: "Remove folder · keep boards",
                      danger: true,
                      separator: true,
                      icon: <Trash2 size={14} />,
                      onClick: () => void s.removeFolder(menu.folder!.id),
                    },
                  ]
                : []
          }
        />
      )}
    </section>
  );
}
