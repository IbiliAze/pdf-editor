import { useEffect, useRef } from 'react'
import type { PDFDocumentProxy } from '../lib/pdfjs'
import { normRect } from '../lib/utils'
import ElementView from './ElementView'
import LineEditor from './LineEditor'
import type {
  EditingSession,
  EditorElement,
  Line,
  LiveDraw,
  PageHandlers,
  PageInfo,
  ToolId,
} from '../types'

interface PageViewProps {
  page: PageInfo
  doc: PDFDocumentProxy | null
  zoom: number
  tool: ToolId
  elements: EditorElement[]
  linesById: Record<string, Line>
  selectedId: number | null
  editing: EditingSession | null
  editingElId: number | null
  liveDraw: LiveDraw | null
  on: PageHandlers
}

/**
 * One PDF page: the rendered canvas plus the interaction overlay with all
 * editor elements, line hit targets, and the inline line editor.
 */
export default function PageView({
  page,
  doc,
  zoom,
  tool,
  elements,
  linesById,
  selectedId,
  editing,
  editingElId,
  liveDraw,
  on,
}: PageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const genRef = useRef(0)

  // Render the page into an offscreen canvas at the current zoom, then blit,
  // so re-renders never show a blank page. `gen` discards stale renders.
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
  }, [doc, page.pageIndex, zoom])

  const pageElements = elements.filter((el) => el.pageIndex === page.pageIndex)
  const editedLineIds = new Set(
    pageElements.filter((el) => el.type === 'edit').map((el) => (el.type === 'edit' ? el.lineId : '')),
  )
  const editingLine =
    editing && editing.pageIndex === page.pageIndex ? linesById[editing.lineId] : null
  const w = page.width * zoom
  const h = page.height * zoom

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
          {pageElements.map((el) => (
            <ElementView
              key={el.id}
              el={el}
              zoom={zoom}
              tool={tool}
              pageW={w}
              pageH={h}
              isSelected={el.id === selectedId}
              editingElId={editingElId}
              editingLineId={editing?.lineId ?? null}
              linesById={linesById}
              on={on}
            />
          ))}

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
          {live && liveRect && (
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

          {tool === 'edittext' &&
            page.lines.map((line) =>
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
                    // preventDefault stops the browser's focus-change default
                    // action, which would otherwise blur (and instantly close)
                    // the editor input mounted by this click.
                    e.preventDefault()
                    e.stopPropagation()
                    on.lineClick(line, canvasRef.current, page)
                  }}
                />
              ),
            )}

          {editingLine && editing && (
            <LineEditor editing={editing} line={editingLine} zoom={zoom} on={on} />
          )}
        </div>
      </div>
    </div>
  )
}
