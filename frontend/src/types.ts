export interface Notebook {
  id: string
  name: string
  created_at: string
  sections: Section[]
}

export interface Section {
  id: string
  notebook_id: string
  name: string
  created_at: string
  pages: Page[]
}

export interface Page {
  id: string
  section_id: string
  name: string
  created_at: string
  pdf_id: string | null
}

export interface AppState {
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
}

export interface CanvasHandle {
  getScreenshot: () => Promise<string | null>
  saveSnapshot: () => Promise<void>
}
