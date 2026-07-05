import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import Toolbar from './components/Toolbar'
import PageView from './components/PageView'
import { useElements } from './hooks/useElements'
import { usePdfDocument } from './hooks/usePdfDocument'
import { buildEditedPdf } from './lib/exportPdf'
import { sampleLineColors } from './lib/textLayer'
import { downloadBytes, nid, normRect } from './lib/utils'
import { clamp } from './lib/colors'
import { HIGHLIGHT_COLOR, TOOLS, ZOOM_LEVELS } from './constants'
import type {
  EditingSession,
  EditorElement,
  Line,
  LiveDraw,
  PageHandlers,
  PageInfo,
  Status,
  TextElement,
  TextStyle,
  ToolId,
} from './types'

interface DragState {
  mode: 'move' | 'resize'
  id: number
  startX: number
  startY: number
  base: EditorElement[]
  baseW?: number
  moved: boolean
}

export default function App() {
  const pdf = usePdfDocument()
  const els = useElements()

  const [tool, setToolState] = useState<ToolId>('edittext')
  const [zoom, setZoom] = useState(1.25)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditingState] = useState<EditingSession | null>(null)
  const [editingElId, setEditingElId] = useState<number | null>(null)
  const [liveDraw, setLiveDrawState] = useState<LiveDraw | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [textStyle, setTextStyle] = useState<TextStyle>({
    family: 'Helvetica',
    bold: false,
    italic: false,
    size: 16,
    color: '#111827',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editingRef = useRef<EditingSession | null>(null)
  const liveDrawRef = useRef<LiveDraw | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const linesById = useMemo(() => {
    const map: Record<string, Line> = {}
    for (const p of pdf.pages) for (const l of p.lines) map[l.id] = l
    return map
  }, [pdf.pages])

  // Sessions live in state for rendering and in refs so event handlers
  // (blur commits, drags) always see the current value synchronously.
  const setEditing = useCallback((v: EditingSession | null) => {
    editingRef.current = v
    setEditingState(v)
  }, [])

  const setLiveDraw = useCallback((v: LiveDraw | null) => {
    liveDrawRef.current = v
    setLiveDrawState(v)
  }, [])

  // ---- open / load ----

  const openFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return
      setStatus(null)
      try {
        await pdf.open(file)
        els.reset()
        setSelectedId(null)
        setEditing(null)
        setEditingElId(null)
        setLiveDraw(null)
        setToolState('edittext')
      } catch (err) {
        setStatus({ type: 'error', msg: `Could not open PDF: ${(err as Error)?.message ?? err}` })
      }
    },
    [pdf, els, setEditing, setLiveDraw],
  )

  // ---- native text editing ----

  const commitLineEdit = useCallback(() => {
    const s = editingRef.current
    if (!s) return
    setEditing(null)
    const line = linesById[s.lineId]
    if (!line) return
    els.commit((prev) => {
      const others = prev.filter((el) => !(el.type === 'edit' && el.lineId === s.lineId))
      if (s.text === line.text) return others.length === prev.length ? prev : others
      return [
        ...others,
        { id: nid(), type: 'edit', lineId: s.lineId, pageIndex: s.pageIndex, text: s.text, bg: s.bg, color: s.color },
      ]
    })
  }, [linesById, els, setEditing])

  const startLineEdit = useCallback(
    (line: Line, canvas: HTMLCanvasElement | null, page: PageInfo | null) => {
      if (editingRef.current) commitLineEdit()
      const existing = els.elementsRef.current.find(
        (el) => el.type === 'edit' && el.lineId === line.id,
      )
      let bg = '#ffffff'
      let color = '#111827'
      if (existing && existing.type === 'edit') {
        bg = existing.bg
        color = existing.color
      } else if (canvas && page) {
        const sampled = sampleLineColors(canvas, line, canvas.width / page.width)
        bg = sampled.bg
        color = sampled.color
      }
      setEditing({
        lineId: line.id,
        pageIndex: line.pageIndex,
        text: existing && existing.type === 'edit' ? existing.text : line.text,
        bg,
        color,
      })
      setSelectedId(null)
    },
    [commitLineEdit, els, setEditing],
  )

  // ---- added elements ----

  const addTextAt = useCallback(
    (page: PageInfo, pt: { x: number; y: number }) => {
      const el: TextElement = {
        id: nid(),
        type: 'text',
        pageIndex: page.pageIndex,
        x: pt.x,
        y: pt.y,
        w: 240,
        text: '',
        size: textStyle.size,
        color: textStyle.color,
        font: { family: textStyle.family, bold: textStyle.bold, italic: textStyle.italic },
      }
      els.commit((prev) => [...prev, el])
      setSelectedId(el.id)
      setEditingElId(el.id)
    },
    [els, textStyle],
  )

  const finishElementEdit = useCallback(
    (id: number) => {
      setEditingElId(null)
      const el = els.elementsRef.current.find((e) => e.id === id)
      if (el && el.type === 'text' && !el.text.trim()) {
        els.setElementsNow(els.elementsRef.current.filter((e) => e.id !== id))
        setSelectedId(null)
      }
    },
    [els],
  )

  const deleteSelected = useCallback(() => {
    if (selectedId == null) return
    els.commit((prev) => prev.filter((el) => el.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, els])

  // ---- page pointer handlers ----

  const localPoint = useCallback(
    (e: ReactMouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }
    },
    [zoom],
  )

  const onPageMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>, page: PageInfo) => {
      if (editingRef.current) {
        commitLineEdit()
        return
      }
      if (tool === 'text') {
        addTextAt(page, localPoint(e))
        e.preventDefault()
        return
      }
      if (tool === 'whiteout' || tool === 'highlight') {
        const pt = localPoint(e)
        setLiveDraw(
          tool === 'highlight'
            ? { id: nid(), type: 'highlight', pageIndex: page.pageIndex, x: pt.x, y: pt.y, w: 0, h: 0, color: HIGHLIGHT_COLOR }
            : { id: nid(), type: 'whiteout', pageIndex: page.pageIndex, x: pt.x, y: pt.y, w: 0, h: 0 },
        )
        return
      }
      if (tool === 'pen') {
        const pt = localPoint(e)
        setLiveDraw({
          id: nid(),
          type: 'path',
          pageIndex: page.pageIndex,
          points: [pt],
          color: textStyle.color,
          width: 2,
        })
        return
      }
      if (tool === 'select') setSelectedId(null)
    },
    [tool, addTextAt, localPoint, commitLineEdit, setLiveDraw, textStyle.color],
  )

  const onPageMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>, page: PageInfo) => {
      const d = liveDrawRef.current
      if (!d || d.pageIndex !== page.pageIndex) return
      const pt = localPoint(e)
      if (d.type === 'path') setLiveDraw({ ...d, points: [...d.points, pt] })
      else setLiveDraw({ ...d, w: pt.x - d.x, h: pt.y - d.y })
    },
    [localPoint, setLiveDraw],
  )

  const commitLiveDraw = useCallback(() => {
    const d = liveDrawRef.current
    if (!d) return
    setLiveDraw(null)
    if (d.type === 'path') {
      if (d.points.length > 1) els.commit((prev) => [...prev, d])
      return
    }
    const r = normRect(d)
    if (r.w > 2 && r.h > 2) els.commit((prev) => [...prev, r])
  }, [els, setLiveDraw])

  const onElementMouseDown = useCallback(
    (e: ReactMouseEvent, el: EditorElement) => {
      if (tool === 'edittext') {
        if (el.type === 'edit') {
          // preventDefault stops the browser's focus-change default action,
          // which would otherwise blur (and instantly close) the editor.
          e.preventDefault()
          e.stopPropagation()
          const line = linesById[el.lineId]
          if (line) startLineEdit(line, null, null)
        }
        return
      }
      if (tool !== 'select') return
      e.stopPropagation()
      setSelectedId(el.id)
      if (el.type === 'edit') return // edits stay pinned to their original line
      dragRef.current = {
        mode: 'move',
        id: el.id,
        startX: e.clientX,
        startY: e.clientY,
        base: els.elementsRef.current,
        moved: false,
      }
    },
    [tool, linesById, startLineEdit, els],
  )

  const onResizeMouseDown = useCallback(
    (e: ReactMouseEvent, el: TextElement) => {
      e.stopPropagation()
      setSelectedId(el.id)
      dragRef.current = {
        mode: 'resize',
        id: el.id,
        startX: e.clientX,
        startY: e.clientY,
        base: els.elementsRef.current,
        baseW: el.w,
        moved: false,
      }
    },
    [els],
  )

  // Window-level drag: move/resize the pressed element; history is pushed
  // once, on the first actual movement.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      if (!d.moved) {
        if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 3) return
        d.moved = true
        els.pushHistory(d.base)
      }
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      const next = d.base.map((el): EditorElement => {
        if (el.id !== d.id) return el
        if (d.mode === 'resize' && el.type === 'text') {
          return { ...el, w: Math.max(40, (d.baseW ?? el.w) + dx) }
        }
        if (el.type === 'path') {
          return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
        }
        if (el.type === 'edit') return el
        return { ...el, x: el.x + dx, y: el.y + dy }
      })
      els.setElementsNow(next)
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [zoom, els])

  // ---- keyboard ----

  const undo = useCallback(() => {
    if (!els.undo()) return
    setSelectedId(null)
    setEditing(null)
    setEditingElId(null)
  }, [els, setEditing])

  const redo = useCallback(() => {
    if (!els.redo()) return
    setSelectedId(null)
    setEditing(null)
    setEditingElId(null)
  }, [els, setEditing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const editable =
        !!t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !editable) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !editable) {
        e.preventDefault()
        redo()
        return
      }
      if (editable) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId != null) {
        e.preventDefault()
        deleteSelected()
      }
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, deleteSelected, selectedId])

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 5000)
    return () => clearTimeout(t)
  }, [status])

  // ---- toolbar actions ----

  const selectTool = useCallback(
    (id: ToolId) => {
      commitLineEdit()
      setEditingElId(null)
      setToolState(id)
      setSelectedId(null)
    },
    [commitLineEdit],
  )

  const selectedEl = els.elements.find((el) => el.id === selectedId)
  const shownStyle: TextStyle =
    selectedEl?.type === 'text'
      ? {
          family: selectedEl.font.family,
          bold: selectedEl.font.bold,
          italic: selectedEl.font.italic,
          size: selectedEl.size,
          color: selectedEl.color,
        }
      : textStyle

  const applyStyle = useCallback(
    (patch: Partial<TextStyle>) => {
      setTextStyle((s) => ({ ...s, ...patch }))
      if (selectedId == null) return
      const sel = els.elementsRef.current.find((el) => el.id === selectedId)
      if (!sel) return
      els.commit((prev) =>
        prev.map((el): EditorElement => {
          if (el.id !== selectedId) return el
          if (el.type === 'text') {
            return {
              ...el,
              font: {
                family: patch.family ?? el.font.family,
                bold: patch.bold ?? el.font.bold,
                italic: patch.italic ?? el.font.italic,
              },
              size: patch.size ?? el.size,
              color: patch.color ?? el.color,
            }
          }
          if ((el.type === 'path' || el.type === 'edit') && patch.color != null) {
            return { ...el, color: patch.color }
          }
          return el
        }),
      )
    },
    [selectedId, els],
  )

  const zoomStep = useCallback(
    (dir: 1 | -1) => {
      const i = ZOOM_LEVELS.findIndex((z) => Math.abs(z - zoom) < 0.01)
      setZoom(ZOOM_LEVELS[clamp((i === -1 ? 2 : i) + dir, 0, ZOOM_LEVELS.length - 1)])
    },
    [zoom],
  )

  const handleExport = useCallback(async () => {
    commitLineEdit()
    if (editingElId != null) finishElementEdit(editingElId)
    if (!pdf.bytesRef.current || !pdf.docRef.current) return
    setStatus({ type: 'info', msg: 'Preparing PDF…' })
    try {
      const out = await buildEditedPdf({
        bytes: pdf.bytesRef.current,
        pdfjsDoc: pdf.docRef.current,
        elements: els.elementsRef.current,
        linesById,
      })
      downloadBytes(out, `${pdf.fileName || 'document'}-edited.pdf`)
      setStatus({ type: 'success', msg: 'PDF exported.' })
    } catch (err) {
      setStatus({ type: 'error', msg: `Export failed: ${(err as Error)?.message ?? err}` })
    }
  }, [commitLineEdit, editingElId, finishElementEdit, pdf, els, linesById])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer?.files?.[0]
      if (file && /\.pdf$/i.test(file.name)) openFile(file)
      else if (file) setStatus({ type: 'error', msg: 'Only PDF files are supported.' })
    },
    [openFile],
  )

  const handlers: PageHandlers = {
    pageMouseDown: onPageMouseDown,
    pageMouseMove: onPageMouseMove,
    pageMouseUp: commitLiveDraw,
    pageMouseLeave: commitLiveDraw,
    lineClick: startLineEdit,
    lineEditChange: (text) => {
      if (editingRef.current) setEditing({ ...editingRef.current, text })
    },
    commitLineEdit,
    cancelLineEdit: () => setEditing(null),
    elementMouseDown: onElementMouseDown,
    resizeMouseDown: onResizeMouseDown,
    elementDoubleClick: (el) => {
      if (el.type !== 'text') return
      els.snapshotHistory()
      setSelectedId(el.id)
      setEditingElId(el.id)
    },
    elementTextChange: (id, text) => {
      els.setElementsNow(
        els.elementsRef.current.map((el) => (el.id === id ? { ...el, text } : el)),
      )
    },
    finishElementEdit,
  }

  const activeTool = TOOLS.find((t) => t.id === tool)
  const hasDoc = pdf.pages.length > 0
  const editCount = els.elements.length
  const docLabel = hasDoc
    ? `${pdf.fileName || 'Untitled'} · ${pdf.pages.length} page${pdf.pages.length === 1 ? '' : 's'} · ${editCount} edit${editCount === 1 ? '' : 's'}`
    : null

  return (
    <div className="app">
      <Toolbar
        hasDoc={hasDoc}
        tool={tool}
        onSelectTool={selectTool}
        style={shownStyle}
        onStyle={applyStyle}
        canUndo={els.canUndo}
        canRedo={els.canRedo}
        onUndo={undo}
        onRedo={redo}
        zoom={zoom}
        onZoomStep={zoomStep}
        docLabel={docLabel}
        onOpen={() => fileInputRef.current?.click()}
        onExport={handleExport}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          openFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {hasDoc && <div className="hintbar">{activeTool?.hint}</div>}
      {status && <div className={`notice ${status.type}`}>{status.msg}</div>}
      {pdf.loading && <div className="notice info">Loading PDF…</div>}

      <main className="workspace" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {!hasDoc && !pdf.loading && (
          <div className="empty" onClick={() => fileInputRef.current?.click()}>
            <img className="empty-logo" src="/logo-inverted-removebg-preview.png" alt="Eight Mile logo" />
            <h2>Open a PDF to start editing</h2>
            <p>
              Click here or drop a file. Click any text on the page to rewrite it — everything
              stays in your browser.
            </p>
          </div>
        )}
        {pdf.pages.map((page) => (
          <PageView
            key={page.pageIndex}
            page={page}
            doc={pdf.docRef.current}
            zoom={zoom}
            tool={tool}
            elements={els.elements}
            linesById={linesById}
            selectedId={selectedId}
            editing={editing}
            editingElId={editingElId}
            liveDraw={liveDraw}
            on={handlers}
          />
        ))}
      </main>
    </div>
  )
}
