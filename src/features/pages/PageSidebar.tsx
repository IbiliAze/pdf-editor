import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import Thumbnail from './Thumbnail'
import SplitDialog from './SplitDialog'
import {
  deletePages,
  duplicatePages,
  extractPages,
  insertBlank,
  mergeFile,
  movePages,
  rotatePages,
} from './actions'

/** Thumbnail rail: selection, drag reorder, and the page operations. */
export default function PageSidebar() {
  const pages = useStore((s) => s.pages)
  const activePageId = useStore((s) => s.activePageId)
  const setActivePageId = useStore((s) => s.setActivePageId)
  const open = useStore((s) => s.sidebarOpen)
  const setOpen = useStore((s) => s.setSidebarOpen)

  const [selected, setSelected] = useState<string[]>([])
  const [dropAt, setDropAt] = useState<number | null>(null)
  // Mirrored in a ref because the pointerup handler has to read it without
  // reaching into a state updater, which must stay free of side effects.
  const dropAtRef = useRef<number | null>(null)
  const [splitting, setSplitting] = useState(false)
  const mergeInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ ids: string[]; started: boolean; y: number } | null>(null)

  // Pages can disappear under a stale selection.
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => pages.some((p) => p.id === id)))
  }, [pages])

  const targets = useCallback(
    (id: string): string[] => (selected.includes(id) && selected.length > 1 ? selected : [id]),
    [selected],
  )

  const indexFromPointer = useCallback((clientY: number): number => {
    const nodes = listRef.current?.querySelectorAll<HTMLElement>('[data-thumb-index]')
    if (!nodes?.length) return 0
    for (const node of nodes) {
      const r = node.getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return Number(node.dataset.thumbIndex)
    }
    return nodes.length
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (!d.started) {
        if (Math.abs(e.clientY - d.y) < 6) return
        d.started = true
      }
      const at = indexFromPointer(e.clientY)
      dropAtRef.current = at
      setDropAt(at)
    }
    const onUp = () => {
      const d = dragRef.current
      const at = dropAtRef.current
      dragRef.current = null
      dropAtRef.current = null
      setDropAt(null)
      if (d?.started && at != null) movePages(d.ids, at)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [indexFromPointer])

  if (!open) return null

  const onThumbPointerDown = (e: React.PointerEvent, id: string, index: number) => {
    const additive = e.metaKey || e.ctrlKey
    const range = e.shiftKey
    let next: string[]
    if (range && selected.length) {
      const last = pages.findIndex((p) => p.id === selected[selected.length - 1])
      const [from, to] = last < index ? [last, index] : [index, last]
      next = pages.slice(from, to + 1).map((p) => p.id)
    } else if (additive) {
      next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    } else {
      next = selected.includes(id) ? selected : [id]
    }
    setSelected(next)
    setActivePageId(id)
    dragRef.current = { ids: next.length ? next : [id], started: false, y: e.clientY }
  }

  const only = selected.length === 1 ? selected[0] : null
  const anchor = only ?? selected[selected.length - 1] ?? activePageId

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <strong>Pages</strong>
        <span className="hint">{pages.length}</span>
        <button className="modal-close" onClick={() => setOpen(false)} aria-label="Close pages">
          ×
        </button>
      </header>

      <div className="sidebar-list" ref={listRef}>
        {pages.map((page, i) => (
          <div
            key={page.id}
            data-thumb-index={i}
            className={[
              'thumb',
              selected.includes(page.id) ? 'selected' : '',
              activePageId === page.id ? 'active' : '',
              dropAt === i ? 'drop-before' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onPointerDown={(e) => {
              e.preventDefault()
              onThumbPointerDown(e, page.id, i)
            }}
            onDoubleClick={() => setActivePageId(page.id)}
          >
            <Thumbnail page={page} />
            <div className="thumb-bar">
              <span className="thumb-num">{i + 1}</span>
              <button title="Rotate left" onClick={() => rotatePages(targets(page.id), -90)}>
                ↺
              </button>
              <button title="Rotate right" onClick={() => rotatePages(targets(page.id), 90)}>
                ↻
              </button>
              <button title="Duplicate" onClick={() => duplicatePages(targets(page.id))}>
                ⧉
              </button>
              <button
                title="Delete"
                disabled={pages.length <= targets(page.id).length}
                onClick={() => deletePages(targets(page.id))}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {dropAt === pages.length && <div className="drop-marker" />}
      </div>

      <footer className="sidebar-foot">
        <button className="btn" onClick={() => insertBlank(anchor, 'same')}>
          Blank page
        </button>
        <button className="btn" onClick={() => mergeInputRef.current?.click()}>
          Insert PDF…
        </button>
        <button
          className="btn"
          disabled={!selected.length}
          onClick={() => extractPages(selected)}
          title="Download the selected pages as their own file"
        >
          Extract
        </button>
        <button className="btn" onClick={() => setSplitting(true)}>
          Split…
        </button>
        <input
          ref={mergeInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void mergeFile(file, anchor)
          }}
        />
      </footer>

      {splitting && <SplitDialog onClose={() => setSplitting(false)} />}
    </aside>
  )
}
