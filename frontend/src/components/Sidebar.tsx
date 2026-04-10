import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import type { Notebook, Section, Page } from '../types'

// ── inline-edit helper ────────────────────────────────────────────────────────
function InlineEdit({
  value,
  onSave,
  className,
}: {
  value: string
  onSave: (name: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`inline-edit ${className ?? ''}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        onClick={e => e.stopPropagation()}
      />
    )
  }

  return (
    <span
      className={className}
      onDoubleClick={e => { e.stopPropagation(); setEditing(true); setDraft(value) }}
      title="Double-click to rename"
    >
      {value}
    </span>
  )
}

// ── page item ─────────────────────────────────────────────────────────────────
function PageItem({ page, section }: { page: Page; section: Section }) {
  const { selectedPage, selectPage, renamePage, deletePage } = useApp()
  const active = selectedPage?.id === page.id

  return (
    <div
      className={`sidebar-page ${active ? 'active' : ''}`}
      onClick={() => selectPage(page)}
    >
      <span className="page-icon">📄</span>
      <InlineEdit
        value={page.name}
        onSave={name => renamePage(page.id, name)}
        className="item-label"
      />
      <button
        className="icon-btn danger"
        title="Delete page"
        onClick={e => {
          e.stopPropagation()
          if (confirm(`Delete page "${page.name}"?`)) deletePage(page.id)
        }}
      >
        ×
      </button>
    </div>
  )
}

// ── section item ──────────────────────────────────────────────────────────────
function SectionItem({ section }: { section: Section }) {
  const {
    selectedSection,
    selectedNotebook,
    selectSection,
    renameSection,
    deleteSection,
    createPage,
    selectPage,
  } = useApp()

  const [open, setOpen] = useState(selectedSection?.id === section.id)

  useEffect(() => {
    if (selectedSection?.id === section.id) setOpen(true)
  }, [selectedSection, section.id])

  const active = selectedSection?.id === section.id

  const addPage = async (e: React.MouseEvent) => {
    e.stopPropagation()
    selectSection(section)
    const name = prompt('Page name:', `Page ${section.pages.length + 1}`)
    if (name?.trim()) {
      await createPage(name.trim())
    }
  }

  return (
    <div className="sidebar-section">
      <div
        className={`sidebar-section-header ${active ? 'active' : ''}`}
        onClick={() => {
          selectSection(section)
          setOpen(o => !o)
        }}
      >
        <span className="chevron">{open ? '▾' : '▸'}</span>
        <InlineEdit
          value={section.name}
          onSave={name => renameSection(section.id, name)}
          className="item-label"
        />
        <div className="row-actions">
          <button className="icon-btn" title="Add page" onClick={addPage}>+</button>
          <button
            className="icon-btn danger"
            title="Delete section"
            onClick={e => {
              e.stopPropagation()
              if (confirm(`Delete section "${section.name}" and all its pages?`))
                deleteSection(section.id)
            }}
          >
            ×
          </button>
        </div>
      </div>

      {open && (
        <div className="sidebar-pages">
          {section.pages.length === 0 && (
            <div className="empty-hint">No pages yet</div>
          )}
          {section.pages.map(pg => (
            <PageItem key={pg.id} page={pg} section={section} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── notebook item ─────────────────────────────────────────────────────────────
function NotebookItem({ notebook }: { notebook: Notebook }) {
  const {
    selectedNotebook,
    selectNotebook,
    renameNotebook,
    deleteNotebook,
    createSection,
    selectSection,
  } = useApp()

  const [open, setOpen] = useState(selectedNotebook?.id === notebook.id)

  useEffect(() => {
    if (selectedNotebook?.id === notebook.id) setOpen(true)
  }, [selectedNotebook, notebook.id])

  const active = selectedNotebook?.id === notebook.id

  const addSection = async (e: React.MouseEvent) => {
    e.stopPropagation()
    selectNotebook(notebook)
    const name = prompt('Section name:', `Section ${notebook.sections.length + 1}`)
    if (name?.trim()) {
      await createSection(name.trim())
    }
  }

  return (
    <div className="sidebar-notebook">
      <div
        className={`sidebar-notebook-header ${active ? 'active' : ''}`}
        onClick={() => {
          selectNotebook(notebook)
          setOpen(o => !o)
        }}
      >
        <span className="nb-icon">📓</span>
        <InlineEdit
          value={notebook.name}
          onSave={name => renameNotebook(notebook.id, name)}
          className="item-label flex-1"
        />
        <div className="row-actions">
          <button className="icon-btn" title="Add section" onClick={addSection}>+</button>
          <button
            className="icon-btn danger"
            title="Delete notebook"
            onClick={e => {
              e.stopPropagation()
              if (confirm(`Delete notebook "${notebook.name}" and everything inside?`))
                deleteNotebook(notebook.id)
            }}
          >
            ×
          </button>
        </div>
        <span className="chevron">{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <div className="sidebar-sections">
          {notebook.sections.length === 0 && (
            <div className="empty-hint">No sections — click + to add one</div>
          )}
          {notebook.sections.map(sec => (
            <SectionItem key={sec.id} section={sec} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── main sidebar ───────────────────────────────────────────────────────────────
export function Sidebar() {
  const { notebooks, sidebarOpen, createNotebook } = useApp()

  const addNotebook = async () => {
    const name = prompt('Notebook name:', `Notebook ${notebooks.length + 1}`)
    if (name?.trim()) await createNotebook(name.trim())
  }

  if (!sidebarOpen) return null

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">LocalNote</span>
        <button className="btn-primary small" onClick={addNotebook} title="New notebook">
          + Notebook
        </button>
      </div>

      <div className="sidebar-list">
        {notebooks.length === 0 && (
          <div className="empty-hint center">
            No notebooks yet.<br />Click "+ Notebook" to start.
          </div>
        )}
        {notebooks.map(nb => (
          <NotebookItem key={nb.id} notebook={nb} />
        ))}
      </div>
    </aside>
  )
}
