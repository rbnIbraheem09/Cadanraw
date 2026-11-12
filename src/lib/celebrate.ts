import { reducedMotion, usePrefs } from "../store/prefs";
import { sfx } from "./sound";

const COLORS = ["#88b7e9", "#87cdb2", "#e2cd82", "#dfa0b8", "#e6ac91", "#b8a6e8"];

/** A short burst of paper from `origin`. Transform and opacity only; every
 *  piece removes itself when it lands. */
export function celebrate(origin: Element) {
  if (!usePrefs.getState().celebrations) return;
  sfx.success();
  if (reducedMotion()) return;
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (let i = 0; i < 16; i++) {
    const bit = document.createElement("span");
    bit.className = "confetti-bit";
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.background = COLORS[i % COLORS.length];
    document.body.appendChild(bit);
    const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.5;
    const reach = 46 + Math.random() * 54;
    const dx = Math.cos(angle) * reach;
    const dy = Math.sin(angle) * reach - 26;
    const spin = (Math.random() - 0.5) * 540;
    bit
      .animate(
        [
          { transform: "translate(-50%, -50%) scale(0.4)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx * 1.15}px, ${dy + 46}px) rotate(${spin * 1.5}deg) scale(0.7)`, opacity: 0 },
        ],
        { duration: 760 + Math.random() * 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      )
      .finished.finally(() => bit.remove());
  }
}
