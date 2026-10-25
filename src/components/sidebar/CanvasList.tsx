import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Home,
  Pin,
  Inbox,
  MoreHorizontal,
} from "lucide-react";
import CanvasListItem from "./CanvasListItem";
import ContextMenu from "../ui/ContextMenu";
import { useStore } from "../../store/excaliStore";
import { folderTrail } from "../../lib/folders";
import type { FolderMeta } from "../../types/canvas";
export default function CanvasList() {
  const s = useStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{
    folder: FolderMeta;
    x: number;
    y: number;
  } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    setExpanded(
      (previous) =>
        new Set([
          ...previous,
          ...folderTrail(s.folders, s.currentFolderId).map((f) => f.id),
        ]),
    );
  }, [s.currentFolderId, s.folders]);
  const query = s.searchQuery.trim().toLowerCase();
  const visible = s.canvases.filter((b) =>
    query
      ? b.name.toLowerCase().includes(query)
      : s.libraryScope === "pinned"
        ? b.isPinned
        : s.libraryScope === "folder"
          ? b.folderId === s.currentFolderId
          : true,
  );
  const drop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drop-active");
    const id = e.dataTransfer.getData("application/x-cadanraw-board");
    if (id) void s.moveCanvas(id, folderId);
  };
  const over = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-cadanraw-board")) {
      e.preventDefault();
      e.currentTarget.classList.add("drop-active");
    }
  };
  const renderFolder = (folder: FolderMeta, depth = 0) => {
    const children = s.folders.filter((f) => f.parentId === folder.id);
    const isOpen = expanded.has(folder.id);
    return (
      <div key={folder.id}>
        <div
          className={`sidebar-folder ${s.libraryScope === "folder" && s.currentFolderId === folder.id ? "is-active" : ""}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onDragOver={over}
          onDragLeave={(e) => e.currentTarget.classList.remove("drop-active")}
          onDrop={(e) => drop(e, folder.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ folder, x: e.clientX, y: e.clientY });
          }}
        >
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
            {children.length ? (
              isOpen ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )
            ) : (
              <span />
            )}
          </button>
          <button
            className="sidebar-folder-name"
            onClick={() => void s.goHome(folder.id, "folder")}
          >
            <Folder size={14} />
            {editing === folder.id ? (
              <input
                autoFocus
                aria-label="Folder name"
                value={name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    void s.renameFolder(folder.id, name);
                    setEditing(null);
                  }
                  if (e.key === "Escape") setEditing(null);
                }}
                onBlur={() => setEditing(null)}
              />
            ) : (
              <span>{folder.name}</span>
            )}
            <small>
              {s.canvases.filter((b) => b.folderId === folder.id).length}
            </small>
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
      <nav className="sidebar-library-nav" aria-label="Workspace">
        <button
          className={s.homeOpen && s.libraryScope === "all" ? "is-active" : ""}
          onClick={() => void s.goHome()}
        >
          <Home size={15} />
          Home<span>{s.canvases.length}</span>
        </button>
        <button
          className={s.libraryScope === "pinned" ? "is-active" : ""}
          onClick={() => void s.goHome(null, "pinned")}
        >
          <Pin size={14} />
          Pinned<span>{s.canvases.filter((b) => b.isPinned).length || ""}</span>
        </button>
        <button
          className={
            s.libraryScope === "folder" && !s.currentFolderId ? "is-active" : ""
          }
          onClick={() => void s.goHome(null, "folder")}
          onDragOver={over}
          onDragLeave={(e) => e.currentTarget.classList.remove("drop-active")}
          onDrop={(e) => drop(e, null)}
        >
          <Inbox size={15} />
          Unfiled<span>{s.canvases.filter((b) => !b.folderId).length}</span>
        </button>
      </nav>
      <div className="sidebar-section-label">
        <span>FOLDERS</span>
        <button onClick={() => void s.goHome()}>Manage</button>
      </div>
      <div className="sidebar-folder-tree">
        {s.folders.filter((f) => !f.parentId).map((f) => renderFolder(f))}
        {!s.folders.length && (
          <p className="sidebar-folder-hint">
            Keep each project in its own folder.
          </p>
        )}
      </div>
      <div className="sidebar-section-label">
        <span>
          {query
            ? "SEARCH RESULTS"
            : s.libraryScope === "folder"
              ? s.folders.find((f) => f.id === s.currentFolderId)?.name ||
                "UNFILED"
              : "BOARDS"}
        </span>
        <small>{visible.length}</small>
      </div>
      <div className="flex flex-col gap-0.5 px-1.5 pb-2">
        {visible.map((board) => (
          <CanvasListItem key={board.id} canvas={board} />
        ))}
        {!visible.length && (
          <p className="sidebar-folder-hint">
            {query ? "No matching boards." : "No boards here yet."}
          </p>
        )}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Open folder",
              onClick: () => void s.goHome(menu.folder.id, "folder"),
            },
            {
              label: "Rename folder",
              onClick: () => {
                setEditing(menu.folder.id);
                setName(menu.folder.name);
              },
            },
            {
              label: "Remove folder · keep boards",
              danger: true,
              separator: true,
              onClick: () => void s.removeFolder(menu.folder.id),
            },
          ]}
        />
      )}
    </>
  );
}
