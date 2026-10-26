import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createAgentServer } from "../electron/services/agent-server";
import {
  createCollaborationServer,
  mergeElements,
} from "../electron/collaboration-server";
const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }
});
async function relay() {
  const s = createCollaborationServer();
  servers.push(s);
  await new Promise<void>((resolve, reject) => {
    s.once("error", reject);
    s.listen(0, "127.0.0.1", resolve);
  });
  const address = s.address();
  if (!address || typeof address === "string") throw new Error("No address");
  return `http://127.0.0.1:${address.port}`;
}
const post = (url: string, body: unknown, key?: string) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
  });
describe("collaboration", () => {
  it("merges independent changes and keeps deletion tombstones with deterministic conflicts", () => {
    const a = { id: "a", version: 1, versionNonce: 10 };
    const b = { id: "b", version: 1, versionNonce: 20 };
    const deleted = { ...a, version: 2, isDeleted: true };
    expect(mergeElements([a, b], [deleted])).toEqual([deleted, b]);
    expect(mergeElements([deleted, b], [a])).toEqual([deleted, b]);
    const conflict = { ...b, versionNonce: 5, x: 10 };
    expect(mergeElements([b], [conflict])).toEqual(
      mergeElements([conflict], [b]),
    );
  });
  it("enforces view links and exchanges edits, files and cursors across clients", async () => {
    const base = await relay();
    const room = await (
      await post(`${base}/api/rooms`, { elements: [], files: {} })
    ).json();
    const url = `${base}/api/rooms/${room.id}/sync`;
    expect((await post(url, {}, "invalid")).status).toBe(404);
    const e = {
      id: "note",
      version: 1,
      versionNonce: 1,
      customData: { text: "shared" },
    };
    await post(
      url,
      {
        clientId: "alice",
        username: "Alice",
        elements: [e],
        files: { image: { dataURL: "data:image/png;base64,abc" } },
        pointer: { x: 12, y: 30 },
      },
      room.key,
    );
    const viewer = await (
      await post(
        url,
        { clientId: "bob", elements: [{ ...e, version: 99 }] },
        room.viewKey,
      )
    ).json();
    expect(viewer.readOnly).toBe(true);
    expect(viewer.elements).toEqual([e]);
    expect(viewer.files.image).toBeDefined();
    expect(viewer.participants.alice.pointer).toEqual({ x: 12, y: 30 });
    const next = { ...e, version: 2, isDeleted: true };
    await post(url, { elements: [next] }, room.key);
    const read = await (await post(url, {}, room.viewKey)).json();
    expect(read.elements[0].isDeleted).toBe(true);
  });
  it("persists rooms across restarts and lets only the host revoke links", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cadanraw-room-test-"));
    const start = async () => {
      const s = createCollaborationServer({ dataDir: dir });
      servers.push(s);
      await new Promise<void>((resolve, reject) => {
        s.once("error", reject);
        s.listen(0, "127.0.0.1", resolve);
      });
      const a = s.address();
      if (!a || typeof a === "string") throw new Error("No port");
      return { s, base: `http://127.0.0.1:${a.port}` };
    };
    try {
      const first = await start();
      const room = await (
        await post(`${first.base}/api/rooms`, { elements: [], files: {} })
      ).json();
      const element = { id: "persisted", version: 1, versionNonce: 5 };
      await post(
        `${first.base}/api/rooms/${room.id}/sync`,
        { elements: [element] },
        room.key,
      );
      first.s.closeAllConnections();
      await new Promise<void>((resolve) => first.s.close(() => resolve()));
      servers.splice(servers.indexOf(first.s), 1);
      const second = await start();
      const url = `${second.base}/api/rooms/${room.id}`;
      expect(
        (await (await post(`${url}/sync`, {}, room.viewKey)).json()).elements,
      ).toEqual([element]);
      expect((await post(`${url}/close`, {}, room.key)).status).toBe(404);
      expect((await post(`${url}/close`, {}, room.adminKey)).status).toBe(200);
      expect((await post(`${url}/sync`, {}, room.key)).status).toBe(404);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("rejects hostile origins, traversal and malformed room elements", async () => {
    const base = await relay();
    expect(
      (
        await fetch(`${base}/api/rooms`, {
          method: "POST",
          headers: { Origin: "https://hostile.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(`${base}/api/rooms`, {
          method: "POST",
          headers: { Origin: "not-a-url" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await post(`${base}/api/rooms`, { elements: [{ id: "bad" }] })).status,
    ).toBe(400);
    expect((await fetch(`${base}/%2e%2e%2fpackage.json`)).status).toBe(404);
  });
});
describe("agent MCP", () => {
  it("requires a token, validates origins, gates editing and revokes on stop", async () => {
    const calls: string[] = [];
    const agent = createAgentServer(async (name) => {
      calls.push(name);
      return name === "screenshot"
        ? {
            mcpContent: [
              { type: "image", data: "AA==", mimeType: "image/png" },
            ],
          }
        : { ok: true };
    });
    try {
      let info = await agent.start(false);
      expect((await post(info.url, {})).status).toBe(401);
      expect(
        (
          await fetch(info.url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${info.token}`,
              Origin: "https://hostile.example",
            },
          })
        ).status,
      ).toBe(403);
      const rpc = async (method: string, params?: unknown) =>
        (
          await post(
            info.url,
            { jsonrpc: "2.0", id: 1, method, params },
            info.token,
          )
        ).json();
      expect((await rpc("initialize")).result.capabilities.tools).toBeDefined();
      expect(
        (await rpc("tools/list")).result.tools.map(
          (t: { name: string }) => t.name,
        ),
      ).toEqual(["list_canvases", "read_canvas", "screenshot"]);
      for (const name of ["add_block", "manage_canvas", "delete_elements"])
        expect((await rpc("tools/call", { name })).result.isError).toBe(true);
      await rpc("tools/call", { name: "read_canvas" });
      expect(calls).toEqual(["read_canvas"]);
      expect(
        (await rpc("tools/call", { name: "screenshot" })).result.content[0],
      ).toEqual({ type: "image", data: "AA==", mimeType: "image/png" });
      const oldToken = info.token;
      info = await agent.start(true);
      expect(info.token).not.toBe(oldToken);
      const tools = (await rpc("tools/list")).result.tools;
      expect(tools).toHaveLength(9);
      expect(
        tools.find((t: { name: string }) => t.name === "delete_elements")
          .annotations,
      ).toEqual({ readOnlyHint: false, destructiveHint: true });
      await rpc("tools/call", {
        name: "add_block",
        arguments: { kind: "note" },
      });
      expect(calls).toContain("add_block");
      await agent.stop();
      expect(agent.status().enabled).toBe(false);
    } finally {
      await agent.stop();
    }
  });
});
