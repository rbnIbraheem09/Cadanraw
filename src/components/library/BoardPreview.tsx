import { useEffect, useRef, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import type { CanvasPreviewElement } from "../../types/canvas";
const cache = new Map<string, CanvasPreviewElement[]>();
export default function BoardPreview({
  id,
  revision,
}: {
  id: string;
  revision: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<CanvasPreviewElement[] | null>(null);
  useEffect(() => {
    let alive = true;
    const key = `${id}:${revision}`;
    setElements(cache.get(key) || null);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      if (cache.has(key)) return;
      void window.excali.canvases
        .preview(id)
        .then((result) => {
          if (cache.size > 150) cache.clear();
          cache.set(key, result);
          if (alive) setElements(result);
        })
        .catch(() => {
          if (alive) setElements([]);
        });
    });
    if (ref.current) observer.observe(ref.current);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [id, revision]);
  const visible =
    elements?.filter((e) => e.width < 50000 && e.height < 50000) || [];
  const x = visible.length ? Math.min(...visible.map((e) => e.x)) : 0,
    y = visible.length ? Math.min(...visible.map((e) => e.y)) : 0;
  const w = visible.length
      ? Math.max(...visible.map((e) => e.x + e.width)) - x
      : 1,
    h = visible.length
      ? Math.max(...visible.map((e) => e.y + e.height)) - y
      : 1;
  const pad = Math.max(w, h) * 0.08 + 10;
  return (
    <div className="board-preview" ref={ref} aria-hidden="true">
      {visible.length ? (
        <svg
          viewBox={`${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {visible.map((e) => {
            const color =
              e.stroke === "transparent"
                ? "#9cb2c6"
                : e.stroke === "#1e1e1e"
                  ? "#b0c2d4"
                  : e.stroke;
            if (e.kind)
              return (
                <g key={e.id}>
                  <rect
                    x={e.x}
                    y={e.y}
                    width={e.width}
                    height={e.height}
                    rx={Math.min(e.width, e.height) * 0.06}
                    fill={e.kind === "note" ? "#293a4c" : "#1c2936"}
                    stroke="#7189a333"
                  />
                  <text
                    x={e.x + e.width * 0.06}
                    y={e.y + e.height * 0.15}
                    fill="#d8e2ed"
                    fontSize={Math.min(e.width * 0.07, e.height * 0.12)}
                  >
                    {e.text?.slice(0, 28)}
                  </text>
                </g>
              );
            if (e.type === "text")
              return (
                <text
                  key={e.id}
                  x={e.x}
                  y={e.y + Math.min(e.height, 24)}
                  fill={color}
                  fontSize={Math.min(e.height, 24)}
                >
                  {e.text?.split("\n")[0]}
                </text>
              );
            if (e.points)
              return (
                <polyline
                  key={e.id}
                  points={e.points
                    .map((p) => `${e.x + p[0]},${e.y + p[1]}`)
                    .join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              );
            if (e.type === "ellipse")
              return (
                <ellipse
                  key={e.id}
                  cx={e.x + e.width / 2}
                  cy={e.y + e.height / 2}
                  rx={e.width / 2}
                  ry={e.height / 2}
                  fill={e.background}
                  stroke={color}
                  vectorEffect="non-scaling-stroke"
                />
              );
            return (
              <rect
                key={e.id}
                x={e.x}
                y={e.y}
                width={e.width}
                height={e.height}
                rx={8}
                fill={e.type === "image" ? "#293541" : e.background}
                stroke={color}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      ) : (
        <div className="preview-empty">
          <LayoutTemplate size={23} strokeWidth={1.2} />
          <span>{elements ? "Room for an idea" : "Loading preview"}</span>
        </div>
      )}
    </div>
  );
}
