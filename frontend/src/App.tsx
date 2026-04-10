import React from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Sidebar } from './components/Sidebar'
import { Settings } from './components/Settings'
import { Canvas } from './components/Canvas'

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
  } = useApp()

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

      {/* canvas-injected tools sit here (Stage 3) */}
      <div className="topbar-tools">{canvasSlot}</div>

      <div className="topbar-right">
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
  const { settingsOpen, selectedPage, canvasRef } = useApp()

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-area">
        <TopBar />

        <div className="canvas-area" id="canvas-root">
          {selectedPage
            ? <Canvas key={selectedPage.id} ref={canvasRef} pageId={selectedPage.id} />
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
