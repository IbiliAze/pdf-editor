import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { extractPageLines, sampleLineColors } from './lib/textLayer'
import { buildEditedPdf } from './lib/exportPdf'
import { cssFontFor, measureText } from './lib/fonts'
import { clamp } from './lib/colors'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const TOOLS = [
  { id: 'edittext', label: 'Edit text', icon: 'T', hint: 'Click any text on the page and type the replacement. Press Enter to apply, Esc to cancel. Clear the box to erase the text.' },
  { id: 'text', label: 'Add text', icon: '+T', hint: 'Click anywhere on a page to place a new text box.' },
  { id: 'select', label: 'Select', icon: '↖', hint: 'Click an edit or annotation to move, restyle, or delete it (Del key).' },
  { id: 'whiteout', label: 'Whiteout', icon: '▭', hint: 'Drag over content to cover it with white.' },
  { id: 'highlight', label: 'Highlight', icon: 'H', hint: 'Drag over text to highlight it.' },
  { id: 'pen', label: 'Pen', icon: '✎', hint: 'Draw freehand on the page.' },
]

const FAMILIES = ['Helvetica', 'Times', 'Courier']
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

let idSeq = 1
const nid = () => idSeq++

function downloadBytes(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [pages, setPages] = useState([])
  const [elements, setElements] = useState([])
  const [tool, setToolState] = useState('edittext')
  const [zoom, setZoom] = useState(1.25)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditingState] = useState(null) // active native-text edit session
  const [editingElId, setEditingElId] = useState(null) // added text box being typed in
  const [liveDraw, setLiveDrawState] = useState(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [textStyle, setTextStyle] = useState({ family: 'Helvetica', bold: false, italic: false, size: 16, color: '#111827' })

  const bytesRef = useRef(null)
  const docRef = useRef(null)
  const fileInputRef = useRef(null)
  const editingRef = useRef(null)
  const elementsRef = useRef(elements)
  const liveDrawRef = useRef(null)
  const dragRef = useRef(null)
  const pastRef = useRef([])
  const futureRef = useRef([])

  const linesById = useMemo(() => {
    const map = {}
    for (const p of pages) for (const l of p.lines) map[l.id] = l
    return map
  }, [pages])

  const setEditing = useCallback((v) => {
    editingRef.current = v
    setEditingState(v)
  }, [])

  const setLiveDraw = useCallback((v) => {
    liveDrawRef.current = v
    setLiveDrawState(v)
  }, [])

  const setElementsNow = useCallback((next) => {
    elementsRef.current = next
    setElements(next)
  }, [])

  const commit = useCallback((updater) => {
    const prev = elementsRef.current
    const next = typeof updater === 'function' ? updater(prev) : updater
    if (next === prev) return
    pastRef.current = [...pastRef.current.slice(-59), prev]
    futureRef.current = []
    setElementsNow(next)
  }, [setElementsNow])

  const snapshotHistory = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-59), elementsRef.current]
    futureRef.current = []
  }, [])

  const undo = useCallback(() => {
    if (!pastRef.current.length) return
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, elementsRef.current]
    setElementsNow(prev)
    setSelectedId(null)
    setEditing(null)
    setEditingElId(null)
  }, [setElementsNow, setEditing])

  const redo = useCallback(() => {
    if (!futureRef.current.length) return
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    pastRef.current = [...pastRef.current, elementsRef.current]
    setElementsNow(next)
    setSelectedId(null)
    setEditing(null)
    setEditingElId(null)
  }, [setElementsNow, setEditing])

  // ---- open / load ----

  const openFile = useCallback(async (file) => {
    if (!file) return
    setLoading(true)
    setStatus(null)
    try {
      const buf = await file.arrayBuffer()
      bytesRef.current = buf
      if (docRef.current) {
        try { docRef.current.destroy() } catch { /* already gone */ }
      }
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise
      docRef.current = doc
      const list = []
      for (let i = 0; i < doc.numPages; i++) {
        const page = await doc.getPage(i + 1)
        const vp = page.getViewport({ scale: 1 })
        const lines = await extractPageLines(page, i)
        list.push({ pageIndex: i, width: vp.width, height: vp.height, lines })
      }
      setPages(list)
      setElementsNow([])
      pastRef.current = []
      futureRef.current = []
      setSelectedId(null)
      setEditing(null)
      setEditingElId(null)
      setLiveDraw(null)
      setFileName(file.name.replace(/\.pdf$/i, ''))
      setToolState('edittext')
    } catch (err) {
      setStatus({ type: 'error', msg: `Could not open PDF: ${err?.message || err}` })
    } finally {
      setLoading(false)
    }
  }, [setElementsNow, setEditing, setLiveDraw])

  // ---- native text editing ----

  const commitLineEdit = useCallback(() => {
    const s = editingRef.current
    if (!s) return
    setEditing(null)
    const line = linesById[s.lineId]
    if (!line) return
    commit((prev) => {
      const others = prev.filter((el) => !(el.type === 'edit' && el.lineId === s.lineId))
      if (s.text === line.text) return others.length === prev.length ? prev : others
      return [...others, { id: nid(), type: 'edit', lineId: s.lineId, pageIndex: s.pageIndex, text: s.text, bg: s.bg, color: s.color }]
    })
  }, [linesById, commit, setEditing])

  const startLineEdit = useCallback((line, canvas, page) => {
    if (editingRef.current) commitLineEdit()
    const existing = elementsRef.current.find((el) => el.type === 'edit' && el.lineId === line.id)
    let bg = '#ffffff'
    let color = '#111827'
    if (existing) {
      bg = existing.bg
      color = existing.color
    } else if (canvas && page) {
      const sampled = sampleLineColors(canvas, line, canvas.width / page.width)
      bg = sampled.bg
      color = sampled.color
    }
    setEditing({ lineId: line.id, pageIndex: line.pageIndex, text: existing ? existing.text : line.text, bg, color })
    setSelectedId(null)
  }, [commitLineEdit, setEditing])

  // ---- added elements ----

  const updateElementRaw = useCallback((id, patch) => {
    setElementsNow(elementsRef.current.map((el) => (el.id === id ? { ...el, ...patch } : el)))
  }, [setElementsNow])

  const addTextAt = useCallback((page, pt) => {
    const el = {
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
    commit((prev) => [...prev, el])
    setSelectedId(el.id)
    setEditingElId(el.id)
  }, [commit, textStyle])

  const finishElementEdit = useCallback((id) => {
    setEditingElId(null)
    const el = elementsRef.current.find((e) => e.id === id)
    if (el && el.type === 'text' && !el.text.trim()) {
      setElementsNow(elementsRef.current.filter((e) => e.id !== id))
      setSelectedId(null)
    }
  }, [setElementsNow])

  const deleteSelected = useCallback(() => {
    if (selectedId == null) return
    commit((prev) => prev.filter((el) => el.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, commit])

  // ---- page pointer handlers ----

  const localPoint = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }
  }, [zoom])

  const onPageMouseDown = useCallback((e, page) => {
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
      setLiveDraw({
        id: nid(),
        type: tool,
        pageIndex: page.pageIndex,
        x: pt.x,
        y: pt.y,
        w: 0,
        h: 0,
        ...(tool === 'highlight' ? { color: '#fde047' } : {}),
      })
      return
    }
    if (tool === 'pen') {
      const pt = localPoint(e)
      setLiveDraw({ id: nid(), type: 'path', pageIndex: page.pageIndex, points: [pt], color: textStyle.color, width: 2 })
      return
    }
    if (tool === 'select') setSelectedId(null)
  }, [tool, addTextAt, localPoint, commitLineEdit, setLiveDraw, textStyle.color])

  const onPageMouseMove = useCallback((e, page) => {
    const d = liveDrawRef.current
    if (!d || d.pageIndex !== page.pageIndex) return
    const pt = localPoint(e)
    if (d.type === 'path') setLiveDraw({ ...d, points: [...d.points, pt] })
    else setLiveDraw({ ...d, w: pt.x - d.x, h: pt.y - d.y })
  }, [localPoint, setLiveDraw])

  const commitLiveDraw = useCallback(() => {
    const d = liveDrawRef.current
    if (!d) return
    setLiveDraw(null)
    if (d.type === 'path') {
      if (d.points.length > 1) commit((prev) => [...prev, d])
      return
    }
    let { x, y, w, h } = d
    if (w < 0) { x += w; w = -w }
    if (h < 0) { y += h; h = -h }
    if (w > 2 && h > 2) commit((prev) => [...prev, { ...d, x, y, w, h }])
  }, [commit, setLiveDraw])

  const onElementMouseDown = useCallback((e, el) => {
    if (tool === 'edittext') {
      if (el.type === 'edit') {
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
    dragRef.current = { mode: 'move', id: el.id, startX: e.clientX, startY: e.clientY, base: elementsRef.current, moved: false }
  }, [tool, linesById, startLineEdit])

  const onResizeMouseDown = useCallback((e, el) => {
    e.stopPropagation()
    setSelectedId(el.id)
    dragRef.current = { mode: 'resize', id: el.id, startX: e.clientX, startY: e.clientY, base: elementsRef.current, baseW: el.w, moved: false }
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return
      if (!d.moved) {
        if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 3) return
        d.moved = true
        pastRef.current = [...pastRef.current.slice(-59), d.base]
        futureRef.current = []
      }
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      const next = d.base.map((el) => {
        if (el.id !== d.id) return el
        if (d.mode === 'resize') return { ...el, w: Math.max(40, d.baseW + dx) }
        if (el.type === 'path') return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
        return { ...el, x: el.x + dx, y: el.y + dy }
      })
      elementsRef.current = next
      setElements(next)
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [zoom])

  // ---- keyboard ----

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const editable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
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

  const selectTool = (id) => {
    commitLineEdit()
    setEditingElId(null)
    setToolState(id)
    setSelectedId(null)
  }

  const selectedEl = elements.find((el) => el.id === selectedId)
  const shownStyle = selectedEl?.type === 'text'
    ? { family: selectedEl.font.family, bold: selectedEl.font.bold, italic: selectedEl.font.italic, size: selectedEl.size, color: selectedEl.color }
    : textStyle

  const applyStyle = (patch) => {
    setTextStyle((s) => ({ ...s, ...patch }))
    if (selectedId == null) return
    const sel = elementsRef.current.find((el) => el.id === selectedId)
    if (!sel) return
    commit((prev) => prev.map((el) => {
      if (el.id !== selectedId) return el
      if (el.type === 'text') {
        const font = { ...el.font }
        if (patch.family != null) font.family = patch.family
        if (patch.bold != null) font.bold = patch.bold
        if (patch.italic != null) font.italic = patch.italic
        return {
          ...el,
          font,
          ...(patch.size != null ? { size: patch.size } : {}),
          ...(patch.color != null ? { color: patch.color } : {}),
        }
      }
      if ((el.type === 'path' || el.type === 'edit') && patch.color != null) {
        return { ...el, color: patch.color }
      }
      return el
    }))
  }

  const zoomStep = (dir) => {
    const i = ZOOM_LEVELS.findIndex((z) => Math.abs(z - zoom) < 0.01)
    const next = ZOOM_LEVELS[clamp((i === -1 ? 2 : i) + dir, 0, ZOOM_LEVELS.length - 1)]
    setZoom(next)
  }

  const handleExport = async () => {
    commitLineEdit()
    if (editingElId != null) finishElementEdit(editingElId)
    if (!bytesRef.current || !docRef.current) return
    setStatus({ type: 'info', msg: 'Preparing PDF…' })
    try {
      const out = await buildEditedPdf({
        bytes: bytesRef.current,
        pdfjsDoc: docRef.current,
        elements: elementsRef.current,
        linesById,
      })
      downloadBytes(out, `${fileName || 'document'}-edited.pdf`)
      setStatus({ type: 'success', msg: 'PDF exported.' })
    } catch (err) {
      setStatus({ type: 'error', msg: `Export failed: ${err?.message || err}` })
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file && /\.pdf$/i.test(file.name)) openFile(file)
    else if (file) setStatus({ type: 'error', msg: 'Only PDF files are supported.' })
  }

  const handlers = {
    pageMouseDown: onPageMouseDown,
    pageMouseMove: onPageMouseMove,
    pageMouseUp: commitLiveDraw,
    pageMouseLeave: commitLiveDraw,
    lineClick: startLineEdit,
    lineEditChange: (text) => setEditing({ ...editingRef.current, text }),
    commitLineEdit,
    cancelLineEdit: () => setEditing(null),
    elementMouseDown: onElementMouseDown,
    resizeMouseDown: onResizeMouseDown,
    elementDoubleClick: (el) => {
      if (el.type !== 'text') return
      snapshotHistory()
      setSelectedId(el.id)
      setEditingElId(el.id)
    },
    elementTextChange: (id, text) => updateElementRaw(id, { text }),
    finishElementEdit,
  }

  const activeTool = TOOLS.find((t) => t.id === tool)
  const editCount = elements.length

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">PDF<span>Editor</span></div>

        <button className="btn" onClick={() => fileInputRef.current?.click()}>Open</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = '' }}
        />

        <div className="divider" />

        <div className="group">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`btn tool${tool === t.id ? ' active' : ''}`}
              disabled={!pages.length}
              title={t.label}
              onClick={() => selectTool(t.id)}
            >
              <span className="tool-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="divider" />

        <div className="group">
          <select
            value={shownStyle.family}
            disabled={!pages.length}
            onChange={(e) => applyStyle({ family: e.target.value })}
          >
            {FAMILIES.map((f) => <option key={f}>{f}</option>)}
          </select>
          <input
            type="number"
            min="4"
            max="200"
            value={shownStyle.size}
            disabled={!pages.length}
            onChange={(e) => applyStyle({ size: clamp(Number(e.target.value) || 12, 4, 200) })}
          />
          <button
            className={`btn toggle${shownStyle.bold ? ' active' : ''}`}
            disabled={!pages.length}
            onClick={() => applyStyle({ bold: !shownStyle.bold })}
          ><b>B</b></button>
          <button
            className={`btn toggle${shownStyle.italic ? ' active' : ''}`}
            disabled={!pages.length}
            onClick={() => applyStyle({ italic: !shownStyle.italic })}
          ><i>I</i></button>
          <input
            type="color"
            value={shownStyle.color}
            disabled={!pages.length}
            onChange={(e) => applyStyle({ color: e.target.value })}
          />
        </div>

        <div className="divider" />

        <div className="group">
          <button className="btn" onClick={undo} disabled={!pastRef.current.length}>Undo</button>
          <button className="btn" onClick={redo} disabled={!futureRef.current.length}>Redo</button>
        </div>

        <div className="group">
          <button className="btn" onClick={() => zoomStep(-1)} disabled={!pages.length}>−</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn" onClick={() => zoomStep(1)} disabled={!pages.length}>+</button>
        </div>

        <div className="spacer" />

        {pages.length > 0 && (
          <span className="doc-label">{fileName || 'Untitled'} · {pages.length} page{pages.length === 1 ? '' : 's'} · {editCount} edit{editCount === 1 ? '' : 's'}</span>
        )}
        <button className="btn primary" onClick={handleExport} disabled={!pages.length}>Export PDF</button>
      </header>

      {pages.length > 0 && <div className="hintbar">{activeTool?.hint}</div>}
      {status && <div className={`notice ${status.type}`}>{status.msg}</div>}
      {loading && <div className="notice info">Loading PDF…</div>}

      <main className="workspace" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {!pages.length && !loading && (
          <div className="empty" onClick={() => fileInputRef.current?.click()}>
            <div className="empty-mark">PDF</div>
            <h2>Open a PDF to start editing</h2>
            <p>Click here or drop a file. Click any text on the page to rewrite it — everything stays in your browser.</p>
          </div>
        )}
        {pages.map((page) => (
          <PageView
            key={page.pageIndex}
            page={page}
            doc={docRef.current}
            zoom={zoom}
            tool={tool}
            elements={elements}
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

function normRect(r) {
  let { x, y, w, h } = r
  if (w < 0) { x += w; w = -w }
  if (h < 0) { y += h; h = -h }
  return { x, y, w, h }
}

function PageView({ page, doc, zoom, tool, elements, linesById, selectedId, editing, editingElId, liveDraw, on }) {
  const canvasRef = useRef(null)
  const genRef = useRef(0)

  useEffect(() => {
    if (!doc) return
    const gen = ++genRef.current
    let cancelled = false
    ;(async () => {
      try {
        const p = await doc.getPage(page.pageIndex + 1)
        const dpr = window.devicePixelRatio || 1
        const vp = p.getViewport({ scale: zoom * dpr })
        const off = document.createElement('canvas')
        off.width = Math.floor(vp.width)
        off.height = Math.floor(vp.height)
        await p.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise
        if (cancelled || gen !== genRef.current) return
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = off.width
        canvas.height = off.height
        canvas.getContext('2d').drawImage(off, 0, 0)
      } catch {
        // rendering superseded or page torn down
      }
    })()
    return () => { cancelled = true }
  }, [doc, page.pageIndex, zoom])

  const pageElements = elements.filter((el) => el.pageIndex === page.pageIndex)
  const editedLineIds = new Set(pageElements.filter((el) => el.type === 'edit').map((el) => el.lineId))
  const editingLine = editing && editing.pageIndex === page.pageIndex ? linesById[editing.lineId] : null
  const w = page.width * zoom
  const h = page.height * zoom

  const renderElement = (el) => {
    const isSel = el.id === selectedId
    if (el.type === 'whiteout') {
      return (
        <div
          key={el.id}
          className={`el-whiteout${isSel ? ' selected' : ''}`}
          style={{ left: el.x * zoom, top: el.y * zoom, width: el.w * zoom, height: el.h * zoom }}
          onMouseDown={(e) => on.elementMouseDown(e, el)}
        />
      )
    }
    if (el.type === 'highlight') {
      return (
        <div
          key={el.id}
          className={`el-highlight${isSel ? ' selected' : ''}`}
          style={{ left: el.x * zoom, top: el.y * zoom, width: el.w * zoom, height: el.h * zoom, background: el.color }}
          onMouseDown={(e) => on.elementMouseDown(e, el)}
        />
      )
    }
    if (el.type === 'path') {
      return (
        <svg key={el.id} className="draw-layer" width={w} height={h}>
          <polyline
            points={el.points.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
            fill="none"
            stroke={el.color}
            strokeWidth={Math.max(1, el.width * zoom)}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isSel ? 'selected-vector' : ''}
            style={{ pointerEvents: tool === 'select' ? 'stroke' : 'none' }}
            onMouseDown={(e) => on.elementMouseDown(e, el)}
          />
        </svg>
      )
    }
    if (el.type === 'edit') {
      if (editing && editing.lineId === el.lineId) return null
      const line = linesById[el.lineId]
      if (!line) return null
      const textW = measureText(el.text, line.fontHeight * zoom, line.font)
      const coverW = Math.max((line.width + 2) * zoom, textW + 2)
      return (
        <div
          key={el.id}
          className={`edit-cover${isSel ? ' selected' : ''}`}
          onMouseDown={(e) => on.elementMouseDown(e, el)}
          style={{
            left: (line.x - 1) * zoom,
            top: (line.top - 1) * zoom,
            width: coverW,
            height: (line.height + 2) * zoom,
            background: el.bg,
          }}
        >
          <span
            style={{
              fontSize: line.fontHeight * zoom,
              ...cssFontFor(line.font),
              color: el.color,
              lineHeight: `${(line.height + 2) * zoom}px`,
            }}
          >
            {el.text}
          </span>
        </div>
      )
    }
    if (el.type === 'text') {
      const fontCss = cssFontFor(el.font)
      if (el.id === editingElId) {
        return (
          <textarea
            key={el.id}
            autoFocus
            className="text-el editing"
            value={el.text}
            rows={Math.max(1, el.text.split('\n').length)}
            spellCheck={false}
            onChange={(e) => on.elementTextChange(el.id, e.target.value)}
            onBlur={() => on.finishElementEdit(el.id)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') on.finishElementEdit(el.id) }}
            style={{
              left: el.x * zoom,
              top: el.y * zoom,
              width: el.w * zoom,
              fontSize: el.size * zoom,
              lineHeight: 1.25,
              color: el.color,
              ...fontCss,
            }}
          />
        )
      }
      return (
        <div
          key={el.id}
          className={`text-el${isSel ? ' selected' : ''}`}
          onMouseDown={(e) => on.elementMouseDown(e, el)}
          onDoubleClick={(e) => { e.stopPropagation(); on.elementDoubleClick(el) }}
          style={{
            left: el.x * zoom,
            top: el.y * zoom,
            width: el.w * zoom,
            fontSize: el.size * zoom,
            lineHeight: 1.25,
            color: el.color,
            ...fontCss,
          }}
        >
          {el.text || ' '}
          {isSel && tool === 'select' && (
            <div className="resize-handle" onMouseDown={(e) => on.resizeMouseDown(e, el)} />
          )}
        </div>
      )
    }
    return null
  }

  const live = liveDraw && liveDraw.pageIndex === page.pageIndex ? liveDraw : null
  const liveRect = live && live.type !== 'path' ? normRect(live) : null

  return (
    <div className="page-shell">
      <div className="page-label">Page {page.pageIndex + 1}</div>
      <div className="page-wrap" style={{ width: w, height: h }}>
        <canvas ref={canvasRef} style={{ width: w, height: h }} />
        <div
          className={`overlay tool-${tool}`}
          onMouseDown={(e) => on.pageMouseDown(e, page)}
          onMouseMove={(e) => on.pageMouseMove(e, page)}
          onMouseUp={() => on.pageMouseUp()}
          onMouseLeave={() => on.pageMouseLeave()}
        >
          {pageElements.map(renderElement)}

          {live && live.type === 'path' && (
            <svg className="draw-layer" width={w} height={h}>
              <polyline
                points={live.points.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
                fill="none"
                stroke={live.color}
                strokeWidth={Math.max(1, live.width * zoom)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {liveRect && (
            <div
              className={`el-${live.type} live`}
              style={{
                left: liveRect.x * zoom,
                top: liveRect.y * zoom,
                width: liveRect.w * zoom,
                height: liveRect.h * zoom,
                ...(live.type === 'highlight' ? { background: live.color } : {}),
              }}
            />
          )}

          {tool === 'edittext' && page.lines.map((line) => (
            editedLineIds.has(line.id) || editing?.lineId === line.id ? null : (
              <div
                key={line.id}
                className="line-hit"
                title="Click to edit this text"
                style={{
                  left: (line.x - 2) * zoom,
                  top: (line.top - 2) * zoom,
                  width: (line.width + 4) * zoom,
                  height: (line.height + 4) * zoom,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  on.lineClick(line, canvasRef.current, page)
                }}
              />
            )
          ))}

          {editingLine && (
            <LineEditor editing={editing} line={editingLine} zoom={zoom} on={on} />
          )}
        </div>
      </div>
    </div>
  )
}

function LineEditor({ editing, line, zoom, on }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const css = cssFontFor(line.font)
  const textW = measureText(editing.text, line.fontHeight * zoom, line.font)
  const width = Math.max((line.width + 6) * zoom + 8, textW + 20)

  return (
    <input
      ref={ref}
      className="line-editor"
      value={editing.text}
      spellCheck={false}
      onChange={(e) => on.lineEditChange(e.target.value)}
      onBlur={() => on.commitLineEdit()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          on.commitLineEdit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          on.cancelLineEdit()
        }
      }}
      style={{
        left: (line.x - 3) * zoom,
        top: (line.top - 3) * zoom,
        width,
        height: (line.height + 6) * zoom,
        padding: `0 ${3 * zoom}px`,
        fontSize: line.fontHeight * zoom,
        ...css,
        color: editing.color,
        background: editing.bg,
      }}
    />
  )
}
