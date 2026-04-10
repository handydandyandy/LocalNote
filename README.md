# LocalNote

A private, local-first note-taking app with an infinite canvas. Write and draw on your iPad using Apple Pencil, with your notes stored on your laptop — no cloud, no accounts.

**Stack:** React + tldraw + FastAPI · **Storage:** flat JSON files, no database · **iPad access:** over WiFi or Tailscale

---

## What it does

- Infinite canvas powered by [tldraw](https://tldraw.com) — draw, write, type, stick arrows
- Organise notes into **Notebooks → Sections → Pages** (like OneNote)
- **Attach a PDF** to any page as a locked background — annotate lecture slides directly
- **Auto-saves** every 1.5 seconds as you draw; **syncs** every 30 seconds to PNG + PDF files on disk
- Installs as a PWA on iPad (full-screen, no browser chrome, works offline)
- Dark and light mode

---

## First-time setup

### 1. Install Python deps and generate icons

```bash
cd /path/to/LocalNote
pip install fastapi "uvicorn[standard]" python-multipart Pillow aiofiles
python3 setup.py        # creates icon-192.png, icon-512.png, apple-touch-icon.png
```

### 2. Install frontend deps

```bash
cd frontend
npm install
```

### 3. Create a Python virtual environment for the backend (recommended)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi "uvicorn[standard]" python-multipart Pillow aiofiles
```

---

## Running the app

### Development (two terminals)

```bash
# Terminal 1 — backend
cd backend
source venv/bin/activate
python3 main.py          # runs on http://localhost:8000

# Terminal 2 — frontend
cd frontend
npm run dev              # runs on http://localhost:5173
```

Open http://localhost:5173 in your browser. Go to **Settings (⚙)** and set the backend URL to `http://localhost:8000`.

### Production (single command, iPad-ready)

```bash
bash scripts/build.sh
```

This builds the frontend into `frontend/dist/` and starts the backend on port 8000. The backend serves the frontend, so everything is at one URL.

Open `http://<your-laptop-ip>:8000` on your iPad.

> **Find your laptop's IP:** run `ip addr show eth0` (or `hostname -I`) in the terminal.

---

## Connecting your iPad

### Option A — Same WiFi (simple)

1. Make sure your laptop and iPad are on the same WiFi network
2. Find your laptop's local IP: `hostname -I | awk '{print $1}'`
3. Open Safari on your iPad → `http://<that-ip>:8000`

The IP may change occasionally. If it does, just look it up again.

### Option B — Tailscale (stable, works anywhere)

Tailscale gives both devices a permanent address that never changes, even across different networks.

```bash
# On your laptop (WSL2)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# → opens a browser link to authenticate

tailscale ip -4          # your stable Tailscale IP
```

Install the **Tailscale** app on your iPad from the App Store, sign in with the same account. Then on iPad, open Safari → `http://<tailscale-ip>:8000`.

---

## Installing as a PWA on iPad

Once the app is open in Safari:

1. Tap the **Share** button (box with arrow)
2. Tap **Add to Home Screen**
3. Tap **Add**

The app now opens full-screen from your home screen, with no browser UI.

---

## Auto-start on boot (optional, WSL2)

Keep the app running automatically whenever your laptop starts.

### Step 1 — Enable WSL2 systemd (once)

```bash
# In WSL2:
echo -e "[boot]\nsystemd=true" | sudo tee -a /etc/wsl.conf
# Then in PowerShell: wsl --shutdown
```

### Step 2 — Install the service (once)

```bash
bash scripts/build.sh                                  # build first
sudo cp scripts/localnote.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable localnote
sudo systemctl start localnote
```

### Step 3 — Auto-start WSL2 on Windows login (once)

Open **Task Scheduler** → Create Task → Trigger: "At log on" → Action: `wsl.exe` (no arguments).

### After code changes

```bash
bash scripts/build.sh           # rebuilds and restarts via systemd
# or just restart the backend:
sudo systemctl restart localnote
```

---

## Using the app

### Organising notes

- **Sidebar** — create notebooks, sections, and pages with the **+** buttons
- **Double-click** any name to rename it
- **Delete** with the trash icon (appears on hover)

### Drawing and writing

- Use tldraw's toolbar to switch between tools: pen, shapes, text, arrows, eraser
- Apple Pencil draws naturally; palm rejection is handled by tldraw
- Canvas saves automatically as you work

### Attaching a PDF

1. Select a page in the sidebar
2. Click **📄** in the top bar and choose a PDF file
3. The PDF renders as a locked background — draw on top of it
4. Uploading a new PDF replaces the existing one

### Syncing

The app syncs automatically every 30 seconds when a notebook is open. You can also click **⟳** in the top bar to sync immediately.

Sync output lives in `backend/sync/<NotebookName>/<SectionName>/`:
- `page-1.png`, `page-2.png`, … — one PNG per page
- `section.pdf` — all pages compiled into a single PDF

### Dark mode

Click **☾/☀** in the top bar to toggle. Your preference is saved.

---

## Data

All data is stored locally in `backend/data/`:

```
backend/data/
  notebooks.json        # notebook/section/page tree
  pages/
    <pageId>.json       # tldraw canvas snapshot per page
  assets/
    <fileId>.pdf        # uploaded PDFs
```

To back up your notes, copy the `backend/data/` folder.

---

## Project layout

```
LocalNote/
  backend/
    main.py             # FastAPI server, all endpoints
    requirements.txt
    data/               # created on first run
  frontend/
    src/
      App.tsx           # shell layout, topbar
      components/
        Canvas.tsx      # tldraw wrapper, PDF rendering
        Sidebar.tsx     # notebook/section/page tree
        Settings.tsx    # backend URL + dark mode
      context/
        AppContext.tsx  # global state
      hooks/
        useSync.ts      # 30-second sync loop
      api/
        client.ts       # all fetch calls
  scripts/
    build.sh            # build + start
    localnote.service   # systemd unit
  setup.py              # generates PWA icons
```
