import React from "react";
import { createRoot } from "react-dom/client";
// Self-hosted fonts (bundled by Vite) — the app works fully offline, no CDN.
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/canvas.css";
import "./styles/blocks.css";
import "./styles/shell.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

/**
 * One bundle, three faces, each loaded on demand so none pays for the others:
 * the quick-note window (tiny), the desktop app, and the shared web canvas.
 */
async function boot() {
  // `?demo` in a dev browser runs the desktop app against an in-memory library.
  if (import.meta.env.DEV && !window.excali && new URLSearchParams(location.search).has("demo"))
    (await import("./dev/mock-bridge")).installMockBridge();

  const View = location.hash.startsWith("#capture")
    ? (await import("./capture/CaptureApp")).default
    : window.excali
      ? (await import("./App")).default
      : (await import("./components/canvas/SharedCanvas")).default;

  // NOTE: StrictMode double-mounts in dev; the editor is written to tolerate it.
  createRoot(container!).render(
    <React.StrictMode>
      <View />
    </React.StrictMode>,
  );
}
void boot();
