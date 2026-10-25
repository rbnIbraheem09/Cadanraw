import KanbanBlock from "./KanbanBlock";
import FileBlock from "./FileBlock";
import BoardBlock from "./BoardBlock";
import BlockField from "./BlockField";
export type MetadataResolver = (
  url: string,
) => Promise<{ title: string; image: string | null } | null>;
import { useEffect, useState, useRef } from "react";
import type { BlockData } from "../../lib/blocks";
import { youtubeId } from "../../lib/blocks";

export default function CanvasBlock({
  data,
  onChange,
  readOnly = false,
  resolveMetadata,
}: {
  data: BlockData;
  onChange: (patch: Partial<BlockData>) => void;
  readOnly?: boolean;
  resolveMetadata?: MetadataResolver;
}) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const latest = useRef({ data, onChange, resolveMetadata });
  latest.current = { data, onChange, resolveMetadata };
  const yt = youtubeId(data.url);
  useEffect(() => {
    let alive = true;
    if (
      data.kind !== "link" ||
      (data.metadataLoaded &&
        !["Link", "YouTube video"].includes(data.title)) ||
      (!window.excali && !resolveMetadata) ||
      readOnly
    )
      return;
    void (async () => {
      const resolver =
        latest.current.resolveMetadata || window.excali?.getLinkMetadata;
      const meta = resolver ? await resolver(data.url).catch(() => null) : null;
      if (!meta?.title) return; // A failed fetch remains retryable on reopening.
      const thumb =
        meta.image && window.excali && !latest.current.data.preview
          ? await window.excali.fetchImage(meta.image).catch(() => null)
          : null;
      if (alive)
        latest.current.onChange({
          metadataLoaded: true,
          ...(meta?.title &&
          ["Link", "YouTube video"].includes(latest.current.data.title)
            ? { title: meta.title }
            : {}),
          ...(thumb ? { preview: thumb.dataURL } : {}),
        });
    })();
    return () => {
      alive = false;
    };
  }, [data.kind, data.url, data.metadataLoaded, readOnly]);
  useEffect(() => {
    let alive = true;
    if (data.kind !== "link" || !yt) return;
    if (window.excali) {
      window.excali
        .fetchImage(`https://img.youtube.com/vi/${yt}/hqdefault.jpg`)
        .then((img) => {
          if (alive) setImage(img?.dataURL ?? null);
        })
        .catch(() => {});
    } else setImage(`https://img.youtube.com/vi/${yt}/hqdefault.jpg`);
    return () => {
      alive = false;
    };
  }, [data.kind, yt]);
  const open = () => {
    if (!/^https?:\/\//i.test(data.url)) return;
    if (window.excali) void window.excali.openExternal(data.url);
    else window.open(data.url, "_blank", "noopener,noreferrer");
  };
  const edit = (patch: Partial<BlockData>) => {
    if (!readOnly) onChange(patch);
  };
  return (
    <article
      className={`canvas-block block-${data.kind} tone-${data.color}`}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="block-heading">
        <BlockField
          title
          label="Block title"
          value={data.title}
          readOnly={readOnly}
          onChange={(title) => edit({ title })}
        />
        {data.kind === "checklist" && (
          <span className="block-progress">
            {data.items.filter((i) => i.done).length}/{data.items.length}
          </span>
        )}
      </div>
      {data.kind === "kanban" && (
        <KanbanBlock data={data} edit={edit} readOnly={readOnly} />
      )}
      {data.kind === "file" && (
        <FileBlock data={data} edit={edit} readOnly={readOnly} />
      )}
      {data.kind === "board" && (
        <BoardBlock data={data} edit={edit} readOnly={readOnly} />
      )}
      {data.kind === "note" && (
        <>
          <div className="note-body">
            <BlockField
              multiline
              label="Note"
              placeholder="Start writing…"
              value={data.text}
              readOnly={readOnly}
              onChange={(text) => edit({ text })}
            />
          </div>
          <div className="note-footer">
            <span>
              {data.createdAt
                ? new Date(data.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })
                : ""}
            </span>
            <div className="block-colors" aria-label="Note color">
              {["sand", "slate", "sage", "peach", "lavender", "rose"].map(
                (color) => (
                  <button
                    disabled={readOnly}
                    key={color}
                    aria-label={`${color} note`}
                    aria-pressed={color === data.color}
                    className={`swatch tone-${color}`}
                    onClick={() => edit({ color })}
                  />
                ),
              )}
            </div>
          </div>
        </>
      )}
      {data.kind === "checklist" && (
        <div className="block-scroll">
          {data.items.map((item) => (
            <div className="check-row" key={item.id}>
              <input
                aria-label={`Complete ${item.text || "item"}`}
                type="checkbox"
                checked={item.done}
                disabled={readOnly}
                onChange={(e) =>
                  edit({
                    items: data.items.map((i) =>
                      i.id === item.id ? { ...i, done: e.target.checked } : i,
                    ),
                  })
                }
              />
              <BlockField
                label="Checklist item"
                placeholder="A thing to do…"
                value={item.text}
                readOnly={readOnly}
                style={{
                  textDecoration: item.done ? "line-through" : undefined,
                }}
                onChange={(text) =>
                  edit({
                    items: data.items.map((i) =>
                      i.id === item.id ? { ...i, text } : i,
                    ),
                  })
                }
              />
              <button
                aria-label="Remove item"
                disabled={readOnly}
                onClick={() =>
                  edit({ items: data.items.filter((i) => i.id !== item.id) })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            disabled={readOnly}
            className="block-add"
            onClick={() =>
              edit({
                items: [
                  ...data.items,
                  { id: crypto.randomUUID(), text: "", done: false },
                ],
              })
            }
          >
            + Add an item
          </button>
        </div>
      )}
      {data.kind === "table" && (
        <div className="block-scroll">
          <table>
            <tbody>
              {data.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <BlockField
                        label={`Row ${r + 1}, column ${c + 1}`}
                        placeholder={r === 0 ? "Column" : "—"}
                        value={cell}
                        readOnly={readOnly}
                        onChange={(value) =>
                          edit({
                            rows: data.rows.map((rr, ri) =>
                              ri === r
                                ? rr.map((cc, ci) => (ci === c ? value : cc))
                                : rr,
                            ),
                          })
                        }
                      />
                    </td>
                  ))}
                  {!readOnly && (
                    <td>
                      <button
                        aria-label={`Remove row ${r + 1}`}
                        onClick={() =>
                          edit({ rows: data.rows.filter((_, i) => i !== r) })
                        }
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="block-table-actions">
            <button
              disabled={readOnly || !data.rows.length}
              onClick={() =>
                edit({
                  rows: [
                    ...data.rows,
                    Array(data.rows[0]?.length || 2).fill(""),
                  ],
                })
              }
            >
              + Row
            </button>
            <button
              disabled={readOnly}
              onClick={() =>
                edit({
                  rows: (data.rows.length ? data.rows : [[]]).map((r) => [
                    ...r,
                    "",
                  ]),
                })
              }
            >
              + Column
            </button>
          </div>
        </div>
      )}
      {data.kind === "calendar" && (
        <Calendar data={data} edit={edit} readOnly={readOnly} />
      )}
      {data.kind === "link" && (
        <>
          <div className="link-preview">
            {yt && playing ? (
              <iframe
                title={data.title}
                src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <button
                className="link-play"
                onClick={() => (yt ? setPlaying(true) : open())}
              >
                {(data.preview || image) && !failed && (
                  <img
                    alt={yt ? "Video thumbnail" : "Website preview"}
                    src={data.preview || image || ""}
                    onError={() => setFailed(true)}
                  />
                )}
                <span>{yt ? "▶ Play video" : "↗ Open website"}</span>
              </button>
            )}
          </div>
          <div className="link-bottom">
            <span>
              {(() => {
                try {
                  return new URL(data.url).hostname;
                } catch {
                  return "Invalid link";
                }
              })()}
            </span>
            <button onClick={open}>Open ↗</button>
          </div>
          {playing && (
            <small>Video unavailable? Use Open to watch in your browser.</small>
          )}
        </>
      )}
    </article>
  );
}
function Calendar({
  data,
  edit,
  readOnly,
}: {
  data: BlockData;
  edit: (patch: Partial<BlockData>) => void;
  readOnly: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [year, month] = data.month.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const today = new Date();
  const move = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    edit({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
    setSelected(null);
  };
  return (
    <>
      <div className="calendar-nav">
        <button
          disabled={readOnly}
          aria-label="Previous month"
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <span>
          {first.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button
          disabled={readOnly}
          aria-label="Next month"
          onClick={() => move(1)}
        >
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <small key={i}>{d}</small>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const key = `${data.month}-${String(day).padStart(2, "0")}`;
          return (
            <button
              key={key}
              aria-pressed={selected === key}
              className={
                today.getFullYear() === year &&
                today.getMonth() === month - 1 &&
                today.getDate() === day
                  ? "today"
                  : ""
              }
              onClick={() => setSelected(key)}
            >
              {day}
              {data.events[key] && <span className="event-dot" />}
            </button>
          );
        })}
      </div>
      {selected ? (
        <BlockField
          multiline
          label={`Note for ${selected}`}
          placeholder={`Add a note for ${selected}`}
          readOnly={readOnly}
          value={data.events[selected] ?? ""}
          onChange={(text) =>
            edit({ events: { ...data.events, [selected]: text } })
          }
        />
      ) : (
        <p className="block-meta">Choose a day to add a note.</p>
      )}
    </>
  );
}
