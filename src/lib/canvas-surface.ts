import type { AppState } from "@excalidraw/excalidraw/types";
/** Keep the dots anchored to scene coordinates while panning and zooming. */
export function syncDotGrid(surface: HTMLDivElement | null, state: AppState) {
  if (!surface) return;
  // Rich block controls accept a single click in selection/view mode. Drawing,
  // erasing and panning still belong to the canvas while those tools are active.
  surface.dataset.blockControls =
    state.activeTool.type === "selection" || state.viewModeEnabled
      ? "true"
      : "false";
  const zoom = state.zoom.value;
  let spacing = 24 * zoom;
  while (spacing < 12) spacing *= 2;
  while (spacing > 48) spacing /= 2;
  surface.style.setProperty("--dot-spacing", `${spacing}px`);
  surface.style.setProperty("--dot-x", `${state.scrollX * zoom}px`);
  surface.style.setProperty("--dot-y", `${state.scrollY * zoom}px`);
}

/** True when the wheel would scroll a scrollable box between `target` and `root`. */
function scrollsInside(
  target: EventTarget | null,
  root: HTMLElement,
  e: WheelEvent,
) {
  const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
  const delta = sideways ? e.deltaX : e.deltaY;
  for (
    let node = target instanceof HTMLElement ? target : null;
    node && root.contains(node);
    node = node.parentElement
  ) {
    const max = sideways
      ? node.scrollWidth - node.clientWidth
      : node.scrollHeight - node.clientHeight;
    const pos = sideways ? node.scrollLeft : node.scrollTop;
    const style = getComputedStyle(node)[sideways ? "overflowX" : "overflowY"];
    if (
      max > 1 &&
      /auto|scroll/.test(style) &&
      (delta < 0 ? pos > 0 : pos < max - 1)
    )
      return true;
  }
  return false;
}

/**
 * Trackpad pans and pinch-zooms over a rich block move the board, like native
 * shapes. Excalidraw ignores wheel events whose target isn't its canvas, so we
 * re-dispatch them there. A block the user is working in (focus inside) still
 * scrolls its own overflowing content first.
 */
export function forwardBlockWheel(root: HTMLElement) {
  const onWheel = (e: WheelEvent) => {
    e.stopPropagation();
    const zooming = e.ctrlKey || e.metaKey;
    if (
      !zooming &&
      root.contains(document.activeElement) &&
      scrollsInside(e.target, root, e)
    )
      return;
    const canvas = root
      .closest(".excalidraw")
      ?.querySelector<HTMLCanvasElement>("canvas.interactive");
    if (!canvas) return;
    e.preventDefault();
    canvas.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
      }),
    );
  };
  root.addEventListener("wheel", onWheel, { passive: false });
  return () => root.removeEventListener("wheel", onWheel);
}
