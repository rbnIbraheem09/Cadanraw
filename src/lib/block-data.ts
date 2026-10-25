export const BLOCK_KINDS = [
  "note",
  "checklist",
  "table",
  "calendar",
  "link",
  "kanban",
  "file",
  "board",
] as const;
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export interface Attachment {
  name: string;
  size: number;
  dataURL: string;
}
export interface KanbanColumn {
  id: string;
  title: string;
  cards: { id: string; text: string }[];
}
function parseColumns(raw: unknown): KanbanColumn[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const cardIds = new Set<string>();
  return raw
    .filter(
      (c) => c && typeof c.id === "string" && !ids.has(c.id) && !!ids.add(c.id),
    )
    .slice(0, 12)
    .map((c) => ({
      id: c.id,
      title: typeof c.title === "string" ? c.title : "Column",
      cards: Array.isArray(c.cards)
        ? c.cards
            .filter(
              (v: any) =>
                v &&
                typeof v.id === "string" &&
                typeof v.text === "string" &&
                !cardIds.has(v.id) &&
                !!cardIds.add(v.id),
            )
            .map((v: any) => ({ id: v.id, text: v.text }))
        : [],
    }));
}
function parseAttachment(raw: any): Attachment | undefined {
  if (
    !raw ||
    typeof raw.name !== "string" ||
    typeof raw.dataURL !== "string" ||
    !Number.isInteger(raw.size) ||
    raw.size < 0 ||
    raw.size > MAX_ATTACHMENT_BYTES
  )
    return;
  // Downloads always use a binary Blob; never navigate to untrusted data URLs.
  if (!/^data:[\w.+/-]*;base64,[A-Za-z0-9+/]*={0,2}$/.test(raw.dataURL)) return;
  const payload = raw.dataURL.slice(raw.dataURL.indexOf(",") + 1);
  const size =
    (payload.length * 3) / 4 -
    (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
  if (payload.length % 4 !== 0 || size !== raw.size) return;
  return {
    name:
      raw.name.replace(/[\/\\\x00-\x1f]/g, "_").slice(0, 240) || "Attachment",
    size: raw.size,
    dataURL: raw.dataURL,
  };
}
/** Move one task without changing other cards, rejecting stale drag targets. */
export function moveKanbanCard(
  columns: KanbanColumn[],
  cardId: string,
  targetId: string,
): KanbanColumn[] {
  const source = columns.find((c) =>
    c.cards.some((card) => card.id === cardId),
  );
  const target = columns.find((c) => c.id === targetId);
  if (!source || !target || source === target) return columns;
  const card = source.cards.find((card) => card.id === cardId)!;
  return columns.map((c) =>
    c === source
      ? { ...c, cards: c.cards.filter((v) => v.id !== cardId) }
      : c === target
        ? { ...c, cards: [...c.cards, card] }
        : c,
  );
}
export type BlockKind =
  | "note"
  | "checklist"
  | "table"
  | "calendar"
  | "link"
  | "kanban"
  | "file"
  | "board";
export interface BlockData {
  kind: BlockKind;
  title: string;
  text: string;
  items: { id: string; text: string; done: boolean }[];
  rows: string[][];
  month: string;
  events: Record<string, string>;
  url: string;
  color: string;
  preview?: string;
  metadataLoaded?: boolean;
  createdAt?: number;
  columns: KanbanColumn[];
  boardId: string;
  attachment?: Attachment;
}
export function parseBlockData(raw: any): BlockData | undefined {
  if (!raw || typeof raw !== "object" || !BLOCK_KINDS.includes(raw.kind))
    return undefined;
  return {
    kind: raw.kind,
    columns: parseColumns(raw.columns),
    boardId: typeof raw.boardId === "string" ? raw.boardId : "",
    attachment: parseAttachment(raw.attachment),
    title: typeof raw.title === "string" ? raw.title : "Untitled",
    text: typeof raw.text === "string" ? raw.text : "",
    items: Array.isArray(raw.items)
      ? raw.items
          .filter(
            (i: BlockData["items"][number]) =>
              i && typeof i.id === "string" && typeof i.text === "string",
          )
          .map((i: BlockData["items"][number]) => ({
            ...i,
            done: i.done === true,
          }))
      : [],
    rows: Array.isArray(raw.rows)
      ? raw.rows
          .filter(Array.isArray)
          .map((row: unknown[]) =>
            row.map((cell) => (typeof cell === "string" ? cell : "")),
          )
      : [],
    month:
      typeof raw.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month)
        ? raw.month
        : new Date().toISOString().slice(0, 7),
    events:
      raw.events && typeof raw.events === "object"
        ? Object.fromEntries(
            Object.entries(raw.events).filter(([, v]) => typeof v === "string"),
          )
        : {},
    url:
      typeof raw.url === "string" && /^https?:\/\//i.test(raw.url)
        ? raw.url
        : "",
    color: [
      "slate",
      "charcoal",
      "sage",
      "sand",
      "rose",
      "peach",
      "lavender",
    ].includes(raw.color)
      ? raw.color
      : "charcoal",
    preview:
      typeof raw.preview === "string" &&
      /^data:image\/(png|jpeg|webp|gif);base64,/.test(raw.preview)
        ? raw.preview
        : undefined,
    metadataLoaded: raw.metadataLoaded === true,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : undefined,
  } as BlockData;
}
