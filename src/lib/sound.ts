// Small synthesized interface sounds. Nothing is loaded or created until the
// first sound plays, and "off" is completely silent.

let enabled = true;
let volume = 0.35;
let ctx: AudioContext | null = null;
let lastAt = 0;

export function configureSound(on: boolean, level: number) {
  enabled = on;
  volume = Math.max(0, Math.min(1, level));
}

function audio(): AudioContext | null {
  if (!enabled || volume <= 0) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One soft sine blip. `at` is seconds from now. */
function tone(freq: number, at = 0, length = 0.09, level = 1, glideTo?: number) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.16 * volume * level, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** Guard against doubles when one gesture triggers two handlers. */
function once(play: () => void) {
  const now = performance.now();
  if (now - lastAt < 60) return;
  lastAt = now;
  play();
}

export const sfx = {
  /** A light click: picking, switching, pressing. */
  tap: () => once(() => tone(1250, 0, 0.035, 0.55)),
  /** Something opening: palette, menus. */
  open: () => once(() => tone(520, 0, 0.09, 0.6, 820)),
  /** Two clicks, rising when on, falling when off. */
  toggle: (on: boolean) =>
    once(() => {
      tone(on ? 760 : 980, 0, 0.04, 0.6);
      tone(on ? 980 : 760, 0.055, 0.05, 0.6);
    }),
  /** Something landed on the board or was created. */
  drop: () => once(() => tone(420, 0, 0.11, 0.8, 300)),
  /** A box ticked. */
  tick: () => once(() => tone(880, 0, 0.06, 0.7, 1180)),
  /** A whole list finished. */
  success: () =>
    once(() => {
      tone(784, 0, 0.11, 0.8);
      tone(988, 0.08, 0.11, 0.8);
      tone(1319, 0.16, 0.2, 0.8);
    }),
  error: () =>
    once(() => {
      tone(300, 0, 0.11, 0.8);
      tone(230, 0.09, 0.16, 0.8);
    }),
};
