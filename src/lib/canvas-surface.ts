import type { AppState } from "@excalidraw/excalidraw/types";
/** Keep the dots anchored to scene coordinates while panning and zooming. */
export function syncDotGrid(surface: HTMLDivElement | null, state: AppState) {
  if (!surface) return;
  // Rich block controls accept a single click in selection/view mode. Drawing,
  // erasing and panning still belong to the canvas while those tools are active.
  surface.dataset.blockControls =
    state.activeTool.type === "selection" || state.viewModeEnabled ? "true" : "false";
  const zoom = state.zoom.value;
  let spacing = 24 * zoom;
  while (spacing < 12) spacing *= 2;
  while (spacing > 48) spacing /= 2;
  surface.style.setProperty("--dot-spacing", `${spacing}px`);
  surface.style.setProperty("--dot-x", `${state.scrollX * zoom}px`);
  surface.style.setProperty("--dot-y", `${state.scrollY * zoom}px`);
}
