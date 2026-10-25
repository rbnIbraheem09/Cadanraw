import { useEffect, useState } from "react";
import {
  Columns3,
  Paperclip,
  LayoutTemplate,
  CalendarDays,
  CheckSquare,
  FileText,
  Link,
  Table2,
  X,
  Plus,
  Radio,
  Users,
} from "lucide-react";
import { useStore } from "../../store/excaliStore";
import { insertBlock, type BlockKind } from "../../lib/blocks";
import {
  createRoom,
  closeRoom,
  roomLink,
  type RoomConnection,
} from "../../lib/collaboration";
const blocks = [
  {
    kind: "kanban",
    label: "Kanban",
    detail: "Move work from idea to done",
    icon: Columns3,
  },
  {
    kind: "file",
    label: "Attachment",
    detail: "Keep reference files close",
    icon: Paperclip,
  },
  {
    kind: "board",
    label: "Board",
    detail: "Connect related canvases",
    icon: LayoutTemplate,
  },
  {
    kind: "note",
    label: "Note",
    detail: "A thought, with room to grow",
    icon: FileText,
  },
  {
    kind: "checklist",
    label: "Checklist",
    detail: "Turn ideas into next steps",
    icon: CheckSquare,
  },
  {
    kind: "table",
    label: "Table",
    detail: "Bring a little structure",
    icon: Table2,
  },
  {
    kind: "calendar",
    label: "Calendar",
    detail: "Give your plans a place",
    icon: CalendarDays,
  },
] as const;
export default function WorkspacePanel({
  room,
  onRoom,
}: {
  room: RoomConnection | null;
  onRoom: (room: RoomConnection | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"insert" | "connect">("insert");
  const [url, setUrl] = useState("");
  const [server, setServer] = useState(
    () =>
      localStorage.getItem("cadanraw-collab-server") || "http://localhost:8787",
  );
  const [agent, setAgent] = useState<Awaited<
    ReturnType<Window["excali"]["agent"]["status"]>
  > | null>(null);
  const [write, setWrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const api = useStore((s) => s.api);
  const toast = useStore((s) => s.pushToast);
  useEffect(() => {
    window.excali.agent
      .status()
      .then(setAgent)
      .catch(() => {});
  }, []);
  const add = (kind: BlockKind, link = "") => {
    if (api) insertBlock(api, kind, link);
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard", "success");
    } catch {
      setError("Clipboard unavailable. Select and copy the text instead.");
    }
  };
  if (!open)
    return (
      <button
        className="workspace-reopen"
        onClick={() => setOpen(true)}
        aria-label="Open insert and connections panel"
      >
        <Plus size={16} /> Insert
      </button>
    );
  return (
    <aside className="workspace-panel" aria-label="Canvas tools">
      <div className="workspace-panel-heading">
        <span>Make room for ideas</span>
        <button aria-label="Close tools panel" onClick={() => setOpen(false)}>
          <X size={16} />
        </button>
      </div>
      <div className="workspace-tabs">
        <button
          aria-pressed={tab === "insert"}
          onClick={() => setTab("insert")}
        >
          <Plus size={14} /> Insert
        </button>
        <button
          aria-pressed={tab === "connect"}
          onClick={() => setTab("connect")}
        >
          <Users size={14} /> Connect
        </button>
      </div>
      {tab === "insert" ? (
        <>
          <p className="panel-caption">ON YOUR CANVAS</p>
          <div className="insert-list">
            {blocks.map(({ kind, label, detail, icon: Icon }) => (
              <button key={kind} onClick={() => add(kind)} disabled={!api}>
                <Icon size={19} />
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                <Plus size={14} />
              </button>
            ))}
          </div>
          <form
            className="panel-link-form"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const parsed = new URL(url);
                if (!["http:", "https:"].includes(parsed.protocol))
                  throw new Error();
                add("link", parsed.href);
                setUrl("");
                setError("");
              } catch {
                setError("Enter a complete http or https link.");
              }
            }}
          >
            <label htmlFor="insert-url">
              <Link size={14} /> Link or video
            </label>
            <input
              id="insert-url"
              type="url"
              placeholder="Paste a link…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <button className="panel-primary" disabled={!api}>
              Add to canvas ↗
            </button>
          </form>
          <p className="panel-hint">
            Click the text to edit. Drag blank space to move the card, or select
            its edge to resize.
          </p>
        </>
      ) : (
        <>
          <section className="connection-section">
            <h3>
              <Users size={16} /> Work together
            </h3>
            <p>Invite people into this canvas with an edit or view link.</p>
            <label htmlFor="collab-server">Collaboration server</label>
            <input
              id="collab-server"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="https://your-server.example"
            />
            <p className="panel-hint">
              Use your hosted Cadanraw relay. Localhost works for testing on
              this computer.
            </p>
            {room ? (
              <>
                <button
                  className="panel-primary"
                  onClick={() => copy(roomLink(room))}
                >
                  Copy edit link
                </button>
                <button onClick={() => copy(roomLink(room, true))}>
                  Copy view link
                </button>
                <button onClick={() => onRoom(null)}>Leave session</button>
                <button
                  onClick={async () => {
                    try {
                      await closeRoom(room);
                      onRoom(null);
                    } catch {
                      setError(
                        "Could not revoke the shared links. Check the server connection.",
                      );
                    }
                  }}
                >
                  End session & revoke links
                </button>
                <p className="panel-hint">
                  Leaving disconnects you. Shared links stay active until you
                  end the session or the room expires.
                </p>
              </>
            ) : (
              <button
                className="panel-primary"
                disabled={!api || busy}
                onClick={async () => {
                  if (!api) return;
                  setBusy(true);
                  setError("");
                  try {
                    const connection = await createRoom(server, api);
                    localStorage.setItem("cadanraw-collab-server", server);
                    onRoom(connection);
                    await copy(roomLink(connection));
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Could not connect",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Connecting…" : "Start shared session"}
              </button>
            )}
          </section>
          <section className="connection-section">
            <h3>
              <Radio size={16} /> Agent access
            </h3>
            <p>Let an MCP-compatible agent read this app while it is open.</p>
            {agent?.enabled ? (
              <>
                <span className="connection-live">
                  ● {agent.allowWrite ? "Read & edit enabled" : "Read only"}
                </span>
                <input aria-label="Agent endpoint" readOnly value={agent.url} />
                <button
                  onClick={() =>
                    copy(
                      JSON.stringify(
                        {
                          mcpServers: {
                            cadanraw: {
                              url: agent.url,
                              headers: {
                                Authorization: `Bearer ${agent.token}`,
                              },
                            },
                          },
                        },
                        null,
                        2,
                      ),
                    )
                  }
                >
                  Copy MCP configuration
                </button>
                <button
                  onClick={async () => {
                    try {
                      setAgent(await window.excali.agent.stop());
                    } catch {
                      setError("Could not stop agent access");
                    }
                  }}
                >
                  Turn off agent access
                </button>
              </>
            ) : (
              <>
                <label className="panel-checkbox">
                  <input
                    type="checkbox"
                    checked={write}
                    onChange={(e) => setWrite(e.target.checked)}
                  />{" "}
                  Allow agents to add content
                </label>
                <button
                  onClick={async () => {
                    try {
                      setAgent(await window.excali.agent.start(write));
                    } catch {
                      setError("Could not start the local agent connection");
                    }
                  }}
                >
                  Enable agent access
                </button>
              </>
            )}
            <p className="panel-hint">
              Local connections only. Turning access off revokes the copied
              token.
            </p>
          </section>
        </>
      )}
      {error && (
        <p role="alert" className="panel-error">
          {error}
        </p>
      )}
    </aside>
  );
}
