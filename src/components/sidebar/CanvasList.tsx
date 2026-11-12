import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  Home,
  Inbox,
  MoreHorizontal,
  PenLine,
  Pin,
  Trash2,
} from "lucide-react";
import CanvasListItem from "./CanvasListItem";
import ContextMenu from "../ui/ContextMenu";
import { useStore } from "../../store/excaliStore";
import { folderTrail } from "../../lib/folders";
import { goHome } from "../../lib/board-actions";
import { spring } from "../../lib/motion";
import type { FolderMeta } from "../../types/canvas";

const BOARD_MIME = "application/x-cadanraw-board";

/** The selection highlight glides between rows instead of jumping. */
const Pill = () => (
  <motion.span layoutId="sidebar-pill" className="nav-pill" transition={spring} />
);

export default function CanvasList() {
  const s = useStore(
    useShallow((s) => ({
      canvases: s.canvases,
      folders: s.folders,
      homeOpen: s.homeOpen,
      libraryScope: s.libraryScope,
      currentFolderId: s.currentFolderId,
      moveCanvas: s.moveCanvas,
      createFolder: s.createFolder,
      renameFolder: s.renameFolder,
      removeFolder: s.removeFolder,
    })),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ folder: FolderMeta; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setExpanded(
      (previous) =>
        new Set([...previous, ...folderTrail(s.folders, s.currentFolderId).map((f) => f.id)]),
    );
  }, [s.currentFolderId, s.folders]);

  const scope = s.homeOpen ? s.libraryScope : null;
  const visible = s.canvases.filter((b) =>
    s.libraryScope === "pinned"
      ? b.isPinned
      : s.libraryScope === "folder"
        ? b.folderId === s.currentFolderId
        : true,
  );

  const drop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drop-active");
    const id = e.dataTransfer.getData(BOARD_MIME);
    if (id) void s.moveCanvas(id, folderId);
  };
  const over = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(BOARD_MIME)) {
      e.preventDefault();
      e.currentTarget.classList.add("drop-active");
    }
  };
  const leave = (e: React.DragEvent) => e.currentTarget.classList.remove("drop-active");

  const renderFolder = (folder: FolderMeta, depth = 0) => {
    const children = s.folders.filter((f) => f.parentId === folder.id);
    const isOpen = expanded.has(folder.id);
    const active = scope === "folder" && s.currentFolderId === folder.id;
    return (
      <div key={folder.id}>
        <div
          className={`sidebar-folder ${active ? "is-active" : ""}`}
          style={{ paddingLeft: 6 + depth * 12 }}
          onDragOver={over}
          onDragLeave={leave}
          onDrop={(e) => drop(e, folder.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ folder, x: e.clientX, y: e.clientY });
          }}
        >
          {active && <Pill />}
          <button
            className="folder-expand"
            disabled={!children.length}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${folder.name}`}
            onClick={() =>
              setExpanded((old) => {
                const next = new Set(old);
                if (next.has(folder.id)) next.delete(folder.id);
                else next.add(folder.id);
                return next;
              })
            }
          >
            <ChevronRight size={12} className={isOpen ? "is-open" : ""} />
          </button>
          <button
            className="sidebar-folder-name"
            onClick={() => void goHome(folder.id, "folder")}
          >
            <Folder size={14} />
            {editing === folder.id ? (
              <input
                autoFocus
                aria-label="Folder name"
                value={name}
                maxLength={200}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    if (name.trim()) void s.renameFolder(folder.id, name.trim());
                    setEditing(null);
                  }
                  if (e.key === "Escape") setEditing(null);
                }}
                onBlur={() => setEditing(null)}
              />
            ) : (
              <span>{folder.name}</span>
            )}
            <small>{s.canvases.filter((b) => b.folderId === folder.id).length || ""}</small>
          </button>
          <button
            className="sidebar-folder-more"
            aria-label={`Actions for ${folder.name}`}
            onClick={(e) => setMenu({ folder, x: e.clientX, y: e.clientY })}
          >
            <MoreHorizontal size={13} />
          </button>
        </div>
        {isOpen && children.map((f) => renderFolder(f, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <nav className="sidebar-nav" aria-label="Library">
        <button
          className={scope === "all" ? "is-active" : ""}
          onClick={() => void goHome()}
        >
          {scope === "all" && <Pill />}
          <Home size={15} />
          <span>Home</span>
          <small>{s.canvases.length || ""}</small>
        </button>
        <button
          className={scope === "pinned" ? "is-active" : ""}
          onClick={() => void goHome(null, "pinned")}
        >
          {scope === "pinned" && <Pill />}
          <Pin size={15} />
          <span>Pinned</span>
          <small>{s.canvases.filter((b) => b.isPinned).length || ""}</small>
        </button>
        <button
          className={scope === "folder" && !s.currentFolderId ? "is-active" : ""}
          onClick={() => void goHome(null, "folder")}
          onDragOver={over}
          onDragLeave={leave}
          onDrop={(e) => drop(e, null)}
        >
          {scope === "folder" && !s.currentFolderId && <Pill />}
          <Inbox size={15} />
          <span>Unfiled</span>
          <small>{s.canvases.filter((b) => !b.folderId).length || ""}</small>
        </button>
      </nav>

      <div className="sidebar-section-label">
        <span>Folders</span>
        <button
          aria-label="New folder"
          title="New folder"
          onClick={() => {
            setCreating(true);
            setName("");
          }}
        >
          <FolderPlus size={13} />
        </button>
      </div>
      <div className="sidebar-folder-tree">
        {creating && (
          <form
            className="sidebar-folder is-creating"
            style={{ paddingLeft: 6 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void s.createFolder(name.trim(), null);
              setCreating(false);
            }}
          >
            <span className="folder-expand" />
            <span className="sidebar-folder-name">
              <Folder size={14} />
              <input
                autoFocus
                aria-label="New folder name"
                placeholder="Folder name"
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setCreating(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setCreating(false);
                }}
              />
            </span>
          </form>
        )}
        {s.folders.filter((f) => !f.parentId).map((f) => renderFolder(f))}
        {!s.folders.length && !creating && (
          <p className="sidebar-hint">Drag boards onto a folder to file them.</p>
        )}
      </div>

      <div className="sidebar-section-label">
        <span>
          {s.libraryScope === "pinned"
            ? "Pinned"
            : s.libraryScope === "folder"
              ? s.folders.find((f) => f.id === s.currentFolderId)?.name || "Unfiled"
              : "Boards"}
        </span>
        <small>{visible.length}</small>
      </div>
      <div className="sidebar-boards">
        {visible.map((board) => (
          <CanvasListItem key={board.id} canvas={board} />
        ))}
        {!visible.length && <p className="sidebar-hint">No boards here yet.</p>}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Open folder",
              icon: <Folder size={14} />,
              onClick: () => void goHome(menu.folder.id, "folder"),
            },
            {
              label: "Rename",
              icon: <PenLine size={14} />,
              onClick: () => {
                setEditing(menu.folder.id);
                setName(menu.folder.name);
              },
            },
            {
              label: "Remove folder · keep boards",
              danger: true,
              separator: true,
              icon: <Trash2 size={14} />,
              onClick: () => void s.removeFolder(menu.folder.id),
            },
          ]}
        />
      )}
    </>
  );
}
