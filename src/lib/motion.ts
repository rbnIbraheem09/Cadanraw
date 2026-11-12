import { flushSync } from "react-dom";
import type { Transition, Variants } from "framer-motion";
import { reducedMotion } from "../store/prefs";

/** Springs for things that move; expo ease-out for things that appear. */
export const spring: Transition = { type: "spring", stiffness: 520, damping: 36, mass: 0.9 };
export const softSpring: Transition = { type: "spring", stiffness: 380, damping: 30 };
export const easeOut = [0.16, 1, 0.3, 1] as const;

/** Sheets, popovers and menus: spring in from slightly small, leave quicker. */
export const pop: Variants = {
  initial: { opacity: 0, scale: 0.94, filter: "blur(6px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { ...spring, opacity: { duration: 0.14 } } },
  exit: { opacity: 0, scale: 0.97, filter: "blur(4px)", transition: { duration: 0.13, ease: "easeIn" } },
};

export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

type ViewTransition = {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run a state change as a view transition (old and new screens cross-fade, and
 * elements sharing a view-transition-name morph). Falls back to a plain update
 * when unavailable or when motion is reduced.
 *
 * The update itself never depends on the animation: if the browser can't
 * start the transition promptly (nothing is being painted, for instance), the
 * update runs anyway.
 */
export async function withViewTransition(update: () => void | Promise<void>): Promise<void> {
  const start = (
    document as Document & {
      startViewTransition?: (cb: () => Promise<void>) => ViewTransition;
    }
  ).startViewTransition;
  if (!start || reducedMotion() || document.visibilityState !== "visible") {
    await update();
    return;
  }
  let done: Promise<void> | undefined;
  const run = () => (done ??= Promise.resolve(update()));
  try {
    const transition = start.call(document, async () => {
      await run();
      flushSync(() => {});
    });
    for (const promise of [transition.ready, transition.updateCallbackDone, transition.finished])
      promise.catch(() => {});
    await Promise.race([transition.updateCallbackDone.catch(() => {}), wait(250)]);
    await run();
    await Promise.race([transition.finished.catch(() => {}), wait(1200)]);
  } catch {
    await run();
  }
}
