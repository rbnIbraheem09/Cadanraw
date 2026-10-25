import { useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { connectRoom } from "../../lib/collaboration";
import {
  blockData,
  updateBlock,
  insertBlock,
  type BlockKind,
} from "../../lib/blocks";
import { syncDotGrid } from "../../lib/canvas-surface";
import CanvasBlock from "../blocks/CanvasBlock";

export default function SharedCanvas() {
  const params = new URLSearchParams(location.hash.slice(1));
  const room = params.get("room");
  const key = params.get("key");
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState("Connecting…");
  const [readOnly, setReadOnly] = useState(true);
  const [username, setUsername] = useState(
    () => localStorage.getItem("cadanraw-guest-name") || "Guest",
  );
  const [kind, setKind] = useState<BlockKind>("note");
  const [link, setLink] = useState("");
  const [joined, setJoined] = useState(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!api || !room || !key || !joined) return;
    return connectRoom(
      { base: location.origin, id: room, key },
      api,
      username,
      (message, view) => {
        setStatus(message);
        if (view !== undefined) setReadOnly(view);
      },
      pointer,
    );
  }, [api, room, key, joined]);
  if (!room || !key)
    return (
      <div className="shared-welcome">
        <h1>Cadanraw</h1>
        <p>Open a shared canvas link to work together.</p>
      </div>
    );
  if (!joined)
    return (
      <form
        className="shared-welcome"
        onSubmit={(e) => {
          e.preventDefault();
          localStorage.setItem(
            "cadanraw-guest-name",
            username.trim() || "Guest",
          );
          setJoined(true);
        }}
      >
        <h1>A little room to think together.</h1>
        <p>Choose the name others will see beside your cursor.</p>
        <input
          autoFocus
          aria-label="Your name"
          maxLength={40}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <button className="panel-primary">Join canvas →</button>
        <small>Anyone with an edit link can change this canvas.</small>
      </form>
    );
  return (
    <div className="shared-app">
      <header>
        <strong>
          Cadanraw <span>/ Shared canvas</span>
        </strong>
        <span role="status">{status}</span>
        {!readOnly && (
          <form
            className="shared-insert"
            onSubmit={(e) => {
              e.preventDefault();
              if (api) insertBlock(api, kind, link);
            }}
          >
            <select
              aria-label="Insert block"
              value={kind}
              onChange={(e) => setKind(e.target.value as BlockKind)}
            >
              <option value="kanban">Kanban</option>
              <option value="file">Attachment</option>
              <option value="note">Note</option>
              <option value="checklist">Checklist</option>
              <option value="table">Table</option>
              <option value="calendar">Calendar</option>
              <option value="link">Link / video</option>
            </select>
            {kind === "link" && (
              <input
                aria-label="Link URL"
                type="url"
                required
                pattern="https?://.*"
                placeholder="https://…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            )}
            <button>+ Add</button>
          </form>
        )}
        <button
          onClick={() => {
            setJoined(false);
            setReadOnly(true);
          }}
        >
          Leave
        </button>
      </header>
      <div className="shared-editor dot-surface" ref={surfaceRef}>
        <Excalidraw
          theme="dark"
          initialData={{ appState: { viewBackgroundColor: "transparent" } }}
          onChange={(_elements, state) =>
            syncDotGrid(surfaceRef.current, state)
          }
          excalidrawAPI={setApi}
          isCollaborating
          viewModeEnabled={readOnly}
          onPointerUpdate={(p) => {
            pointer.current = p.pointer;
          }}
          onLinkOpen={(element, event) => {
            const data = blockData(element);
            if (data) {
              event.preventDefault();
              if (data.url) {
                if (window.excali) void window.excali.openExternal(data.url);
                else window.open(data.url, "_blank", "noopener,noreferrer");
              }
            }
          }}
          renderEmbeddable={(element) => {
            const data = blockData(element);
            return data ? (
              <CanvasBlock
                data={data}
                readOnly={readOnly}
                onChange={(patch) => {
                  if (api && !readOnly) updateBlock(api, element.id, patch);
                }}
                resolveMetadata={async (url) => {
                  const response = await fetch(
                    `${location.origin}/api/rooms/${room}/link-metadata`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${key}`,
                      },
                      body: JSON.stringify({ url }),
                      signal: AbortSignal.timeout(12000),
                    },
                  );
                  return response.ok ? response.json() : null;
                }}
              />
            ) : null;
          }}
          validateEmbeddable={(link) =>
            link === "https://cadanraw.local/block" ? true : undefined
          }
        />
      </div>
    </div>
  );
}
