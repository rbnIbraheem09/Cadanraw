import { useEffect, useState, type ReactNode } from "react";
import { Check, FolderOpen, RefreshCw } from "lucide-react";
import { usePrefs, DEFAULT_CAPTURE_SHORTCUT } from "../../store/prefs";
import { useUi } from "../../store/ui";
import { ACCENTS, GRIDS, THEMES, themeById } from "../../lib/themes";
import { acceleratorFromEvent, formatAccelerator, mod } from "../../lib/platform";
import { checkForUpdates } from "../../lib/updates";
import { sfx } from "../../lib/sound";
import { Segmented, Toggle } from "../ui/controls";
import Button from "../ui/Button";
import AgentAccess from "./AgentAccess";

function Group({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section className="settings-group" id={id}>
      <h2>{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div>
        <strong>{label}</strong>
        <p>{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** A button that turns the next key combination into the global shortcut. */
function ShortcutRecorder() {
  const shortcut = usePrefs((s) => s.captureShortcut);
  const set = usePrefs((s) => s.set);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setListening(false);
      if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return;
      const accelerator = acceleratorFromEvent(e);
      if (!accelerator) return setNote("Use ⌘, ⌃ or ⌥ with another key.");
      set("captureShortcut", accelerator);
      setNote("");
      setListening(false);
      sfx.tap();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, set]);

  return (
    <div className="recorder">
      <button
        className={`recorder-key ${listening ? "is-listening" : ""}`}
        onClick={() => setListening((v) => !v)}
        onBlur={() => setListening(false)}
      >
        {listening ? "Press keys…" : formatAccelerator(shortcut)}
      </button>
      {shortcut !== DEFAULT_CAPTURE_SHORTCUT && !listening && (
        <button className="recorder-reset" onClick={() => set("captureShortcut", DEFAULT_CAPTURE_SHORTCUT)}>
          Reset
        </button>
      )}
      {note && <small>{note}</small>}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  [mod("K"), "Search boards and commands"],
  [mod("P"), "Go to a board"],
  ["/", "Insert a block at the pointer"],
  [mod("N"), "New board"],
  [mod("1"), "Home"],
  [mod("B"), "Show or hide the sidebar"],
  [mod("."), "Focus mode"],
  [mod(","), "Settings"],
  [mod("S"), "Save now (it also saves itself)"],
  [mod("⇧", "S"), "Save a version"],
  [mod("E"), "Export"],
  [mod("O"), "Import a file"],
  ["?", "Drawing shortcuts (on a board)"],
];

export default function SettingsView() {
  const prefs = usePrefs();
  const close = useUi((s) => s.closeSettings);
  const captureRegistered = useUi((s) => s.captureRegistered);
  const [info, setInfo] = useState<{ version: string; dataPath?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const scheme = themeById(prefs.theme).scheme;

  useEffect(() => {
    void window.excali.getAppInfo().then(setInfo);
  }, []);

  return (
    <div className="settings">
      <div className="settings-inner view-enter">
        <header className="settings-head">
          <h1>Settings</h1>
          <Button variant="soft" onClick={close}>
            Done <kbd>esc</kbd>
          </Button>
        </header>

        <Group title="Theme">
          <div className="theme-grid" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={prefs.theme === t.id}
                className="theme-card press"
                title={t.blurb}
                onClick={() => {
                  sfx.tap();
                  prefs.set("theme", t.id);
                }}
              >
                {/* A real slice of the theme: these tokens resolve inside it. */}
                <span className="theme-mini" data-theme={t.id} data-scheme={t.scheme} aria-hidden="true">
                  <i className="mini-side" />
                  <i className="mini-board dot-surface">
                    <i className="mini-card" />
                    <i className="mini-accent" />
                  </i>
                </span>
                <span className="theme-name">
                  {t.name}
                  {prefs.theme === t.id && <Check size={13} strokeWidth={2.6} />}
                </span>
              </button>
            ))}
          </div>
          <Row label="Accent" hint="Use the theme's own colour, or pick one that's yours.">
            <div className="accent-row" role="radiogroup" aria-label="Accent colour">
              <button
                role="radio"
                aria-checked={prefs.accent === "theme"}
                aria-label="Theme default"
                title="Theme default"
                className="accent-dot is-theme"
                onClick={() => prefs.set("accent", "theme")}
              />
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  role="radio"
                  aria-checked={prefs.accent === a.id}
                  aria-label={a.name}
                  title={a.name}
                  className="accent-dot"
                  style={{ background: a[scheme][0] }}
                  onClick={() => {
                    sfx.tap();
                    prefs.set("accent", a.id);
                  }}
                />
              ))}
            </div>
          </Row>
        </Group>

        <Group title="Board background">
          <div className="grid-picker" role="radiogroup" aria-label="Board background">
            {GRIDS.map((g) => (
              <button
                key={g.id}
                role="radio"
                aria-checked={prefs.grid === g.id}
                className="grid-card press"
                title={g.blurb}
                onClick={() => {
                  sfx.tap();
                  prefs.set("grid", g.id);
                }}
              >
                <span className="grid-mini dot-surface" data-grid={g.id} aria-hidden="true" />
                <span className="theme-name">
                  {g.name}
                  {prefs.grid === g.id && <Check size={13} strokeWidth={2.6} />}
                </span>
              </button>
            ))}
          </div>
          <Row label="Strength" hint="How much the pattern shows through.">
            <Segmented
              label="Pattern strength"
              value={prefs.gridStrength}
              onChange={(v) => prefs.set("gridStrength", v)}
              options={[
                { value: "subtle", label: "Subtle" },
                { value: "normal", label: "Normal" },
                { value: "bold", label: "Bold" },
              ]}
            />
          </Row>
        </Group>

        <Group title="Feel">
          <Row label="Interface sounds" hint="Soft clicks and chimes. Off means silent.">
            <div className="settings-inline">
              {prefs.sounds && (
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={prefs.volume}
                  aria-label="Sound volume"
                  onChange={(e) => prefs.set("volume", Number(e.target.value))}
                  onPointerUp={() => sfx.tick()}
                />
              )}
              <Toggle
                label="Interface sounds"
                checked={prefs.sounds}
                onChange={(on) => prefs.set("sounds", on)}
              />
            </div>
          </Row>
          <Row label="Motion" hint="System follows the Reduce Motion setting on this computer.">
            <Segmented
              label="Motion"
              value={prefs.motion}
              onChange={(v) => prefs.set("motion", v)}
              options={[
                { value: "system", label: "System" },
                { value: "full", label: "Full" },
                { value: "reduced", label: "Reduced" },
              ]}
            />
          </Row>
          <Row label="Celebrate finished lists" hint="A small burst when the last box is ticked.">
            <Toggle
              label="Celebrate finished lists"
              checked={prefs.celebrations}
              onChange={(on) => prefs.set("celebrations", on)}
            />
          </Row>
          <Row label="When Cadanraw opens" hint="Start in the library, or straight back on your last board.">
            <Segmented
              label="On launch"
              value={prefs.launch}
              onChange={(v) => prefs.set("launch", v)}
              options={[
                { value: "home", label: "Home" },
                { value: "last", label: "Last board" },
              ]}
            />
          </Row>
        </Group>

        <Group title="Quick note">
          <Row
            label="Capture from anywhere"
            hint="A small window for a thought, from any app, without leaving what you're doing."
          >
            <Toggle
              label="Quick note shortcut"
              checked={prefs.captureEnabled}
              onChange={(on) => prefs.set("captureEnabled", on)}
            />
          </Row>
          {prefs.captureEnabled && (
            <>
              <Row
                label="Shortcut"
                hint={
                  captureRegistered === false
                    ? "That shortcut is taken by another app. Pick a different one."
                    : "Click, then press the keys you want."
                }
              >
                <ShortcutRecorder />
              </Row>
              <Row
                label="Notes go to"
                hint="Inbox is a board of its own. Open board files them where you're working."
              >
                <Segmented
                  label="Destination"
                  value={prefs.captureTarget}
                  onChange={(v) => prefs.set("captureTarget", v)}
                  options={[
                    { value: "inbox", label: "Inbox" },
                    { value: "open", label: "Open board" },
                  ]}
                />
              </Row>
            </>
          )}
        </Group>

        <Group title="Assistants · MCP">
          <AgentAccess />
        </Group>

        <Group title="Your data">
          <Row
            label="Stored on this device"
            hint={info?.dataPath ?? "Boards, versions and your library live in one folder."}
          >
            <Button variant="soft" onClick={() => void window.excali.revealDataFolder()}>
              <FolderOpen size={14} /> Show folder
            </Button>
          </Row>
        </Group>

        <Group title="Shortcuts" id="settings-shortcuts">
          <div className="shortcut-list">
            {SHORTCUTS.map(([keys, what]) => (
              <div key={what}>
                <span>{what}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </div>
        </Group>

        <Group title="About">
          <Row label="Cadanraw" hint={info ? `Version ${info.version}` : " "}>
            <Button
              variant="soft"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                await checkForUpdates();
                setChecking(false);
              }}
            >
              <RefreshCw size={14} /> {checking ? "Checking…" : "Check for updates"}
            </Button>
          </Row>
        </Group>
      </div>
    </div>
  );
}
