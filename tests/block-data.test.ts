import { describe, it, expect } from "vitest";
import {
  parseBlockData,
  moveKanbanCard,
  MAX_ATTACHMENT_BYTES,
} from "../src/lib/block-data";

describe("portable rich block data", () => {
  it("loads existing notes without losing text and supplies the new defaults", () => {
    const note = parseBlockData({
      kind: "note",
      title: "Keep me",
      text: "Existing content",
      items: [],
      rows: [],
      month: "2026-10",
    });
    expect(note).toMatchObject({
      title: "Keep me",
      text: "Existing content",
      columns: [],
      boardId: "",
      month: "2026-10",
    });
    expect(parseBlockData({ kind: "unsupported" })).toBeUndefined();
  });
  it("round trips references and binary attachments while rejecting corrupt, oversized or executable data URLs", () => {
    const attachment = {
      name: "reference.pdf",
      size: 3,
      dataURL: "data:application/octet-stream;base64,YWJj",
    };
    expect(
      parseBlockData(JSON.parse(JSON.stringify({ kind: "file", attachment })))
        ?.attachment,
    ).toEqual(attachment);
    for (const invalid of [
      { ...attachment, size: 2 },
      { ...attachment, size: MAX_ATTACHMENT_BYTES + 1 },
      { ...attachment, dataURL: "data:text/html,<script>alert(1)</script>" },
      { ...attachment, dataURL: "javascript:alert(1)" },
    ])
      expect(
        parseBlockData({ kind: "file", attachment: invalid })?.attachment,
      ).toBeUndefined();
    expect(
      parseBlockData({
        kind: "board",
        boardId: "local-board",
        title: "Research",
      })?.boardId,
    ).toBe("local-board");
    expect(
      parseBlockData({
        kind: "file",
        attachment: { ...attachment, name: "../secret\n.pdf" },
      })?.attachment?.name,
    ).toBe(".._secret_.pdf");
  });
  it("filters malformed and duplicate task IDs from imported boards", () => {
    const data = parseBlockData({
      kind: "kanban",
      columns: [
        {
          id: "a",
          title: "Work",
          cards: [
            { id: "1", text: "Keep" },
            { id: "1", text: "Duplicate" },
            null,
          ],
        },
        { id: "a", title: "Duplicate" },
        { id: "b", cards: [{ id: "1", text: "Duplicate" }] },
      ],
    });
    expect(data?.columns).toEqual([
      { id: "a", title: "Work", cards: [{ id: "1", text: "Keep" }] },
      { id: "b", title: "Column", cards: [] },
    ]);
  });
  it("moves tasks once, preserves other edits, and ignores stale targets", () => {
    const columns = [
      {
        id: "todo",
        title: "To do",
        cards: [
          { id: "a", text: "Ship" },
          { id: "b", text: "Review" },
        ],
      },
      { id: "done", title: "Done", cards: [] },
    ];
    const moved = moveKanbanCard(columns, "a", "done");
    expect(moved[0].cards).toEqual([{ id: "b", text: "Review" }]);
    expect(moved[1].cards).toEqual([{ id: "a", text: "Ship" }]);
    expect(columns[0].cards).toHaveLength(2);
    expect(moveKanbanCard(moved, "a", "done")).toBe(moved);
    expect(moveKanbanCard(moved, "missing", "done")).toBe(moved);
    expect(moveKanbanCard(moved, "b", "deleted-column")).toBe(moved);
  });
});
