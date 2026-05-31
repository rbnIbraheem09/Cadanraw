# Cadanraw

A local-first desktop whiteboard app — like Obsidian, but every note is an [Excalidraw](https://github.com/excalidraw/excalidraw) canvas. Built with Electron + React, wrapping `@excalidraw/excalidraw` with multi-canvas file management, autosave, version history, and a shared library. Everything stays on your device.

## Features

- **Multi-canvas sidebar** — search, pin, duplicate, rename, delete
- **Autosave + version history** — browse, preview, and restore snapshots
- **Shared library** across all canvases
- **Import / export** — `.excalidraw`, PNG, SVG (drag a `.excalidraw` file in to import)
- **Dark, focused UI** with self-hosted fonts (works fully offline)

## Development

Requires **Node 20** (see `.nvmrc`).

```bash
nvm use
npm install
npm run rebuild-sqlite   # build the native SQLite module for Electron's ABI
npm run dev
```

> Tests run on the Node ABI; `npm test` automatically rebuilds the native module for Node, runs the suite, then restores it for Electron.

## Build

```bash
npm run build            # installers land in dist-app/
```

## Tech

Electron 29 · React 18 · Vite 5 · TypeScript · better-sqlite3 · Zustand · Tailwind CSS · Framer Motion

## License

Cadanraw bundles [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT).
