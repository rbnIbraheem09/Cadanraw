import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../../store/excaliStore";

export default function Toast() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return createPortal(
    <div className="pointer-events-none fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] shadow-xl backdrop-blur ${
              t.type === "error"
                ? "border-red-500/30 bg-red-500/15 text-red-200"
                : "border-edge bg-overlay text-ink"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                t.type === "error" ? "bg-red-400" : "bg-accent"
              }`}
            />
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
