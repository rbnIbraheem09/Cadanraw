# Workspace organization

Home is the starting point for local boards. Open it from the sidebar or the Home button in the title bar.

- Switch between grid previews and a compact list; the choice is remembered.
- Search boards and folders, sort boards by name or edit time, and pin frequent boards.
- Create folders in Home. Open a folder before creating a new one to make a subfolder.
- Home and the sidebar use the same persistent folder hierarchy.
- Drag a board from Home or the sidebar onto a folder, or use **Move to folder…** from its actions menu. **Unfiled** is the root location.
- Removing a folder keeps its boards and subfolders, moving them to its parent (or Unfiled for a root folder).
- **Import** in Home and the sidebar opens the native file picker. Imported `.excalidraw` files are copied into Cadanraw's own managed storage, and go into the selected folder. The source file is not modified.
- Board previews are lightweight visual summaries, loaded as cards enter view; they are not exported screenshots.

## Block editing

Blocks retain the established Excalidraw embeddable implementation. The small blue link icon remains deliberately; an attempted shape-based renderer was reverted after editing regressed.

Click text to edit it. Text fields grow with their content, leaving the surrounding blank space available for selecting and dragging. Fields do not show form borders or outlines while editing; caret and text selection remain visible. Buttons, color swatches, checkboxes and calendar days have their own controls.

The internal URL popup and “Click to interact” hint remain hidden only for Cadanraw blocks. Other embedded content keeps Excalidraw's normal controls.

## Link cards

New link cards fetch the real page title. YouTube links use oEmbed; other pages use Open Graph, Twitter metadata or their document title. Titles you have changed manually are preserved. A failed lookup is retried when the board is reopened, and never permanently marks a placeholder title as complete. Existing generic “Link” or “YouTube video” titles are eligible for repair.

## Planning and reference blocks

- **Kanban:** start with To do, In progress and Done. Edit column titles, add tasks, move them with the arrow buttons or drag handle, and add up to 12 columns. Empty columns can be removed. Resize the block for more room; overflow scrolls within it. Moving an entire block uses its outer margin.
- **Attachment:** choose any reference file up to 4 MB. The original bytes are embedded in the board, so `.excalidraw` exports and browser sessions carry the file. Add a note, replace it, or download it from the card. Downloading does not automatically open or execute it. Keep shared boards below the relay's 32 MB request limit, including base64 overhead.
- **Board:** choose another board from the desktop library and open it through the card. Switching boards saves the current canvas first. These are local references, not public sharing links; imported references only resolve when the destination board ID exists in that library. Browser guests see the card but cannot browse the host's library.

All block edits use the existing scene persistence, autosave and undo history. Collaboration merges independent elements; edits made simultaneously inside the same block resolve together as one element.
