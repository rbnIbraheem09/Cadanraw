import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";
import { useStore } from "../../store/excaliStore";
import { spring } from "../../lib/motion";

export default function Toast() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return createPortal(
    <div className="toast-stack" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.92, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 6, scale: 0.96, filter: "blur(4px)", transition: { duration: 0.14 } }}
            transition={spring}
            onClick={() => dismiss(t.id)}
            className={`toast ${t.type === "error" ? "is-error" : ""}`}
          >
            {t.type === "error" ? <AlertCircle size={14} /> : <Check size={14} strokeWidth={2.4} />}
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
