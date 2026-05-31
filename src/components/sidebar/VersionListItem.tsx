import { useState, type MouseEvent } from "react";
import ContextMenu from "../ui/ContextMenu";
import { useStore } from "../../store/excaliStore";
import { formatRelativeTime, pluralize } from "../../lib/format";
import type { VersionMeta } from "../../types/version";

export default function VersionListItem({ version }: { version: VersionMeta }) {
  const isPreviewing = useStore((s) => s.previewVersionId === version.id);
  const preview = useStore((s) => s.previewVersion);
  const restore = useStore((s) => s.restoreVersion);
  const remove = useStore((s) => s.deleteVersion);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        onClick={() => preview(version.id)}
        onContextMenu={onContextMenu}
        className={`group flex cursor-default flex-col gap-0.5 rounded-lg px-2.5 py-1.5 transition-colors ${
          isPreviewing ? "bg-accent-soft" : "hover:bg-raised"
        }`}
      >
        <span
          className={`truncate text-[12.5px] ${
            version.description
              ? "font-medium text-ink-dim group-hover:text-ink"
              : "text-ink-muted group-hover:text-ink-dim"
          }`}
        >
          {version.description ?? "Auto-save"}
        </span>
        <span className="truncate font-mono text-[10px] text-ink-muted">
          {formatRelativeTime(version.createdAt)} ·{" "}
          {pluralize(version.elementCount, "element")}
        </span>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Restore this version", onClick: () => restore(version.id) },
            { label: "Delete", danger: true, onClick: () => remove(version.id) },
          ]}
        />
      )}
    </>
  );
}
