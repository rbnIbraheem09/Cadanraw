import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Renderer-only Vite config. The Electron main/preload are compiled separately
// by `tsc -p tsconfig.node.json` (see package.json scripts) and never touch this.
export default defineConfig({
  plugins: [react()],
  // Relative base so built assets resolve under file:// in the packaged app.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html") },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    // Required by @excalidraw/excalidraw: its prod chunks use "arbitrary module
    // namespace identifier names", unsupported by Vite's default esbuild target.
    // (Documented in the official Excalidraw Vite example.)
    esbuildOptions: {
      target: "es2022",
    },
  },
});
