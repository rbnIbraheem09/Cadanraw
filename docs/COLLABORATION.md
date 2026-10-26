# Sharing and agent connections

## Run the self-hosted collaboration service

Use Node 20 or newer. The relay has no additional runtime dependencies.

```sh
npm ci
npm run build:renderer
npm run build:electron
npm run collab:serve
```

For the standalone release bundle, unpack it in a dedicated folder, change into that folder, and run `node dist-electron/collaboration-server.js` with Node 20 or newer. No install step is needed for that bundle.

The default address is `http://localhost:8787`. In Cadanraw, open a canvas, select **Connect**, enter that address and choose **Start shared session**. Paste the copied link into another browser to test. `localhost` links work only on the computer running the service.

For public access, run the relay on a server and put an HTTPS reverse proxy in front of port 8787. Enter the public HTTPS origin in the desktop app. Guests open that link in a browser and choose a display name; they do not need the desktop app. Public hosting is not included or automatically deployed.

Environment variables:

| Variable                   | Default                  | Purpose                                                |
| -------------------------- | ------------------------ | ------------------------------------------------------ |
| `PORT`                     | `8787`                   | Local relay port                                       |
| `HOST`                     | `127.0.0.1`              | Bind address; use `0.0.0.0` inside a container         |
| `CADANRAW_COLLAB_DATA_DIR` | `./cadanraw-collab-data` | Persistent room files; mount a volume in a container   |
| `ALLOWED_ORIGIN`           | empty                    | Optional additional web origin allowed to call the API |

Alternatively, use the included Docker Compose service (Docker is not required for local development):

```sh
docker compose -f compose.collaboration.yml up --build -d
```

The container serves the browser editor and relay, with room data in a persistent volume and the local port exposed only to your reverse proxy. The Docker configuration is supplied for deployment; it has not been built in this workspace.

A simple Caddy reverse proxy configuration:

```caddyfile
canvas.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

Replace the domain with your own and point DNS at the server. Restrict direct access to the relay port. For an internet-facing deployment, apply request limits at your reverse proxy and restrict room creation to your users if required. This initial relay allows room creation without accounts, caps requests at 32 MB, rooms at 64 MB and 10,000 elements, and stores up to 100 rooms. Room files include sharing keys: keep the data directory private and back it up accordingly. Traffic is encrypted by HTTPS; the relay can read room content (there is no end-to-end encryption).

## Session behavior

- **Copy edit link** grants editing to anyone possessing that link.
- **Copy view link** grants viewing only; writes are rejected by the relay.
- **Leave session** disconnects this app. It does not revoke links.
- **End session & revoke links** removes the shared room and invalidates both links; your desktop canvas remains saved locally.
- Room content persists across relay restarts. Idle rooms older than 24 hours are cleaned up when a new room is created.
- Changes and cursor positions exchange approximately every 650 ms while connected. Cursors disappear after ten seconds without a heartbeat.
- Independent element changes merge. Concurrent edits to the same element use Excalidraw version and nonce ordering; this is not character-level text merging.
- A disconnected client retains its local edits and retries. Keep a desktop host connected if you want incoming guest changes autosaved into that host's local canvas.
- Rich blocks are stored in `customData` in the `.excalidraw` scene. They remain interactive in Cadanraw and its browser guest editor. Other Excalidraw applications do not provide Cadanraw's block renderer. PNG/SVG exports do not capture interactive HTML block contents in this initial implementation.
- YouTube videos play when embedding is allowed by the video's owner and network. Each card includes an external-open fallback. Generic website cards open the destination; arbitrary external sites are not framed.

## Connect an agent over MCP

In **Connect → Agent access**, optionally choose **Allow agents to edit boards**, then enable access and copy the MCP configuration into a client that supports HTTP MCP endpoints and Authorization headers.

The endpoint listens on an ephemeral port on `127.0.0.1` and requires a random bearer token. The URL alone does not grant access. Access is disabled at launch; stopping it or quitting the app revokes the token. No tunnel is created.

Always available:

| Tool            | Behavior                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list_canvases` | Lists canvases, folders and the open canvas ID                                                                                                         |
| `read_canvas`   | Reads a canvas (the open one by default, including unsaved edits, visible bounds and selection). Block data is included; embedded files are summarized |
| `screenshot`    | Returns an image of the canvas as it looks in the app, rich blocks included. Zooms to fit everything or chosen IDs, or keeps the current view          |

With **Allow agents to edit boards**:

| Tool              | Behavior                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `manage_canvas`   | Creates (and opens), opens, renames or deletes a canvas. Deleted canvases go to the system trash                          |
| `add_elements`    | Appends up to 200 shape/text/arrow skeletons. Agent-chosen IDs are kept so later calls can reference them                 |
| `add_image`       | Adds an image from an http(s) URL, a `data:image` URL or an absolute local path (png, jpg, gif, webp, svg; up to 20 MB)   |
| `add_block`       | Adds a note, checklist, table, calendar, link, Kanban, attachment or board card, with optional content, position and size |
| `update_elements` | Moves, resizes, restyles or re-texts elements, and edits block content (titles, items, rows, columns, events, colors)     |
| `delete_elements` | Deletes elements and their labels                                                                                         |

Element tools act on the open canvas. Writes go through the live editor, so the user can undo them, and they enter the normal autosave flow. Version previews reject element operations. Screenshots need the Cadanraw window to be open; the editor toolbar is hidden for the instant of capture. Local image paths are read only when they decode as images. This implements stateless JSON-response Streamable HTTP with the 2025-03-26 protocol and no subscriptions. The app doesn't offer chat messaging between agents.
