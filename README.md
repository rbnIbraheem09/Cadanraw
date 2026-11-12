# Cadanraw

A local-first desktop whiteboard app — like Obsidian, but every note is an [Excalidraw](https://github.com/excalidraw/excalidraw) canvas. Built with Electron + React, wrapping `@excalidraw/excalidraw` with multi-canvas file management, autosave, version history, and a shared library. Boards stay on your device unless you choose to share them with a self-hosted relay.

## Features

- **Search everything (⌘K)** — boards, folders and commands; **⌘P** jumps to a board
- **Insert with /** — notes, checklists, Kanban, tables, calendars, links and more, right under the pointer
- **Quick note from anywhere** — a global shortcut (⌃⌥Space by default) files a thought onto your Inbox board
- **Seven themes and five board backgrounds** — including two light themes, plus grid, crosses and isometric patterns
- **Templates** — brainstorm, mind map, project plan, moodboard, storyboard, weekly planner, meeting notes
- **Autosave + version history** — browse, preview, and restore snapshots; boards reopen where you left them
- **Folders, pins and a shared library** across all boards
- **Import / export** — `.excalidraw`, PNG, SVG (drag a `.excalidraw` file in to import)
- Self-hosted fonts; works fully offline

## Development

Requires **Node 20** (see `.nvmrc`).

```bash
nvm use
npm install
npm run rebuild-sqlite   # build the native SQLite module for Electron's ABI
npm run dev
```

> Tests run on the Node ABI; `npm test` automatically rebuilds the native module for Node, runs the suite, then restores it for Electron. If that rebuild fails locally (node-gyp needs Python with `distutils`), run the suite on Electron's own Node instead: `ELECTRON_RUN_AS_NODE=1 npx electron node_modules/vitest/vitest.mjs run`.
>
> For interface work without Electron, `npm run dev:renderer` and open `http://localhost:5173/?demo` (an in-memory library, development only). `npm run smoke:ui` drives the real app against a throwaway data folder.

## Build

```bash
npm run build            # installers land in dist-app/
```

## Tech

Electron 29 · React 18 · Vite 5 · TypeScript · better-sqlite3 · Zustand · Tailwind CSS · Framer Motion

## License

Cadanraw bundles [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT).

## Rich blocks, collaboration and agents

**Insert** (or **/** on the board) adds editable notes, checklists, tables, calendars, Kanban plans, attachments, linked-board cards and link/video cards to the canvas. **Share** offers self-hosted browser collaboration with edit/view links and live cursors, and **Settings → Assistants** turns on an opt-in local MCP endpoint for agents.

See [sharing and agent setup](docs/COLLABORATION.md) for hosting, permissions and current limitations. Public sharing requires a reachable HTTPS relay; the app does not provision hosting.

## Organize your workspace

Home provides grid/list browsing, board previews, search, pinned boards and nested folders shared with the sidebar. Import a `.excalidraw` file from Home or the sidebar; move boards with drag and drop or **Move to folder…**. See [workspace guide](docs/WORKSPACE.md).
