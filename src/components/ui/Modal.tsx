import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { fade, pop } from "../../lib/motion";
import { useLayer } from "../../hooks/useLayer";

// Portalled, dismissable modal (Esc or backdrop click). Rendered on document.body
// so it always layers above the Excalidraw canvas regardless of stacking context.
export default function Modal({
  open,
  onClose,
  children,
  width = 380,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useLayer(open, onClose);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-scrim"
          variants={fade}
          initial="initial"
          animate="animate"
          exit="exit"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="modal-card"
            style={{ width }}
            variants={pop}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
