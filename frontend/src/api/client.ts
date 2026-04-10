import type { Notebook, Section, Page } from '../types'

export function getBackendUrl(): string {
  // In production (frontend served by FastAPI on :8000), origin is correct automatically.
  // In dev (Vite on :5173), set backendUrl manually in Settings to http://localhost:8000.
  return localStorage.getItem('backendUrl') || window.location.origin
}

export function setBackendUrl(url: string): void {
  localStorage.setItem('backendUrl', url.replace(/\/$/, ''))
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBackendUrl()}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

// ── notebooks ────────────────────────────────────────────────────────────────
export const api = {
  getNotebooks: () => req<Notebook[]>('/notebooks'),

  createNotebook: (name: string) =>
    req<Notebook>('/notebooks', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  renameNotebook: (id: string, name: string) =>
    req<Notebook>(`/notebooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteNotebook: (id: string) =>
    req<{ status: string }>(`/notebooks/${id}`, { method: 'DELETE' }),

  // ── sections ──────────────────────────────────────────────────────────────
  getSections: (nbId: string) => req<Section[]>(`/notebooks/${nbId}/sections`),

  createSection: (nbId: string, name: string) =>
    req<Section>(`/notebooks/${nbId}/sections`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  renameSection: (id: string, name: string) =>
    req<Section>(`/sections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteSection: (id: string) =>
    req<{ status: string }>(`/sections/${id}`, { method: 'DELETE' }),

  // ── pages ─────────────────────────────────────────────────────────────────
  getPages: (secId: string) => req<Page[]>(`/sections/${secId}/pages`),

  createPage: (secId: string, name: string) =>
    req<Page>(`/sections/${secId}/pages`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  renamePage: (id: string, name: string) =>
    req<Page>(`/pages/${id}/name`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deletePage: (id: string) =>
    req<{ status: string }>(`/pages/${id}`, { method: 'DELETE' }),

  // ── canvas ────────────────────────────────────────────────────────────────
  getCanvas: (pageId: string) =>
    req<{ snapshot: object | null }>(`/pages/${pageId}/canvas`),

  saveCanvas: (pageId: string, snapshot: object) =>
    req<{ status: string }>(`/pages/${pageId}/canvas`, {
      method: 'PUT',
      body: JSON.stringify({ snapshot }),
    }),

  // ── PDF ───────────────────────────────────────────────────────────────────
  uploadPdf: async (pageId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${getBackendUrl()}/pages/${pageId}/pdf`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json() as Promise<{ file_id: string; url: string }>
  },

  getPdfUrl: (fileId: string) => `${getBackendUrl()}/files/${fileId}.pdf`,

  // ── sync ──────────────────────────────────────────────────────────────────
  sync: (
    nbId: string,
    notebookName: string,
    pages: Array<{
      page_id: string
      section_id: string
      section_name: string
      page_name: string
      page_number: number
      image: string
    }>
  ) =>
    req<{ status: string; sections: string[] }>(`/sync/${nbId}`, {
      method: 'POST',
      body: JSON.stringify({ notebook_name: notebookName, pages }),
    }),
}
