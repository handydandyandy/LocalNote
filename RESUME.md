# Resume Notes — LocalNote Redesign

## Current state (as of session end)

All 6 original stages are complete and built. The app is functional on iPad via Tailscale.

**Critical pending fix (MUST do first):**
The backend `/assets` vs `/files` routing conflict is already patched in code but the backend has NOT been restarted. Until restarted, the iPad sees a blank white screen.

**To fix the blank screen:**
In the backend terminal: `Ctrl+C` → `python3 main.py`
Then hard-refresh in Safari.

---

## Approved redesign plan

The full plan is at: `/home/andyt/.claude/plans/logical-jingling-shamir.md`

### Changes NOT yet started:
All redesign work is pending. Nothing has been written yet. Files to change:

| File | What changes |
|------|-------------|
| `frontend/src/context/AppContext.tsx` | `createNotebook`/`createSection`/`createPage` return their created objects; `createPage` accepts optional `section` param so PagePanel can create pages in any section without pre-selecting it; `createNotebook` auto-selects the new notebook |
| `frontend/src/components/Canvas.tsx` | Add `editor.setCameraOptions({ zoomSteps: [0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8] })` inside `handleMount` after the store listener setup — expands min zoom from 10% to 2% |
| `frontend/src/components/Sidebar.tsx` | Complete rewrite: split into `NotebookStrip` (exported) + `PagePanel` (exported). No more `prompt()` — inline creation only. Page rows show thumbnail previews. |
| `frontend/src/App.tsx` | Import `NotebookStrip` + `PagePanel` instead of `Sidebar`. Render all three panels side by side. |
| `frontend/src/App.css` | Replace sidebar styles with new `.nb-strip` (140px) and `.page-panel` (220px) panel styles. All touch targets ≥ 44px. |
| `CLAUDE.md` | Add new design notes |
| `README.md` | Add data storage section |

---

## Design spec for the new sidebar

### NotebookStrip (140px wide, leftmost)
- Header: "LocalNote" title
- Scrollable list: one row per notebook
  - Row height: 52px min
  - Active notebook highlighted in accent colour
  - Delete button (×) visible on hover/always
  - Tap to select → shows PagePanel
- Footer: large "+ New Notebook" button
- Creation: immediately creates "Untitled Notebook", selects it, auto-focuses inline rename

### PagePanel (220px wide, middle)
- Header: selected notebook name
- Scrollable body:
  - Sections listed as group headers (section name InlineEdit + "+" to add page + "×" to delete)
  - Pages listed under each section (52px rows):
    - Left: small thumbnail (48×36px) from `pageScreenshots.current.get(page.id)` or gray rect
    - Right: page name (InlineEdit)
    - Delete button
  - Active page highlighted
- Footer: "+ Add Section" button
- Creation: no `prompt()` — creates item immediately, auto-focuses inline edit

### InlineEdit component changes needed
Add `autoFocus?: boolean` prop. When true, `useState(true)` so it starts in edit mode immediately. The existing `useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])` handles focus on mount.

---

## Key technical notes

### prompt() is broken on iPad PWAs
iOS blocks `window.prompt()` in standalone PWA mode. All three places in Sidebar.tsx that use it must be replaced with the inline-creation pattern above.

### Zoom fix detail
`editor.setCameraOptions()` merges with existing options. `zoomSteps` controls discrete zoom levels. Confirmed working via tldraw 2.4 source grep. Place this call in `handleMount` in Canvas.tsx, after the `unlistenRef.current = editor.store.listen(...)` line.

### /files route fix
Already in code:
- `backend/main.py`: mount changed from `/assets` to `/files`
- `frontend/src/api/client.ts`: `getPdfUrl` uses `/files/`
- `frontend/vite.config.ts`: workbox cache pattern uses `/files/`
- `frontend/dist/` was rebuilt successfully
Just needs backend process restart.

### Data storage paths (to add to README)
- Canvas snapshots: `backend/data/pages/{pageId}.json`
- PDF uploads: `backend/data/assets/{fileId}.pdf`
- **Sync output (screenshots + PDFs)**: `backend/sync/{NotebookName}/{SectionName}/`
  - `page-1.png`, `page-2.png` … per page drawn on
  - `section.pdf` — all pages in one PDF
- From Windows Explorer: `\\wsl$\Ubuntu\home\andyt\projects\LocalNote\backend\sync\`

---

## How to restart and build

```bash
# 1. Restart backend (in backend terminal)
Ctrl+C
cd /home/andyt/projects/LocalNote/backend
python3 main.py

# 2. After making code changes, rebuild frontend
cd /home/andyt/projects/LocalNote/frontend
npm run build
# then restart backend again to serve new dist

# 3. iPad: hard-refresh Safari (close tab, reopen)
```

## Tailscale connection
- Laptop Tailscale IP: 100.88.115.118
- iPad: already connected (confirmed working session)
- iPad URL: http://100.88.115.118:8000
