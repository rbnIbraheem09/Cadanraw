import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Users } from "lucide-react";
import { useStore } from "../../store/excaliStore";
import { useUi } from "../../store/ui";
import { useLayer } from "../../hooks/useLayer";
import { closeRoom, createRoom, roomLink } from "../../lib/collaboration";
import Button from "../ui/Button";

const SERVER_KEY = "cadanraw-collab-server";

/** Start, share and end a live session for the open board. */
export default function SharePopover({ anchor }: { anchor: RefObject<HTMLElement> }) {
  const api = useStore((s) => s.api);
  const toast = useStore((s) => s.pushToast);
  const room = useUi((s) => s.room);
  const status = useUi((s) => s.roomStatus);
  const setRoom = useUi((s) => s.setRoom);
  const close = () => useUi.getState().setShareOpen(false);
  const ref = useRef<HTMLDivElement>(null);
  const [server, setServer] = useState(
    () => localStorage.getItem(SERVER_KEY) || "http://localhost:8787",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [point, setPoint] = useState<{ top: number; right: number } | null>(null);
  useLayer(true, close);

  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (r) setPoint({ top: r.bottom + 8, right: Math.max(8, innerWidth - r.right) });
  }, [anchor]);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !anchor.current?.contains(target)) close();
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [anchor]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`, "success");
    } catch {
      setError("Clipboard unavailable. Select and copy the text instead.");
    }
  };

  if (!point) return null;
  return createPortal(
    <div
      ref={ref}
      className="share-popover pop-enter"
      style={point}
      role="dialog"
      aria-label="Share this board"
    >
      <h3>
        <Users size={16} /> Work together
      </h3>
      {room ? (
        <>
          <p className="share-live">● {status || "Connecting…"}</p>
          <div className="share-actions">
            <Button variant="primary" onClick={() => void copy(roomLink(room), "Edit link")}>
              Copy edit link
            </Button>
            <Button variant="soft" onClick={() => void copy(roomLink(room, true), "View link")}>
              Copy view-only link
            </Button>
            <Button onClick={() => setRoom(null)}>Leave session</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await closeRoom(room);
                  setRoom(null);
                } catch {
                  setError("Could not revoke the shared links. Check the server connection.");
                }
              }}
            >
              End session &amp; revoke links
            </Button>
          </div>
          <p>
            Leaving only disconnects you. Shared links stay active until you end the
            session or the room expires.
          </p>
        </>
      ) : (
        <>
          <p>Invite people into this board with an edit or view-only link.</p>
          <label htmlFor="collab-server">Collaboration server</label>
          <input
            id="collab-server"
            className="field"
            value={server}
            spellCheck={false}
            onChange={(e) => setServer(e.target.value)}
            placeholder="https://your-server.example"
          />
          <div className="share-actions">
            <Button
              variant="primary"
              disabled={!api || busy}
              onClick={async () => {
                if (!api) return;
                setBusy(true);
                setError("");
                try {
                  const connection = await createRoom(server, api);
                  localStorage.setItem(SERVER_KEY, server);
                  setRoom(connection);
                  await copy(roomLink(connection), "Edit link");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not connect");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Connecting…" : "Start a shared session"}
            </Button>
          </div>
          <p>
            Use your hosted Cadanraw relay; localhost works for testing on this
            computer. Assistant (MCP) access lives in Settings.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>,
    document.body,
  );
}
