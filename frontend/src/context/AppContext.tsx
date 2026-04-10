import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Notebook, Section, Page, CanvasHandle } from '../types'
import { api, getBackendUrl, setBackendUrl } from '../api/client'

// ── types ─────────────────────────────────────────────────────────────────────
interface AppCtx {
  notebooks: Notebook[]
  selectedNotebook: Notebook | null
  selectedSection: Section | null
  selectedPage: Page | null
  sidebarOpen: boolean
  darkMode: boolean
  settingsOpen: boolean
  backendUrl: string
  syncStatus: 'idle' | 'syncing' | 'ok' | 'error'
  lastSyncTime: Date | null

  /** Screenshots cache: pageId → base64 PNG (no data: prefix) */
  pageScreenshots: React.MutableRefObject<Map<string, string>>
  /** Ref to the active canvas component */
  canvasRef: React.RefObject<CanvasHandle | null>

  loadNotebooks: () => Promise<void>
  selectNotebook: (nb: Notebook | null) => void
  selectSection: (sec: Section | null) => void
  selectPage: (page: Page | null) => void
  createNotebook: (name: string) => Promise<void>
  createSection: (name: string) => Promise<void>
  createPage: (name: string) => Promise<void>
  renameNotebook: (id: string, name: string) => Promise<void>
  renameSection: (id: string, name: string) => Promise<void>
  renamePage: (id: string, name: string) => Promise<void>
  deleteNotebook: (id: string) => Promise<void>
  deleteSection: (id: string) => Promise<void>
  deletePage: (id: string) => Promise<void>
  setSidebarOpen: (v: boolean) => void
  toggleDarkMode: () => void
  setSettingsOpen: (v: boolean) => void
  saveBackendUrl: (url: string) => void
  setSyncStatus: (s: 'idle' | 'syncing' | 'ok' | 'error') => void
  setLastSyncTime: (d: Date) => void
}

const Ctx = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}

// ── provider ──────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null)
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)
  const [selectedPage, setSelectedPage] = useState<Page | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') !== 'false'
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backendUrl, setBackendUrlState] = useState(getBackendUrl)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  const pageScreenshots = useRef<Map<string, string>>(new Map())
  const canvasRef = useRef<CanvasHandle | null>(null)

  // ── data loading ────────────────────────────────────────────────────────────
  const loadNotebooks = useCallback(async () => {
    try {
      const nbs = await api.getNotebooks()
      setNotebooks(nbs)
    } catch (err) {
      console.error('Failed to load notebooks:', err)
    }
  }, [])

  useEffect(() => { loadNotebooks() }, [loadNotebooks])

  // ── dark mode ────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('darkMode', darkMode ? 'true' : 'false')
  }, [darkMode])

  // ── selection helpers ────────────────────────────────────────────────────────
  const selectNotebook = useCallback((nb: Notebook | null) => {
    setSelectedNotebook(nb)
    setSelectedSection(null)
    setSelectedPage(null)
  }, [])

  const selectSection = useCallback((sec: Section | null) => {
    setSelectedSection(sec)
    setSelectedPage(null)
  }, [])

  const selectPage = useCallback((page: Page | null) => {
    setSelectedPage(page)
  }, [])

  // ── mutating helpers ─────────────────────────────────────────────────────────
  const createNotebook = useCallback(async (name: string) => {
    await api.createNotebook(name)
    await loadNotebooks()
  }, [loadNotebooks])

  const createSection = useCallback(async (name: string) => {
    if (!selectedNotebook) return
    await api.createSection(selectedNotebook.id, name)
    await loadNotebooks()
  }, [selectedNotebook, loadNotebooks])

  const createPage = useCallback(async (name: string) => {
    if (!selectedSection) return
    const pg = await api.createPage(selectedSection.id, name)
    await loadNotebooks()
    setSelectedPage(pg)
  }, [selectedSection, loadNotebooks])

  const renameNotebook = useCallback(async (id: string, name: string) => {
    await api.renameNotebook(id, name)
    await loadNotebooks()
    setSelectedNotebook(prev => prev?.id === id ? { ...prev, name } : prev)
  }, [loadNotebooks])

  const renameSection = useCallback(async (id: string, name: string) => {
    await api.renameSection(id, name)
    await loadNotebooks()
    setSelectedSection(prev => prev?.id === id ? { ...prev, name } : prev)
  }, [loadNotebooks])

  const renamePage = useCallback(async (id: string, name: string) => {
    await api.renamePage(id, name)
    await loadNotebooks()
    setSelectedPage(prev => prev?.id === id ? { ...prev, name } : prev)
  }, [loadNotebooks])

  const deleteNotebook = useCallback(async (id: string) => {
    await api.deleteNotebook(id)
    await loadNotebooks()
    if (selectedNotebook?.id === id) selectNotebook(null)
  }, [selectedNotebook, loadNotebooks, selectNotebook])

  const deleteSection = useCallback(async (id: string) => {
    await api.deleteSection(id)
    await loadNotebooks()
    if (selectedSection?.id === id) selectSection(null)
  }, [selectedSection, loadNotebooks, selectSection])

  const deletePage = useCallback(async (id: string) => {
    await api.deletePage(id)
    await loadNotebooks()
    if (selectedPage?.id === id) selectPage(null)
  }, [selectedPage, loadNotebooks, selectPage])

  const toggleDarkMode = useCallback(() => setDarkMode(v => !v), [])

  const saveBackendUrl = useCallback((url: string) => {
    setBackendUrl(url)
    setBackendUrlState(url)
  }, [])

  const ctx: AppCtx = {
    notebooks,
    selectedNotebook,
    selectedSection,
    selectedPage,
    sidebarOpen,
    darkMode,
    settingsOpen,
    backendUrl,
    syncStatus,
    lastSyncTime,
    pageScreenshots,
    canvasRef,
    loadNotebooks,
    selectNotebook,
    selectSection,
    selectPage,
    createNotebook,
    createSection,
    createPage,
    renameNotebook,
    renameSection,
    renamePage,
    deleteNotebook,
    deleteSection,
    deletePage,
    setSidebarOpen,
    toggleDarkMode,
    setSettingsOpen,
    saveBackendUrl,
    setSyncStatus,
    setLastSyncTime,
  }

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
}
