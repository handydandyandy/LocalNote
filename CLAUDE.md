@~/projects/CLAUDE.md

# LocalNote

React + FastAPI PWA note-taking app. Tldraw infinite canvas, flat-file JSON storage, iPad over WiFi. No database.

## LocalNote-Specific Stack
- Backend binds `0.0.0.0:8000` — required for iPad WiFi access (not localhost)
- Backend deps: Pillow (PNG→PDF sync), aiofiles, python-multipart
- Frontend deps: tldraw 2.4, pdfjs-dist 4.4 (client-side only), vite-plugin-pwa 0.20
- **Gotcha:** `pdfjs-dist` is excluded from Vite dep optimization in `vite.config.ts` — do not remove that exclusion

## File Map
| File | Purpose |
|------|---------|
| `backend/main.py` | All FastAPI endpoints |
| `frontend/src/main.tsx` | React root, service worker registration |
| `frontend/src/App.tsx` | Shell layout: Sidebar + TopBar + canvas-area div |
| `frontend/src/App.css` | CSS design system, `[data-theme]` dark/light variables |
| `frontend/src/types.ts` | Notebook, Section, Page, AppState, CanvasHandle interfaces |
| `frontend/src/context/AppContext.tsx` | All global state, mutations, backendUrl from localStorage |
| `frontend/src/api/client.ts` | All fetch calls to backend |
| `frontend/src/components/Sidebar.tsx` | 3-level tree with inline rename |
| `frontend/src/components/Settings.tsx` | Backend URL config + dark mode toggle |
| `frontend/src/hooks/useSync.ts` | 30-sec auto-sync hook (wired in Stage 6) |
| `frontend/vite.config.ts` | Vite + PWA plugin, dev host 0.0.0.0 |
| `setup.py` | Generates PWA/iOS icons with Pillow (run once) |
| `PROGRESS.md` | Detailed design decisions |

## Data Model
`backend/data/notebooks.json` — full tree:
```json
{ "notebooks": [{ "id": "uuid", "name": "", "created_at": "", "sections": [
  { "id": "uuid", "notebook_id": "", "name": "", "created_at": "", "pages": [
    { "id": "uuid", "section_id": "", "name": "", "created_at": "", "pdf_id": null }
  ]}
]}]}
```
- Canvas snapshots: `data/pages/{pageId}.json` → `{ "snapshot": { ...tldraw state } }`
- Uploaded PDFs: `data/assets/{fileId}.pdf` (referenced via `page.pdf_id`)
- Sync output: `sync/{NotebookName}/{SectionName}/page-N.png` + `section.pdf`

## API Routes
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/notebooks` | list / create |
| PATCH/DELETE | `/notebooks/{id}` | rename / delete |
| POST | `/notebooks/{nbId}/sections` | create section |
| PATCH/DELETE | `/sections/{id}` | rename / delete |
| POST | `/sections/{secId}/pages` | create page |
| PATCH | `/pages/{id}/name` | rename |
| DELETE | `/pages/{id}` | delete (also removes canvas JSON) |
| GET/PUT | `/pages/{pageId}/canvas` | load / save snapshot |
| POST | `/pages/{pageId}/pdf` | multipart PDF upload |
| POST | `/sync/{nbId}` | base64 PNG array → PNG files + PDFs per section |
| GET | `/health` | `{ status: "ok" }` |

## Architecture Notes
1. `MutableRefObject<Map<pageId, base64PNG>>` for screenshot cache — avoids re-renders; sync hook reads imperatively
2. `backendUrl` in localStorage — iPad and laptop each store their own backend IP
3. `key={pageId}` on tldraw — forces full remount on page switch, clean snapshot lifecycle
4. PDF.js renders PDFs client-side only — Pillow is server-side PNG→PDF sync only
5. Global CORS enabled — no auth yet

## How to Run

**Dev** (two terminals):
```bash
cd backend && python main.py    # FastAPI on :8000
cd frontend && npm run dev      # Vite on :5173 — set backendUrl to http://localhost:8000 in Settings
```

**Production** (single port, iPad-ready):
```bash
python setup.py                 # generate icons (one-time)
cd frontend && npm install      # install deps (one-time)
bash scripts/build.sh           # builds frontend → starts backend on :8000
# iPad opens http://<laptop-ip>:8000 — no backendUrl config needed
```

## Deployment (Local / WSL2)

**Goal:** Laptop starts → backend auto-starts → iPad connects at a fixed URL forever.

**Step 1 — Stable LAN IP (do once, in Windows)**
1. PowerShell: `Get-NetAdapter | Select Name, MacAddress` → find your WiFi adapter MAC
2. Router admin (`http://192.168.1.1`) → DHCP reservations → bind MAC to a fixed IP (e.g. `192.168.1.100`)

**Step 2 — Enable WSL2 systemd (do once, in WSL2)**
```bash
# Add to /etc/wsl.conf (create if missing):
echo -e "[boot]\nsystemd=true" | sudo tee -a /etc/wsl.conf
# Then in PowerShell: wsl --shutdown
```

**Step 3 — Install the systemd service (do once)**
```bash
bash scripts/build.sh           # builds frontend into dist/
sudo cp scripts/localnote.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable localnote
sudo systemctl start localnote
```

**Step 4 — Auto-start WSL2 on Windows login (do once, in Windows)**
- Open Task Scheduler → Create Task → Trigger: "At log on" → Action: `wsl.exe` (no args)
- WSL2 wakes, systemd starts LocalNote automatically

**After code changes:**
```bash
bash scripts/build.sh           # rebuilds frontend; systemd restarts backend
# or: sudo systemctl restart localnote  (backend only)
```

**iPad setup (do once):**
Open LocalNote at `http://192.168.1.100:8000` — no Settings config needed (same-origin default).

---

## Build Stages
- ✅ Stage 1: FastAPI backend, all endpoints, sync PNG→PDF
- ✅ Stage 2: React shell, sidebar, settings, dark/light mode
- 🔲 **Stage 3 (next):** Tldraw canvas
  - Create `src/components/Canvas.tsx`: wraps `<Tldraw>`, loads snapshot on mount (`GET canvas`), saves on store change debounced 1.5s (`PUT canvas`), on unmount saves + writes screenshot to `pageScreenshots` ref, exposes `getScreenshot()`/`saveSnapshot()` via `forwardRef`/`useImperativeHandle`, syncs `isDarkMode` via `editor.user.updateUserPreferences()`
  - Edit `src/App.tsx`: replace `.canvas-placeholder` div with `<Canvas pageId={selectedPage.id} />`
- 🔲 Stage 4: PDF upload → PDF.js render → locked tldraw background layer
- 🔲 Stage 5: PWA manifest + service worker, installable on iPad
- 🔲 Stage 6: Wire `useSync.ts` to canvas screenshots
