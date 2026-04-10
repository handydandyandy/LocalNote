import { useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { api } from '../api/client'

const SYNC_INTERVAL_MS = 30_000

/**
 * Every SYNC_INTERVAL_MS seconds:
 *  1. Screenshot every visited page in the current notebook
 *  2. Screenshot the active page (via canvasRef)
 *  3. POST to /sync/{notebookId}
 */
export function useSync() {
  const {
    selectedNotebook,
    selectedSection,
    selectedPage,
    notebooks,
    pageScreenshots,
    canvasRef,
    setSyncStatus,
    setLastSyncTime,
  } = useApp()

  const runSync = useCallback(async () => {
    if (!selectedNotebook) return

    setSyncStatus('syncing')

    // Gather pages from all sections in the current notebook
    const nb = notebooks.find(n => n.id === selectedNotebook.id)
    if (!nb) {
      setSyncStatus('idle')
      return
    }

    // Capture current page screenshot fresh
    if (selectedPage && canvasRef.current) {
      try {
        const shot = await canvasRef.current.getScreenshot()
        if (shot) pageScreenshots.current.set(selectedPage.id, shot)
      } catch (err) {
        console.warn('[sync] Current page screenshot failed:', err)
      }
    }

    // Build sync payload
    const syncPages: Array<{
      page_id: string
      section_id: string
      section_name: string
      page_name: string
      page_number: number
      image: string
    }> = []

    for (const sec of nb.sections) {
      for (let i = 0; i < sec.pages.length; i++) {
        const pg = sec.pages[i]
        const screenshot = pageScreenshots.current.get(pg.id)
        if (!screenshot) continue          // never visited — skip
        syncPages.push({
          page_id: pg.id,
          section_id: sec.id,
          section_name: sec.name,
          page_name: pg.name,
          page_number: i + 1,
          image: screenshot,
        })
      }
    }

    if (syncPages.length === 0) {
      setSyncStatus('idle')
      return
    }

    try {
      await api.sync(nb.id, nb.name, syncPages)
      setSyncStatus('ok')
      setLastSyncTime(new Date())
    } catch (err) {
      console.error('[sync] Failed:', err)
      setSyncStatus('error')
    }
  }, [
    selectedNotebook,
    selectedPage,
    notebooks,
    pageScreenshots,
    canvasRef,
    setSyncStatus,
    setLastSyncTime,
  ])

  // Auto-sync every 30 s
  useEffect(() => {
    const id = setInterval(runSync, SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [runSync])

  return { runSync }
}
