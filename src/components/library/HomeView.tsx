import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Folder,
  FolderPlus,
  Grid2X2,
  Home,
  Import,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Pin,
  PenLine,
  Copy,
  FolderInput,
  Download,
  Trash2,
} from "lucide-react";
import { useStore } from "../../store/excaliStore";
import { folderPath, folderTrail } from "../../lib/folders";
import { formatRelativeTime, pluralize } from "../../lib/format";
import type { CanvasMeta, FolderMeta } from "../../types/canvas";
import ContextMenu from "../ui/ContextMenu";
import BoardPreview from "./BoardPreview";
export default function HomeView() {
  const s = useStore();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [newFolder, setNewFolder] = useState(false);
  const [name, setName] = useState("");
  const [renamingBoard, setRenamingBoard] = useState<CanvasMeta | null>(null);
  const [editing, setEditing] = useState<FolderMeta | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    board?: CanvasMeta;
    folder?: FolderMeta;
  } | null>(null);
  const trail = folderTrail(s.folders, s.currentFolderId);
  const title =
    s.libraryScope === "pinned"
      ? "Pinned boards"
      : s.libraryScope === "folder"
        ? trail[trail.length - 1]?.name || "Unfiled"
        : "Your workspace";
  const visible = useMemo(
    () =>
      s.canvases
        .filter(
          (b) =>
            (s.libraryScope === "all" ||
              (s.libraryScope === "pinned"
                ? b.isPinned
                : b.folderId === s.currentFolderId)) &&
            b.name.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "oldest"
              ? a.updatedAt.localeCompare(b.updatedAt)
              : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [s.canvases, s.currentFolderId, s.libraryScope, query, sort],
  );
  const folders =
    s.libraryScope === "pinned"
      ? []
      : s.folders.filter(
          (f) =>
            f.parentId ===
              (s.libraryScope === "folder" ? s.currentFolderId : null) &&
            f.name.toLowerCase().includes(query.toLowerCase()),
        );
  const board = s.canvases.find((b) => b.id === menu?.board?.id);
  return (
    <section
      className="library-home"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-cadanraw-board"))
          e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.defaultPrevented) return;
        const id = e.dataTransfer.getData("application/x-cadanraw-board");
        if (id) {
          e.preventDefault();
          void s.moveCanvas(
            id,
            s.libraryScope === "folder" ? s.currentFolderId : null,
          );
        }
      }}
    >
      <div className="library-content">
        <nav className="library-breadcrumb" aria-label="Location">
          <button onClick={() => void s.goHome()}>
            <Home size={13} /> Workspace
          </button>
          {s.libraryScope === "folder" &&
            (trail.length ? (
              trail.map((f) => (
                <span key={f.id}>
                  <ChevronRight size={12} />
                  <button onClick={() => void s.goHome(f.id, "folder")}>
                    {f.name}
                  </button>
                </span>
              ))
            ) : (
              <span>
                <ChevronRight size={12} />
                Unfiled
              </span>
            ))}
        </nav>
        <header className="library-heading">
          <div>
            <p className="library-eyebrow">A PLACE FOR YOUR IDEAS</p>
            <h1>{title}</h1>
            <p>
              {s.libraryScope === "all"
                ? "Sketch, collect, and keep your projects within reach."
                : `${visible.length} ${visible.length === 1 ? "board" : "boards"}${folders.length ? ` · ${folders.length} folders` : ""}`}
            </p>
          </div>
          <div className="library-actions">
            <button onClick={() => void s.importFiles()}>
              <Import size={15} />
              Import
            </button>
            <button
              onClick={() => {
                setNewFolder(true);
                setEditing(null);
                setRenamingBoard(null);
                setName("");
              }}
            >
              <FolderPlus size={15} />
              New folder
            </button>
            <button
              className="new-board-action"
              onClick={s.openNewCanvasDialog}
            >
              <Plus size={16} />
              New board
            </button>
          </div>
        </header>
        {(newFolder || editing || renamingBoard) && (
          <form
            className="folder-create"
            onSubmit={async (e) => {
              e.preventDefault();
              if (renamingBoard) await s.renameCanvas(renamingBoard.id, name);
              else if (editing) await s.renameFolder(editing.id, name);
              else
                await s.createFolder(
                  name,
                  s.libraryScope === "folder" ? s.currentFolderId : null,
                );
              setNewFolder(false);
              setEditing(null);
              setRenamingBoard(null);
              setName("");
            }}
          >
            <Folder size={17} />
            <input
              autoFocus
              aria-label={
                renamingBoard
                  ? "Board name"
                  : editing
                    ? "Rename folder"
                    : "Folder name"
              }
              placeholder="Name this folder…"
              value={name}
              maxLength={200}
              required
              onChange={(e) => setName(e.target.value)}
            />
            <button className="panel-primary">
              {editing || renamingBoard ? "Save" : "Create folder"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewFolder(false);
                setEditing(null);
                setRenamingBoard(null);
              }}
            >
              Cancel
            </button>
          </form>
        )}
        {folders.length > 0 && (
          <div className="library-folders">
            {folders.map((folder) => (
              <div
                className="library-folder"
                key={folder.id}
                onDragOver={(e) => {
                  if (
                    e.dataTransfer.types.includes(
                      "application/x-cadanraw-board",
                    )
                  ) {
                    e.preventDefault();
                    e.currentTarget.classList.add("drop-active");
                  }
                }}
                onDragLeave={(e) =>
                  e.currentTarget.classList.remove("drop-active")
                }
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("drop-active");
                  const id = e.dataTransfer.getData(
                    "application/x-cadanraw-board",
                  );
                  if (id) void s.moveCanvas(id, folder.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, folder });
                }}
              >
                <button
                  className="folder-open"
                  onClick={() => void s.goHome(folder.id, "folder")}
                >
                  <Folder size={22} strokeWidth={1.3} />
                  <span>
                    <strong>{folder.name}</strong>
                    <small>
                      {pluralize(
                        s.canvases.filter((b) => b.folderId === folder.id)
                          .length,
                        "board",
                      )}
                    </small>
                  </span>
                  <ChevronRight size={14} />
                </button>
                <button
                  className="folder-menu"
                  aria-label={`Actions for ${folder.name}`}
                  onClick={(e) =>
                    setMenu({ x: e.clientX, y: e.clientY, folder })
                  }
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="library-toolbar">
          <h2>
            {s.libraryScope === "pinned" ? "Pinned" : "Boards"}{" "}
            <span>{visible.length}</span>
          </h2>
          <div className="library-search">
            <Search size={14} />
            <input
              aria-label="Search boards and folders"
              placeholder="Find a board or folder…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Sort boards"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
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
              <Grid2X2 size={16} />
            </button>
            <button
              aria-label="List view"
              aria-pressed={s.libraryView === "list"}
              onClick={() => s.setLibraryView("list")}
            >
              <List size={17} />
            </button>
          </div>
        </div>
        {visible.length ? (
          <div className={`board-collection view-${s.libraryView}`}>
            {visible.map((board) => (
              <article
                className="board-card"
                key={board.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-cadanraw-board",
                    board.id,
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, board });
                }}
              >
                <button
                  className="board-open"
                  onClick={() => void s.openCanvas(board.id)}
                >
                  <BoardPreview id={board.id} revision={board.updatedAt} />
                  <div className="board-card-copy">
                    <div className="board-name">
                      <strong>{board.name}</strong>
                      {board.isPinned && <Pin size={12} />}
                      <ArrowUpRight size={14} className="board-open-arrow" />
                    </div>
                    <span className="board-location">
                      {folderPath(s.folders, board.folderId)}
                    </span>
                    <span className="board-time">
                      Edited {formatRelativeTime(board.updatedAt)} ·{" "}
                      {pluralize(board.elementCount, "element")}
                    </span>
                  </div>
                </button>
                <button
                  className="board-menu"
                  aria-label={`Actions for ${board.name}`}
                  onClick={(e) =>
                    setMenu({ x: e.clientX, y: e.clientY, board })
                  }
                >
                  <MoreHorizontal size={17} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="library-empty">
            <div className="empty-line-art">
              <Folder size={40} strokeWidth={1} />
            </div>
            <h3>
              {query
                ? "Nothing by that name."
                : "A little space to start something."}
            </h3>
            <p>
              {query
                ? "Try another search, or browse a different folder."
                : "Create a board, import an Excalidraw file, or drag boards here from the sidebar."}
            </p>
            {!query && (
              <button className="panel-primary" onClick={s.openNewCanvasDialog}>
                <Plus size={15} />
                Create a board
              </button>
            )}
          </div>
        )}
        <footer className="library-footer">
          <span>Local first. Yours to organize.</span>
          <span>
            {pluralize(s.canvases.length, "board")} ·{" "}
            {pluralize(s.folders.length, "folder")}
          </span>
        </footer>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={
            board
              ? [
                  {
                    label: board.isPinned ? "Unpin" : "Pin board",
                    icon: <Pin size={14} />,
                    onClick: () => void s.togglePin(board.id),
                  },
                  {
                    label: "Open board",
                    icon: <ArrowUpRight size={14} />,
                    onClick: () => void s.openCanvas(board.id),
                  },
                  {
                    label: "Move to folder…",
                    icon: <FolderInput size={14} />,
                    onClick: () => s.setMovingCanvas(board.id),
                  },
                  {
                    label: "Rename",
                    icon: <PenLine size={14} />,
                    onClick: () => {
                      setRenamingBoard(board);
                      setEditing(null);
                      setNewFolder(false);
                      setName(board.name);
                    },
                  },
                  {
                    label: "Duplicate",
                    icon: <Copy size={14} />,
                    onClick: () => void s.duplicateCanvas(board.id),
                  },
                  {
                    label: "Export…",
                    icon: <Download size={14} />,
                    onClick: () => void s.requestExport(board.id),
                  },
                  {
                    label: "Delete board",
                    danger: true,
                    separator: true,
                    icon: <Trash2 size={14} />,
                    onClick: () => s.requestDelete(board.id),
                  },
                ]
              : menu.folder
                ? [
                    {
                      label: "Open folder",
                      icon: <Folder size={14} />,
                      onClick: () => void s.goHome(menu.folder!.id, "folder"),
                    },
                    {
                      label: "Rename folder",
                      icon: <PenLine size={14} />,
                      onClick: () => {
                        setEditing(menu.folder!);
                        setName(menu.folder!.name);
                      },
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
