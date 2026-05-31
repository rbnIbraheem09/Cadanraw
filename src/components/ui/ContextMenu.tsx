import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

// Lightweight right-click menu. Closes on any outside mousedown, Esc, or blur.
export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
    };
  }, [onClose]);

  // Keep the menu on-screen.
  const left = Math.min(x, window.innerWidth - 176);
  const top = Math.min(y, window.innerHeight - (items.length * 34 + 12));

  return createPortal(
    <div
      className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-edge bg-overlay py-1 shadow-2xl"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`flex w-full items-center px-3 py-1.5 text-left text-[13px] transition-colors ${
            item.danger
              ? "text-red-400 hover:bg-red-500/10"
              : "text-ink-dim hover:bg-raised hover:text-ink"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
