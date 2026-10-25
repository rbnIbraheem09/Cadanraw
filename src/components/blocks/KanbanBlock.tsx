import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, X } from "lucide-react";
import { moveKanbanCard, type BlockData } from "../../lib/block-data";
import BlockField from "./BlockField";

export default function KanbanBlock({
  data,
  edit,
  readOnly,
}: {
  data: BlockData;
  edit: (patch: Partial<BlockData>) => void;
  readOnly: boolean;
}) {
  const dragKey = useId();
  const [dragging, setDragging] = useState(false);
  const dragged = useRef<{ id: string; x: number; y: number } | null>(null);
  const columnNodes = useRef(new Map<string, HTMLElement>());
  const latest = useRef({ data, edit });
  latest.current = { data, edit };
  useEffect(() => {
    const finish = (event: PointerEvent) => {
      const start = dragged.current;
      if (!start) return;
      if (
        event.type === "pointerup" &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5
      ) {
        const target = [...columnNodes.current].find(([, node]) => {
          const rect = node.getBoundingClientRect();
          return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );
        });
        if (target)
          latest.current.edit({
            columns: moveKanbanCard(
              latest.current.data.columns,
              start.id,
              target[0],
            ),
          });
      }
      dragged.current = null;
      setDragging(false);
    };
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
    return () => {
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", finish, true);
    };
  }, []);
  const move = (id: string, target: string) =>
    edit({ columns: moveKanbanCard(data.columns, id, target) });
  return (
    <div className="kanban-scroll" data-task-dragging={dragging}>
      <div className="kanban-columns">
        {data.columns.map((column, index) => (
          <section
            className="kanban-column"
            key={column.id}
            ref={(node) => {
              if (node) columnNodes.current.set(column.id, node);
              else columnNodes.current.delete(column.id);
            }}
            data-kanban-owner={dragKey}
            data-column-id={column.id}
          >
            <div className="kanban-heading">
              <span className={`kanban-dot stage-${Math.min(index, 2)}`} />
              <BlockField
                label="Column title"
                value={column.title}
                readOnly={readOnly}
                onChange={(title) =>
                  edit({
                    columns: data.columns.map((c) =>
                      c.id === column.id ? { ...c, title } : c,
                    ),
                  })
                }
              />
              <small>{column.cards.length}</small>
              {!readOnly &&
                column.cards.length === 0 &&
                data.columns.length > 1 && (
                  <button
                    className="quiet-remove"
                    aria-label={`Remove ${column.title} column`}
                    onClick={() =>
                      edit({
                        columns: data.columns.filter((c) => c.id !== column.id),
                      })
                    }
                  >
                    <X size={13} />
                  </button>
                )}
            </div>
            <div className="kanban-tasks">
              {column.cards.map((card) => (
                <div className="kanban-task" key={card.id}>
                  <BlockField
                    multiline
                    label="Task"
                    placeholder="Describe this task…"
                    value={card.text}
                    readOnly={readOnly}
                    onChange={(text) =>
                      edit({
                        columns: data.columns.map((c) => ({
                          ...c,
                          cards: c.cards.map((v) =>
                            v.id === card.id ? { ...v, text } : v,
                          ),
                        })),
                      })
                    }
                  />
                  {!readOnly && (
                    <div className="task-actions">
                      <button
                        aria-label={`Drag ${card.text || "task"}`}
                        title="Drag task to another column"
                        className="task-drag-handle"
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          dragged.current = {
                            id: card.id,
                            x: e.clientX,
                            y: e.clientY,
                          };
                          setDragging(true);
                        }}
                      >
                        <GripVertical size={14} />
                      </button>
                      <span />
                      <button
                        aria-label="Move task left"
                        disabled={index === 0}
                        onClick={() =>
                          move(card.id, data.columns[index - 1].id)
                        }
                      >
                        <ArrowLeft size={13} />
                      </button>
                      <button
                        aria-label="Move task right"
                        disabled={index === data.columns.length - 1}
                        onClick={() =>
                          move(card.id, data.columns[index + 1].id)
                        }
                      >
                        <ArrowRight size={13} />
                      </button>
                      <button
                        aria-label="Remove task"
                        onClick={() =>
                          edit({
                            columns: data.columns.map((c) => ({
                              ...c,
                              cards: c.cards.filter((v) => v.id !== card.id),
                            })),
                          })
                        }
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <button
                className="block-add"
                onClick={() =>
                  edit({
                    columns: data.columns.map((c) =>
                      c.id === column.id
                        ? {
                            ...c,
                            cards: [
                              ...c.cards,
                              { id: crypto.randomUUID(), text: "" },
                            ],
                          }
                        : c,
                    ),
                  })
                }
              >
                + Add task
              </button>
            )}
          </section>
        ))}
        {!readOnly && data.columns.length < 12 && (
          <button
            className="kanban-add-column"
            onClick={() =>
              edit({
                columns: [
                  ...data.columns,
                  { id: crypto.randomUUID(), title: "New column", cards: [] },
                ],
              })
            }
          >
            + Column
          </button>
        )}
      </div>
    </div>
  );
}
