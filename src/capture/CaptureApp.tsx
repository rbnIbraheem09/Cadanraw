import { useEffect, useRef, useState } from "react";
import { Check, StickyNote } from "lucide-react";
import { startPrefs, usePrefs } from "../store/prefs";
import { sfx } from "../lib/sound";

/**
 * The quick-note window: summoned from anywhere by the global shortcut, gone
 * again on Return or Escape. It only collects the text; the main window files
 * it onto a board.
 */
export default function CaptureApp() {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [board, setBoard] = useState("");
  const [message, setMessage] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const target = usePrefs((s) => s.captureTarget);

  useEffect(() => startPrefs(), []);

  // Each summon replays the entrance and puts the caret back.
  useEffect(
    () =>
      window.excali.capture.onShow(() => {
        setState("idle");
        setMessage("");
        field.current?.focus();
        shell.current?.animate(
          [
            { opacity: 0, transform: "scale(0.96) translateY(6px)", filter: "blur(6px)" },
            { opacity: 1, transform: "none", filter: "blur(0)" },
          ],
          { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
      }),
    [],
  );

  const save = async () => {
    if (!text.trim() || state === "saving") return;
    setState("saving");
    try {
      const result = await window.excali.capture.submit(text);
      setBoard(result.board);
      setState("saved");
      setText("");
      sfx.tick();
      setTimeout(() => window.excali.capture.hide(), 620);
    } catch (e) {
      setState("error");
      setMessage(
        e instanceof Error
          ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "")
          : "Couldn't save that",
      );
    }
  };

  return (
    <div className="capture drag-region" ref={shell}>
      <div className="capture-row">
        <StickyNote size={17} className="capture-mark" />
        <textarea
          ref={field}
          autoFocus
          className="no-drag"
          rows={3}
          value={text}
          placeholder="Jot it down…"
          aria-label="Quick note"
          onChange={(e) => {
            setText(e.target.value);
            if (state !== "idle") setState("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape") window.excali.capture.hide();
          }}
        />
      </div>
      <div className="capture-foot">
        {state === "saved" ? (
          <span className="capture-saved">
            <Check size={13} strokeWidth={2.6} /> Saved to {board}
          </span>
        ) : state === "error" ? (
          <span className="capture-error">{message}</span>
        ) : (
          <span>{target === "open" ? "Goes to the open board" : "Goes to your Inbox board"}</span>
        )}
        <span>
          <kbd>↩</kbd> save · <kbd>⇧↩</kbd> new line · <kbd>esc</kbd> close
        </span>
      </div>
    </div>
  );
}
