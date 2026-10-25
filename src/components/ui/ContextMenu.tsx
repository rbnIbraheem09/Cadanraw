import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: ReactNode;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
}
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
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect)
      setPoint({
        left: Math.max(8, Math.min(x, innerWidth - rect.width - 8)),
        top: Math.max(8, Math.min(y, innerHeight - rect.height - 8)),
      });
  }, [x, y, items.length]);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const blur = () => onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", blur);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", blur);
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Actions"
      className="cadanraw-context-menu"
      style={point}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        const buttons = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          onClose();
          return;
        }
        let next = -1;
        if (e.key === "ArrowDown") next = (i + 1) % buttons.length;
        if (e.key === "ArrowUp")
          next = (i - 1 + buttons.length) % buttons.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = buttons.length - 1;
        if (next >= 0) {
          e.preventDefault();
          buttons[next]?.focus();
        }
      }}
    >
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className={item.separator ? "menu-section" : ""}
        >
          <button
            role="menuitem"
            disabled={item.disabled}
            className={item.danger ? "is-danger" : ""}
            onClick={() => {
              onClose();
              item.onClick();
            }}
          >
            {item.icon && <span className="menu-icon">{item.icon}</span>}
            <span>{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
