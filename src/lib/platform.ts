export const isMac = (window.excali?.platform ?? "darwin") === "darwin";

/** "⌘K" on macOS, "Ctrl+K" elsewhere. Pass keys in mac order: mod("⇧", "S"). */
export function mod(...keys: string[]): string {
  if (isMac) return `⌘${keys.join("")}`;
  return ["Ctrl", ...keys.map((k) => (k === "⇧" ? "Shift" : k === "⌥" ? "Alt" : k))].join("+");
}

/** Show an Electron accelerator the way the platform writes it. */
export function formatAccelerator(accelerator: string): string {
  const parts = accelerator.split("+");
  if (!isMac) return parts.map((p) => (p === "CommandOrControl" ? "Ctrl" : p)).join("+");
  const symbols: Record<string, string> = {
    CommandOrControl: "⌘",
    Command: "⌘",
    Control: "⌃",
    Alt: "⌥",
    Shift: "⇧",
    Space: "Space",
    Up: "↑",
    Down: "↓",
    Left: "←",
    Right: "→",
    Enter: "↩",
  };
  return parts.map((p) => symbols[p] ?? p).join("");
}

/** Turn a key press into an Electron accelerator, or null if it isn't a usable
 *  global shortcut (it needs a modifier other than Shift, and a real key). */
export function acceleratorFromEvent(e: KeyboardEvent): string | null {
  if (!e.metaKey && !e.ctrlKey && !e.altKey) return null;
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (/^F\d{1,2}$/.test(e.code)) key = e.code;
  else
    key =
      (
        {
          Space: "Space",
          Enter: "Enter",
          ArrowUp: "Up",
          ArrowDown: "Down",
          ArrowLeft: "Left",
          ArrowRight: "Right",
          Minus: "-",
          Equal: "=",
          Comma: ",",
          Period: ".",
          Slash: "/",
          Backslash: "\\",
          Semicolon: ";",
          Quote: "'",
          BracketLeft: "[",
          BracketRight: "]",
          Backquote: "`",
        } as Record<string, string>
      )[e.code] ?? null;
  if (!key) return null;
  return [
    e.metaKey && (isMac ? "Command" : "Super"),
    e.ctrlKey && "Control",
    e.altKey && "Alt",
    e.shiftKey && "Shift",
    key,
  ]
    .filter(Boolean)
    .join("+");
}
