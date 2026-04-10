import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import { Tldraw, exportToBlob } from '@tldraw/tldraw'
import type { Editor, TLEditorSnapshot } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import type { CanvasHandle } from '../types'
import { api } from '../api/client'
import { useApp } from '../context/AppContext'

interface Props {
  pageId: string
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { pageId },
  ref
) {
  const { darkMode, pageScreenshots } = useApp()
  const editorRef = useRef<Editor | null>(null)
  const unlistenRef = useRef<(() => void) | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stable ref so unmount cleanup always calls the latest version
  const darkModeRef = useRef(darkMode)
  useEffect(() => { darkModeRef.current = darkMode }, [darkMode])

  const doSave = useCallback(async () => {
    const editor = editorRef.current
    if (!editor) return
    try {
      await api.saveCanvas(pageId, editor.getSnapshot())
    } catch (err) {
      console.error('Canvas save failed:', err)
    }
  }, [pageId])

  const getScreenshot = useCallback(async (): Promise<string | null> => {
    const editor = editorRef.current
    if (!editor) return null
    try {
      const ids = [...editor.getCurrentPageShapeIds()]
      if (ids.length === 0) return null
      const blob = await exportToBlob({
        editor,
        ids,
        format: 'png',
        opts: { scale: 0.5 },
      })
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          resolve(dataUrl.split(',')[1] ?? null)
        }
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }, [])

  useImperativeHandle(ref, () => ({ getScreenshot, saveSnapshot: doSave }), [
    getScreenshot,
    doSave,
  ])

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    editor.user.updateUserPreferences({ isDarkMode: darkModeRef.current })

    // Load existing snapshot from backend
    api
      .getCanvas(pageId)
      .then(({ snapshot }) => {
        if (snapshot) editor.loadSnapshot(snapshot as TLEditorSnapshot)
      })
      .catch((err) => console.error('Canvas load failed:', err))

    // Auto-save 1.5 s after each user edit (not programmatic loads)
    unlistenRef.current = editor.store.listen(
      () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(doSave, 1500)
      },
      { scope: 'document', source: 'user' }
    )
  // pageId and doSave are stable for the lifetime of this component instance
  // (remount via key={pageId} handles page switches)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep tldraw dark mode in sync when the user toggles it
  useEffect(() => {
    editorRef.current?.user.updateUserPreferences({ isDarkMode: darkMode })
  }, [darkMode])

  // Final save + screenshot on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      unlistenRef.current?.()
      doSave()
      getScreenshot().then((png) => {
        if (png) pageScreenshots.current.set(pageId, png)
      })
    }
    // Intentionally empty — runs once on unmount; doSave/getScreenshot are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Tldraw onMount={handleMount} />
    </div>
  )
})
