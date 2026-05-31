import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted fonts (bundled by Vite) — the app works fully offline, no CDN.
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

// NOTE: StrictMode is kept while the shell is plain React. It will be
// re-evaluated in Phase 2 — Excalidraw's imperative API can double-initialise
// under StrictMode's intentional double-mount in dev.
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
