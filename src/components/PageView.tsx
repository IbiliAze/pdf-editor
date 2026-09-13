import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store'
import { usePageElements } from '../store/selectors'
import { toolById } from '../features/registry'
import { kindOf } from '../features/registry'
import { pagePointerDown, pagePointerMove, pagePointerUp } from '../actions/interaction'
import { beginMove, beginResize } from '../hooks/useDragInteraction'
import {
  BlockEditor,
  LineEditor,
  blockEditForLine,
  startBlockEdit,
  startLineEdit,
} from '../features/text-edit'
import { frameBoxStyle } from '../features/text-edit/frame'
import { totalRotation } from '../types'
import ElementLayer from './ElementLayer'
import { FormLayer } from '../features/forms'
import { MatchLayer } from '../features/search'
import type { EditorElement, ElementEvents, Line, Page } from '../types'

interface Props {
  page: Page
  index: number
}

/** One page: the rendered canvas plus the interaction overlay. */
export default function PageView({ page, index }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const genRef = useRef(0)
  const shellRef = useRef<HTMLDivElement>(null)

  const zoom = useStore((s) => s.zoom)
  const tool = useStore((s) => s.tool)
  const session = useStore((s) => s.session)
  const liveDraw = useStore((s) => s.liveDraw)
  const marquee = useStore((s) => s.marquee)
  const activePageId = useStore((s) => s.activePageId)
  const sources = useStore((s) => s.sources)
  const pageText = useStore((s) => s.pageText[page.id])
  const ensurePageText = useStore((s) => s.ensurePageText)
  const elements = usePageElements(page.id)

  const behaviour = toolById(tool)?.behaviour
  const w = page.width * zoom
  const h = page.height * zoom

  // Render the page into an offscreen canvas at the current zoom, then blit, so
  // re-renders never show a blank page. `gen` discards superseded renders.
  useEffect(() => {
    const src = page.source
    if (src.kind !== 'pdf') {
      const canvas = canvasRef.current
      if (canvas) {
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(page.width * zoom * dpr)
        canvas.height = Math.floor(page.height * zoom * dpr)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      }
      return
    }
    const doc = sources[src.docId]?.pdfjs
    if (!doc) return
    const gen = ++genRef.current
    let cancelled = false
    ;(async () => {
      try {
        const p = await doc.getPage(src.pageIndex + 1)
        const dpr = window.devicePixelRatio || 1
        const vp = p.getViewport({ scale: zoom * dpr, rotation: totalRotation(page) })
        const off = document.createElement('canvas')
        off.width = Math.floor(vp.width)
        off.height = Math.floor(vp.height)
        const offCtx = off.getContext('2d')
        if (!offCtx) return
        await p.render({ canvasContext: offCtx, viewport: vp }).promise
        if (cancelled || gen !== genRef.current) return
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = off.width
        canvas.height = off.height
        canvas.getContext('2d')?.drawImage(off, 0, 0)
      } catch {
        // rendering superseded or page torn down
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sources, page, zoom])

  // Extract text the first time the page scrolls into view.
  useEffect(() => {
    const el = shellRef.current
    if (!el || pageText) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          ensurePageText(page.id)
          io.disconnect()
        }
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [page.id, pageText, ensurePageText])

  const events: ElementEvents = useMemo(
    () => ({
      pointerDown: (e, el) => {
        const s = useStore.getState()
        if (s.tool === 'edittext' || s.tool === 'editpara') {
          if (el.type === 'edit') {
            // preventDefault stops the browser's focus-change default action,
            // which would otherwise blur (and instantly close) the editor.
            e.preventDefault()
            e.stopPropagation()
            const line = s.pageText[el.pageId]?.lines.find(
              (l) => l.id === (el as { lineId: string }).lineId,
            )
            if (line) startLineEdit(line, canvasRef.current, page.width)
          } else if (el.type === 'blockedit') {
            e.preventDefault()
            e.stopPropagation()
            openBlock(el, page, canvasRef.current)
          }
          return
        }
        if (s.tool !== 'select') return
        e.stopPropagation()
        const additive = e.shiftKey || e.metaKey || e.ctrlKey
        const ids = additive
          ? s.selectedIds.includes(el.id)
            ? s.selectedIds.filter((id) => id !== el.id)
            : [...s.selectedIds, el.id]
          : s.selectedIds.includes(el.id)
            ? s.selectedIds
            : [el.id]
        s.setSelection(ids)
        if (kindOf(el)?.pinned) return
        beginMove(e, ids.filter((id) => !kindOf(s.elements.find((x) => x.id === id)!)?.pinned))
      },
      doubleClick: (_e, el) => {
        const s = useStore.getState()
        if (el.type === 'text') {
          s.setSelection([el.id])
          s.setSession({ kind: 'element', id: el.id })
        }
      },
      resizePointerDown: (e, el, handle) => {
        e.stopPropagation()
        useStore.getState().setSelection([el.id])
        beginResize(e, el, handle)
      },
      textChange: (id, text) => {
        useStore
          .getState()
          .updateElement(id, (el) => ({ ...el, text }) as EditorElement, true)
      },
      finishTextEdit: (id) => {
        const s = useStore.getState()
        s.setSession(null)
        const el = s.elements.find((e) => e.id === id) as (EditorElement & { text?: string }) | undefined
        if (el && el.type === 'text' && !el.text?.trim()) s.removeElements([id])
      },
    }),
    [page],
  )

  const onLineClick = useCallback(
    (line: Line, caretU?: number) => {
      const s = useStore.getState()
      if (s.tool === 'editpara' && line.blockId) {
        const block = s.pageText[page.id]?.blocks.find((b) => b.id === line.blockId)
        const lines = s.pageText[page.id]?.lines ?? []
        if (block) {
          startBlockEdit(
            block,
            block.lineIds.map((id) => lines.find((l) => l.id === id)!).filter(Boolean),
            canvasRef.current,
            page.width,
          )
          return
        }
      }
      startLineEdit(line, canvasRef.current, page.width, caretU)
    },
    [page],
  )

  const editedLineIds = useMemo(() => {
    const set = new Set<string>()
    for (const el of elements) {
      if (el.type === 'edit') set.add((el as { lineId: string }).lineId)
      if (el.type === 'blockedit') {
        const block = pageText?.blocks.find((b) => b.id === (el as { blockId: string }).blockId)
        for (const id of block?.lineIds ?? []) set.add(id)
      }
    }
    return set
  }, [elements, pageText])

  const showHits = behaviour?.showLineHits
  const editingLine =
    session?.kind === 'line' ? pageText?.lines.find((l) => l.id === session.lineId) : undefined
  const editingBlock =
    session?.kind === 'block' ? pageText?.blocks.find((b) => b.id === session.blockId) : undefined

  const live = liveDraw && liveDraw.pageId === page.id ? liveDraw : null

  return (
    <div className="page-shell" ref={shellRef} data-page-id={page.id}>
      <div className="page-label">Page {index + 1}</div>
      <div className="page-wrap" style={{ width: w, height: h }}>
        <canvas ref={canvasRef} style={{ width: w, height: h }} />
        <div
          className={`overlay tool-${tool}`}
          style={behaviour?.cursor ? { cursor: behaviour.cursor } : undefined}
          onPointerDown={(e) => pagePointerDown(e, page, canvasRef.current)}
          onPointerMove={(e) => pagePointerMove(e, page, canvasRef.current)}
          onPointerUp={(e) => pagePointerUp(e, page, canvasRef.current)}
          onPointerLeave={(e) => pagePointerUp(e, page, canvasRef.current)}
        >
          <ElementLayer page={page} elements={elements} events={events} />
          <FormLayer page={page} />
          <MatchLayer page={page} />

          {live && <LivePreview el={live} page={page} zoom={zoom} />}

          {marquee && activePageId === page.id && (
            <div
              className="marquee"
              style={{
                left: marquee.x * zoom,
                top: marquee.y * zoom,
                width: marquee.w * zoom,
                height: marquee.h * zoom,
              }}
            />
          )}

          {showHits &&
            (pageText?.lines ?? []).map((line) =>
              editedLineIds.has(line.id) || session?.kind === 'line' ? null : (
                <LineHit
                  key={line.id}
                  line={line}
                  zoom={zoom}
                  mode={showHits}
                  onActivate={onLineClick}
                />
              ),
            )}

          {editingLine && session?.kind === 'line' && (
            <LineEditor session={session} line={editingLine} zoom={zoom} />
          )}
          {editingBlock && session?.kind === 'block' && (
            <BlockEditor
              session={session}
              block={editingBlock}
              firstLine={pageText?.lines.find((l) => l.id === editingBlock.lineIds[0])}
              zoom={zoom}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function openBlock(el: EditorElement, page: Page, canvas: HTMLCanvasElement | null): void {
  const s = useStore.getState()
  const blockId = (el as { blockId: string }).blockId
  const block = s.pageText[page.id]?.blocks.find((b) => b.id === blockId)
  if (!block) return
  const lines = s.pageText[page.id]?.lines ?? []
  startBlockEdit(
    block,
    block.lineIds.map((id) => lines.find((l) => l.id === id)!).filter(Boolean),
    canvas,
    page.width,
  )
}

const MIN_HIT = 9

function LineHit({
  line,
  zoom,
  mode,
  onActivate,
}: {
  line: Line
  zoom: number
  mode: 'line' | 'block'
  onActivate: (line: Line, caretU?: number) => void
}) {
  if (mode === 'block' && !line.blockId) return null
  if (blockEditForLine(line)) return null
  const pad = 2
  // Tiny runs still need a target a finger can hit.
  const h = Math.max(line.height + pad * 2, MIN_HIT / zoom)
  const vTop = line.top + line.height / 2 - h / 2
  return (
    <div
      className={`line-hit${mode === 'block' ? ' block-hit' : ''}`}
      title={mode === 'block' ? 'Click to edit this paragraph' : 'Click to edit this text'}
      style={frameBoxStyle(line, line.x - pad, vTop, zoom, line.width + pad * 2, h)}
      onPointerDown={(e) => {
        // preventDefault stops the browser's focus-change default action, which
        // would otherwise blur (and instantly close) the editor this opens.
        e.preventDefault()
        e.stopPropagation()
        // offsetX is in the hit box's own space, so it already accounts for the
        // rotation applied to angled runs.
        const offset = (e.nativeEvent as PointerEvent).offsetX
        onActivate(line, Number.isFinite(offset) ? line.x - pad + offset / zoom : undefined)
      }}
      onMouseDown={(e) => e.preventDefault()}
    />
  )
}

function LivePreview({ el, page, zoom }: { el: EditorElement; page: Page; zoom: number }) {
  const kind = kindOf(el)
  if (!kind) return null
  return (
    <div className="live-preview">
      {kind.render(el, {
        zoom,
        tool: 'select',
        page,
        selected: false,
        editing: false,
        linesById: {},
        blocksById: {},
        hiddenLineId: null,
        hiddenBlockId: null,
        on: {
          pointerDown: () => {},
          doubleClick: () => {},
          resizePointerDown: () => {},
          textChange: () => {},
          finishTextEdit: () => {},
        },
      })}
    </div>
  )
}
