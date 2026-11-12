import { useEffect, useState } from "react";
import { useStore } from "../../store/excaliStore";
import { Toggle } from "../ui/controls";
import Button from "../ui/Button";

type Status = Awaited<ReturnType<Window["excali"]["agent"]["status"]>>;

const clean = (e: unknown, fallback: string) =>
  e instanceof Error
    ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "")
    : fallback;

/** Let Claude (or any MCP app on this computer) read and, optionally, edit boards. */
export default function AgentAccess() {
  const toast = useStore((s) => s.pushToast);
  const [agent, setAgent] = useState<Status | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    window.excali.agent
      .status()
      .then(setAgent)
      .catch(() => {});
  }, []);

  const run = async (action: () => Promise<Status>, failure: string) => {
    setError("");
    try {
      setAgent(await action());
    } catch (e) {
      setError(clean(e, failure));
    }
  };
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`, "success");
    } catch {
      setError("Clipboard unavailable.");
    }
  };
  const setup = async (client: "claude-desktop" | "claude-code") => {
    setError("");
    try {
      const result = await window.excali.agent.setup(client);
      if (result.done)
        toast(
          client === "claude-desktop"
            ? "Added. Quit and reopen Claude Desktop to connect."
            : "Added. Start a new Claude Code session to connect.",
          "success",
        );
      else if (result.command) await copy(result.command, "Setup command");
    } catch (e) {
      setError(clean(e, "Setup failed"));
    }
  };

  const enabled = !!agent?.enabled;
  return (
    <>
      <div className="settings-row">
        <div>
          <strong>Assistant access</strong>
          <p>
            {enabled
              ? "Running locally. Only apps on this computer can connect."
              : "Let Claude or another MCP app see your boards while Cadanraw is open."}
          </p>
        </div>
        <Toggle
          label="Assistant access"
          checked={enabled}
          onChange={(on) =>
            void run(
              () => (on ? window.excali.agent.start(false) : window.excali.agent.stop()),
              on ? "Couldn't start the local connection" : "Couldn't stop assistant access",
            )
          }
        />
      </div>
      {enabled && agent && (
        <>
          <div className="settings-row">
            <div>
              <strong>Allow editing</strong>
              <p>Assistants can add and change things on your boards. You can always undo.</p>
            </div>
            <Toggle
              label="Allow assistants to edit"
              checked={agent.allowWrite}
              onChange={(on) =>
                void run(() => window.excali.agent.start(on), "Couldn't change editing access")
              }
            />
          </div>
          <div className="settings-row">
            <div>
              <strong>Connect an app</strong>
              <p>One click for Claude; copy a config for anything else.</p>
            </div>
            <div className="settings-buttons">
              <Button variant="soft" onClick={() => void setup("claude-desktop")}>
                Add to Claude Desktop
              </Button>
              <Button variant="soft" onClick={() => void setup("claude-code")}>
                Add to Claude Code
              </Button>
              <Button
                onClick={() =>
                  void copy(
                    JSON.stringify({ mcpServers: { cadanraw: agent.bridge } }, null, 2),
                    "Local config",
                  )
                }
              >
                Copy local config
              </Button>
              <Button
                onClick={() =>
                  void copy(
                    JSON.stringify(
                      {
                        mcpServers: {
                          cadanraw: {
                            type: "http",
                            url: agent.url,
                            headers: { Authorization: `Bearer ${agent.token}` },
                          },
                        },
                      },
                      null,
                      2,
                    ),
                    "HTTP config",
                  )
                }
              >
                Copy HTTP config
              </Button>
              <Button
                onClick={() =>
                  void run(() => window.excali.agent.resetToken(), "Couldn't reset the token")
                }
              >
                Reset token
              </Button>
            </div>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="form-error settings-error">
          {error}
        </p>
      )}
    </>
  );
}
