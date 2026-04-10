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

// ── PDF background renderer ───────────────────────────────────────────────────

let workerConfigured = false

async function renderPdf(editor: Editor, pdfUrl: string) {
  // Remove any existing PDF background shapes + their assets
  const existing = editor.getCurrentPageShapes().filter(
    (s) => s.meta?.isPdfBackground
  )
  if (existing.length) {
    const assetIds = existing.flatMap((s) => {
      const id = (s.props as { assetId?: string }).assetId
      return id ? [id as any] : []
    })
    editor.deleteShapes(existing.map((s) => s.id))
    if (assetIds.length) editor.deleteAssets(assetIds)
  }

  const pdfjsLib = await import('pdfjs-dist')
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href
    workerConfigured = true
  }

  const pdf = await pdfjsLib.getDocument(pdfUrl).promise
  const GAP = 20
  let yOffset = 0

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise

    const dataUrl = canvas.toDataURL('image/png')
    const assetId = `asset:${crypto.randomUUID()}` as any

    editor.createAssets([
      {
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: `pdf-page-${i}`,
          src: dataUrl,
          w: viewport.width,
          h: viewport.height,
          mimeType: 'image/png',
          isAnimated: false,
        },
        meta: { isPdfBackground: true },
      } as any,
    ])

    editor.createShape({
      type: 'image',
      x: 0,
      y: yOffset,
      isLocked: true,
      meta: { isPdfBackground: true },
      props: { assetId, w: viewport.width, h: viewport.height, playing: false },
    } as any)

    yOffset += viewport.height + GAP
  }
}

// ── Canvas component ──────────────────────────────────────────────────────────

interface Props {
  pageId: string
  pdfId: string | null
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { pageId, pdfId },
  ref
) {
  const { darkMode, pageScreenshots } = useApp()
  const editorRef = useRef<Editor | null>(null)
  const unlistenRef = useRef<(() => void) | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track which pdfId is already rendered to avoid double-renders
  const pdfRenderedRef = useRef<string | null>(null)
  // Stable ref for darkMode so the mount closure always reads the latest value
  const darkModeRef = useRef(darkMode)
  useEffect(() => { darkModeRef.current = darkMode }, [darkMode])

  // ── save (strips PDF background shapes before persisting) ─────────────────
  const doSave = useCallback(async () => {
    const editor = editorRef.current
    if (!editor) return
    try {
      const raw = editor.getSnapshot() as any
      const filteredStore = Object.fromEntries(
        Object.entries(raw.document?.store ?? {}).filter(
          ([, rec]: [string, any]) => !rec?.meta?.isPdfBackground
        )
      )
      const cleanSnapshot = {
        ...raw,
        document: { ...raw.document, store: filteredStore },
      }
      await api.saveCanvas(pageId, cleanSnapshot)
    } catch (err) {
      console.error('Canvas save failed:', err)
    }
  }, [pageId])

  // ── screenshot (captures all shapes including PDF background) ─────────────
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
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? null)
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

  // ── tldraw mount ──────────────────────────────────────────────────────────
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    editor.user.updateUserPreferences({ colorScheme: darkModeRef.current ? 'dark' : 'light' })

    // Load snapshot, then render PDF if one is attached
    api
      .getCanvas(pageId)
      .then(({ snapshot }) => {
        if (snapshot) editor.loadSnapshot(snapshot as TLEditorSnapshot)
      })
      .then(() => {
        // pdfId is captured from the closure at mount time
        if (pdfId && pdfRenderedRef.current !== pdfId) {
          pdfRenderedRef.current = pdfId // optimistic — prevent useEffect double-render
          return renderPdf(editor, api.getPdfUrl(pdfId)).catch((err) => {
            pdfRenderedRef.current = null
            console.error('PDF render failed:', err)
          })
        }
      })
      .catch((err) => console.error('Canvas init failed:', err))

    // Debounced auto-save on user edits (not programmatic store changes)
    unlistenRef.current = editor.store.listen(
      () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(doSave, 1500)
      },
      { scope: 'document', source: 'user' }
    )
  // Empty deps — this component remounts via key={pageId} on page switch.
  // pdfId and doSave are stable within a single page's lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── re-render PDF when user uploads one on the currently-open page ────────
  // Skip the initial mount (handleMount handles that case via its async chain)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const editor = editorRef.current
    if (!pdfId || !editor || pdfRenderedRef.current === pdfId) return
    pdfRenderedRef.current = pdfId
    renderPdf(editor, api.getPdfUrl(pdfId)).catch((err) => {
      pdfRenderedRef.current = null
      console.error('PDF render failed:', err)
    })
  }, [pdfId])

  // ── sync dark mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    editorRef.current?.user.updateUserPreferences({
      colorScheme: darkMode ? 'dark' : 'light',
    })
  }, [darkMode])

  // ── final save + screenshot on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      unlistenRef.current?.()
      doSave()
      getScreenshot().then((png) => {
        if (png) pageScreenshots.current.set(pageId, png)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Tldraw onMount={handleMount} />
    </div>
  )
})
