import Button from "../ui/Button";
import { useStore } from "../../store/excaliStore";

/** Shown in the canvas area when no canvas is open — designed to teach, not just say "empty". */
export default function EmptyState() {
  const openNew = useStore((s) => s.openNewCanvasDialog);

  return (
    <div className="flex h-full w-full items-center justify-center px-8">
      <div className="flex w-full max-w-[300px] flex-col items-center text-center">
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-edge bg-surface"
          style={{
            boxShadow:
              "inset 0 1px 0 0 rgba(255,255,255,0.05), 0 12px 32px -12px rgba(0,0,0,0.7)",
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
        </div>

        <h1 className="text-[17px] font-semibold tracking-tight text-ink">
          Start with a blank canvas
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
          Your whiteboards stay on this device and save themselves as you draw.
        </p>

        <Button variant="primary" className="mt-5 px-4 py-2" onClick={openNew}>
          New canvas
        </Button>

        <div className="mt-7 flex flex-col gap-2 text-[12px] text-ink-muted">
          <Hint keys="⌘N" label="New canvas" />
          <Hint keys="⌘O" label="Open a file" />
        </div>
      </div>
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <kbd className="min-w-[30px] rounded-md border border-edge bg-raised px-1.5 py-0.5 font-mono text-[11px] text-ink-dim">
        {keys}
      </kbd>
      <span>{label}</span>
    </div>
  );
}
