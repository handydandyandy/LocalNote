import React, { useRef, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Sidebar } from './components/Sidebar'
import { Settings } from './components/Settings'
import { Canvas } from './components/Canvas'
import type { CanvasHandle } from './types'
import { api } from './api/client'
import { useSync } from './hooks/useSync'

// ── top bar ───────────────────────────────────────────────────────────────────
function TopBar({ canvasSlot }: { canvasSlot?: React.ReactNode }) {
  const {
    sidebarOpen,
    setSidebarOpen,
    darkMode,
    toggleDarkMode,
    setSettingsOpen,
    selectedNotebook,
    selectedSection,
    selectedPage,
    syncStatus,
    lastSyncTime,
    loadNotebooks,
  } = useApp()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedPage) return
    setUploading(true)
    try {
      await api.uploadPdf(selectedPage.id, file)
      await loadNotebooks()
    } catch (err) {
      console.error('PDF upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const syncLabel =
    syncStatus === 'syncing' ? '⟳ Syncing…'
    : syncStatus === 'ok'     ? `✓ Synced ${lastSyncTime ? formatTime(lastSyncTime) : ''}`
    : syncStatus === 'error'  ? '✗ Sync failed'
    : ''

  return (
    <header className="topbar">
      <button
        className="icon-btn topbar-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      <nav className="breadcrumb" aria-label="breadcrumb">
        {selectedNotebook && <span className="crumb">{selectedNotebook.name}</span>}
        {selectedSection  && <><span className="crumb-sep">/</span><span className="crumb">{selectedSection.name}</span></>}
        {selectedPage     && <><span className="crumb-sep">/</span><span className="crumb active">{selectedPage.name}</span></>}
      </nav>

      <div className="topbar-tools">{canvasSlot}</div>

      <div className="topbar-right">
        {selectedPage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handlePdfUpload}
            />
            <button
              className="icon-btn topbar-btn"
              onClick={() => fileInputRef.current?.click()}
              title={selectedPage.pdf_id ? 'Replace PDF background' : 'Attach PDF background'}
              aria-label="Upload PDF"
              disabled={uploading}
            >
              {uploading ? '⟳' : selectedPage.pdf_id ? '📄✓' : '📄'}
            </button>
          </>
        )}
        {syncLabel && <span className={`sync-badge ${syncStatus}`}>{syncLabel}</span>}
        <button
          className="icon-btn topbar-btn"
          onClick={toggleDarkMode}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
        >
          {darkMode ? '☀' : '☾'}
        </button>
        <button
          className="icon-btn topbar-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  )
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">📓</div>
      <h2>LocalNote</h2>
      <p>Select a page from the sidebar to start writing,<br />or create a new notebook.</p>
    </div>
  )
}

// ── main shell ────────────────────────────────────────────────────────────────
function Shell() {
  const { settingsOpen, selectedPage, canvasRef, syncStatus } = useApp()
  const { runSync } = useSync()

  const syncBtn = selectedPage ? (
    <button
      className="icon-btn topbar-btn"
      onClick={runSync}
      title="Sync now"
      aria-label="Sync now"
      disabled={syncStatus === 'syncing'}
    >
      ⟳
    </button>
  ) : null

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-area">
        <TopBar canvasSlot={syncBtn} />

        <div className="canvas-area" id="canvas-root">
          {selectedPage
            ? (
              <Canvas
                key={selectedPage.id}
                ref={canvasRef as React.RefObject<CanvasHandle>}
                pageId={selectedPage.id}
                pdfId={selectedPage.pdf_id}
              />
            )
            : <EmptyState />
          }
        </div>
      </div>

      {settingsOpen && <Settings />}
    </div>
  )
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
