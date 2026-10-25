# Cadanraw

A local-first desktop whiteboard app — like Obsidian, but every note is an [Excalidraw](https://github.com/excalidraw/excalidraw) canvas. Built with Electron + React, wrapping `@excalidraw/excalidraw` with multi-canvas file management, autosave, version history, and a shared library. Boards stay on your device unless you choose to share them with a self-hosted relay.

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

## Rich blocks, collaboration and agents

The right-side **Insert** shelf adds editable notes, checklists, tables, calendars, Kanban plans, attachments, linked-board cards and link/video cards to the canvas. **Connect** offers self-hosted browser collaboration with edit/view links and live cursors, plus an opt-in local MCP endpoint for agents.

See [sharing and agent setup](docs/COLLABORATION.md) for hosting, permissions and current limitations. Public sharing requires a reachable HTTPS relay; the app does not provision hosting.

## Organize your workspace

Home provides grid/list browsing, board previews, search, pinned boards and nested folders shared with the sidebar. Import a `.excalidraw` file from Home or the sidebar; move boards with drag and drop or **Move to folder…**. See [workspace guide](docs/WORKSPACE.md).
