import {
  ArrowUpRight,
  Copy,
  Download,
  FolderInput,
  PenLine,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import type { ContextMenuItem } from "../components/ui/ContextMenu";
import { useStore } from "../store/excaliStore";
import type { CanvasMeta } from "../types/canvas";
import { withViewTransition } from "./motion";

/** Open a board with the library-to-canvas transition. */
export function openBoard(id: string) {
  return withViewTransition(() => useStore.getState().openCanvas(id));
}

/** Back to the library, with the same transition in reverse. */
export function goHome(...args: Parameters<ReturnType<typeof useStore.getState>["goHome"]>) {
  return withViewTransition(() => useStore.getState().goHome(...args));
}

/** One menu for a board, wherever it's listed (sidebar, library, title bar). */
export function boardMenuItems(
  board: CanvasMeta,
  { onRename, includeOpen = true }: { onRename: () => void; includeOpen?: boolean },
): ContextMenuItem[] {
  const s = useStore.getState();
  return [
    ...(includeOpen
      ? [
          {
            label: "Open",
            icon: <ArrowUpRight size={14} />,
            onClick: () => void openBoard(board.id),
          },
        ]
      : []),
    {
      label: board.isPinned ? "Unpin" : "Pin",
      icon: board.isPinned ? <PinOff size={14} /> : <Pin size={14} />,
      onClick: () => void s.togglePin(board.id),
    },
    { label: "Rename", icon: <PenLine size={14} />, onClick: onRename },
    {
      label: "Move to folder…",
      icon: <FolderInput size={14} />,
      onClick: () => s.setMovingCanvas(board.id),
    },
    {
      label: "Duplicate",
      icon: <Copy size={14} />,
      onClick: () => void s.duplicateCanvas(board.id),
    },
    {
      label: "Export…",
      icon: <Download size={14} />,
      shortcut: includeOpen ? undefined : "⌘E",
      onClick: () => void s.requestExport(board.id),
    },
    {
      label: "Delete",
      danger: true,
      separator: true,
      icon: <Trash2 size={14} />,
      onClick: () => s.requestDelete(board.id),
    },
  ];
}
