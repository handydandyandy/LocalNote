"""
LocalNote Backend — FastAPI
Flat-file storage: data/notebooks.json, data/pages/*.json, data/assets/*
"""
from __future__ import annotations

import base64
import io
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image

# ── paths ────────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
DATA_DIR    = BASE_DIR / "data"
PAGES_DIR   = DATA_DIR / "pages"
ASSETS_DIR  = DATA_DIR / "assets"
SYNC_DIR    = BASE_DIR / "sync"
NB_FILE     = DATA_DIR / "notebooks.json"

for d in (DATA_DIR, PAGES_DIR, ASSETS_DIR, SYNC_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── app ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="LocalNote")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# serve uploaded PDFs
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

# ── storage helpers ───────────────────────────────────────────────────────────
def _load() -> dict:
    if not NB_FILE.exists():
        return {"notebooks": []}
    return json.loads(NB_FILE.read_text())

def _save(data: dict) -> None:
    NB_FILE.write_text(json.dumps(data, indent=2))

def _safe(name: str) -> str:
    """Filesystem-safe name."""
    return "".join(c for c in name if c.isalnum() or c in " -_()").strip() or "untitled"

# ── pydantic models ───────────────────────────────────────────────────────────
class NameBody(BaseModel):
    name: str

class CanvasBody(BaseModel):
    snapshot: dict

class SyncPageItem(BaseModel):
    page_id: str
    section_id: str
    section_name: str
    page_name: str
    page_number: int
    image: str                # base64-encoded PNG

class SyncBody(BaseModel):
    notebook_name: str
    pages: List[SyncPageItem]

# ── notebooks ─────────────────────────────────────────────────────────────────
@app.get("/notebooks")
def list_notebooks():
    return _load()["notebooks"]

@app.post("/notebooks", status_code=201)
def create_notebook(body: NameBody):
    data = _load()
    nb = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "created_at": datetime.now().isoformat(),
        "sections": [],
    }
    data["notebooks"].append(nb)
    _save(data)
    return nb

@app.patch("/notebooks/{nb_id}")
def rename_notebook(nb_id: str, body: NameBody):
    data = _load()
    for nb in data["notebooks"]:
        if nb["id"] == nb_id:
            nb["name"] = body.name
            _save(data)
            return nb
    raise HTTPException(404, "Notebook not found")

@app.delete("/notebooks/{nb_id}")
def delete_notebook(nb_id: str):
    data = _load()
    data["notebooks"] = [n for n in data["notebooks"] if n["id"] != nb_id]
    _save(data)
    return {"status": "deleted"}

# ── sections ──────────────────────────────────────────────────────────────────
@app.get("/notebooks/{nb_id}/sections")
def list_sections(nb_id: str):
    data = _load()
    for nb in data["notebooks"]:
        if nb["id"] == nb_id:
            return nb.get("sections", [])
    raise HTTPException(404, "Notebook not found")

@app.post("/notebooks/{nb_id}/sections", status_code=201)
def create_section(nb_id: str, body: NameBody):
    data = _load()
    for nb in data["notebooks"]:
        if nb["id"] == nb_id:
            sec = {
                "id": str(uuid.uuid4()),
                "notebook_id": nb_id,
                "name": body.name,
                "created_at": datetime.now().isoformat(),
                "pages": [],
            }
            nb.setdefault("sections", []).append(sec)
            _save(data)
            return sec
    raise HTTPException(404, "Notebook not found")

@app.patch("/sections/{sec_id}")
def rename_section(sec_id: str, body: NameBody):
    data = _load()
    for nb in data["notebooks"]:
        for sec in nb.get("sections", []):
            if sec["id"] == sec_id:
                sec["name"] = body.name
                _save(data)
                return sec
    raise HTTPException(404, "Section not found")

@app.delete("/sections/{sec_id}")
def delete_section(sec_id: str):
    data = _load()
    for nb in data["notebooks"]:
        nb["sections"] = [s for s in nb.get("sections", []) if s["id"] != sec_id]
    _save(data)
    return {"status": "deleted"}

# ── pages ─────────────────────────────────────────────────────────────────────
@app.get("/sections/{sec_id}/pages")
def list_pages(sec_id: str):
    data = _load()
    for nb in data["notebooks"]:
        for sec in nb.get("sections", []):
            if sec["id"] == sec_id:
                return sec.get("pages", [])
    raise HTTPException(404, "Section not found")

@app.post("/sections/{sec_id}/pages", status_code=201)
def create_page(sec_id: str, body: NameBody):
    data = _load()
    for nb in data["notebooks"]:
        for sec in nb.get("sections", []):
            if sec["id"] == sec_id:
                pg = {
                    "id": str(uuid.uuid4()),
                    "section_id": sec_id,
                    "name": body.name,
                    "created_at": datetime.now().isoformat(),
                    "pdf_id": None,
                }
                sec.setdefault("pages", []).append(pg)
                _save(data)
                return pg
    raise HTTPException(404, "Section not found")

@app.patch("/pages/{page_id}/name")
def rename_page(page_id: str, body: NameBody):
    data = _load()
    for nb in data["notebooks"]:
        for sec in nb.get("sections", []):
            for pg in sec.get("pages", []):
                if pg["id"] == page_id:
                    pg["name"] = body.name
                    _save(data)
                    return pg
    raise HTTPException(404, "Page not found")

@app.delete("/pages/{page_id}")
def delete_page(page_id: str):
    data = _load()
    for nb in data["notebooks"]:
        for sec in nb.get("sections", []):
            sec["pages"] = [p for p in sec.get("pages", []) if p["id"] != page_id]
    _save(data)
    canvas_file = PAGES_DIR / f"{page_id}.json"
    if canvas_file.exists():
        canvas_file.unlink()
    return {"status": "deleted"}

# ── canvas ────────────────────────────────────────────────────────────────────
@app.get("/pages/{page_id}/canvas")
def get_canvas(page_id: str):
    f = PAGES_DIR / f"{page_id}.json"
    if not f.exists():
        return {"snapshot": None}
    return json.loads(f.read_text())

@app.put("/pages/{page_id}/canvas")
def save_canvas(page_id: str, body: CanvasBody):
    f = PAGES_DIR / f"{page_id}.json"
    f.write_text(json.dumps({"snapshot": body.snapshot}))
    return {"status": "saved"}

# ── PDF upload ────────────────────────────────────────────────────────────────
@app.post("/pages/{page_id}/pdf")
async def upload_pdf(page_id: str, file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    pdf_path = ASSETS_DIR / f"{file_id}.pdf"
    content = await file.read()
    pdf_path.write_bytes(content)

    data = _load()
    for nb in data["notebooks"]:
        for sec in nb.get("sections", []):
            for pg in sec.get("pages", []):
                if pg["id"] == page_id:
                    pg["pdf_id"] = file_id
    _save(data)

    return {"file_id": file_id, "url": f"/assets/{file_id}.pdf"}

# ── sync ──────────────────────────────────────────────────────────────────────
@app.post("/sync/{nb_id}")
def sync_notebook(nb_id: str, body: SyncBody):
    nb_dir = SYNC_DIR / _safe(body.notebook_name)
    nb_dir.mkdir(parents=True, exist_ok=True)

    # Group by section
    sections: dict[str, list[SyncPageItem]] = {}
    for page in body.pages:
        sections.setdefault(page.section_name, []).append(page)

    result_sections = []
    for sec_name, pages in sections.items():
        pages.sort(key=lambda p: p.page_number)
        sec_dir = nb_dir / _safe(sec_name)
        sec_dir.mkdir(parents=True, exist_ok=True)

        pil_images: list[Image.Image] = []
        for i, page in enumerate(pages, 1):
            try:
                img_bytes = base64.b64decode(page.image)
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                png_path = sec_dir / f"page-{i}.png"
                img.save(str(png_path), "PNG")
                pil_images.append(img)
            except Exception as exc:
                print(f"[sync] Failed to process page {page.page_id}: {exc}")

        if pil_images:
            pdf_path = sec_dir / "section.pdf"
            try:
                pil_images[0].save(
                    str(pdf_path),
                    format="PDF",
                    save_all=True,
                    append_images=pil_images[1:],
                )
                result_sections.append(sec_name)
            except Exception as exc:
                print(f"[sync] PDF compile failed for {sec_name}: {exc}")

    return {"status": "ok", "notebook": body.notebook_name, "sections": result_sections}

# ── health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}

# ── frontend (production) ─────────────────────────────────────────────────────
# Serve the built frontend. Only active after `npm run build` in frontend/.
# In dev, comment this out and use `npm run dev` instead.
_dist = (BASE_DIR / ".." / "frontend" / "dist").resolve()
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
