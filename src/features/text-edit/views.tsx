import { useEffect, useRef } from 'react'
import { cssFontFor, measureText } from '../../lib/fonts'
import { frameBoxStyle } from './frame'
import { commitSession, cancelSession, updateSessionText } from './session'
import type { BlockSession, Line, LineSession, RenderCtx, TextBlock } from '../../types'
import type { BlockEditElement, EditElement } from './types'

const PAD = 1

/** A committed single-run replacement, drawn over the original glyphs. */
export function EditCover({ el, ctx }: { el: EditElement; ctx: RenderCtx }) {
  const line = ctx.linesById[el.lineId]
  if (!line) return null
  if (ctx.hiddenLineId === el.lineId) return null

  const font = el.font ?? line.font
  const size = el.size ?? line.fontHeight
  const tail = el.text.slice(el.keep ?? 0)
  const du = el.coverOffset ?? 0
  const textW = measureText(tail, size, font)
  const coverW = Math.max(line.width - du, textW) + PAD * 2

  return (
    <div
      className={`edit-cover${ctx.selected ? ' selected' : ''}`}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
      onDoubleClick={(e) => ctx.on.doubleClick(e, el)}
      style={{
        ...frameBoxStyle(line, line.x + du - PAD, line.top - PAD, ctx.zoom, coverW, line.height + PAD * 2),
        background: el.bg,
      }}
    >
      <span
        style={{
          fontSize: size * ctx.zoom,
          ...cssFontFor(font),
          color: el.color,
          lineHeight: `${(line.height + PAD * 2) * ctx.zoom}px`,
        }}
      >
        {tail}
      </span>
    </div>
  )
}

/** A committed paragraph replacement: the block is covered and re-flowed. */
export function BlockEditCover({ el, ctx }: { el: BlockEditElement; ctx: RenderCtx }) {
  const block = ctx.blocksById[el.blockId]
  if (!block) return null
  if (ctx.hiddenBlockId === el.blockId) return null

  const font = el.font ?? block.font
  const size = el.size ?? block.fontHeight
  const pitch = el.pitch ?? block.pitch
  const rows = Math.max(block.lineIds.length, estimateRows(el.text, block, size, font))
  const height = Math.max(block.height, rows * pitch)
  const first = ctx.linesById[block.lineIds[0]]
  const above = first ? first.baseline - first.top : size * 0.8

  return (
    <div
      className={`block-cover${ctx.selected ? ' selected' : ''}`}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
      onDoubleClick={(e) => ctx.on.doubleClick(e, el)}
      style={{
        ...frameBoxStyle(block, block.x - PAD, block.top - PAD, ctx.zoom, block.width + PAD * 2, height + PAD * 2),
        background: el.bg,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: PAD * ctx.zoom,
          top: (PAD + above - size * 0.8) * ctx.zoom,
          width: block.width * ctx.zoom,
          fontSize: size * ctx.zoom,
          lineHeight: `${pitch * ctx.zoom}px`,
          textAlign: block.align,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          ...cssFontFor(font),
          color: el.color,
        }}
      >
        {el.text}
      </div>
    </div>
  )
}

function estimateRows(
  text: string,
  block: TextBlock,
  size: number,
  font: { family: string },
): number {
  const width = measureText(text, size, block.font)
  void font
  return Math.max(1, Math.ceil(width / Math.max(1, block.width)))
}

/** Inline input over a native run. Enter or blur commits, Escape cancels. */
export function LineEditor({
  session,
  line,
  zoom,
}: {
  session: LineSession
  line: Line
  zoom: number
}) {
  const ref = useRef<HTMLInputElement>(null)

  // Clicking into the middle of a run should leave the caret there, so a
  // single word can be changed without retyping the line.
  const caret = session.caret
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    if (caret == null) el.select()
    else el.setSelectionRange(caret, caret)
    // Only on mount: later caret changes come from the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const css = cssFontFor(session.font)
  const fontSize = session.size * zoom
  const textW = measureText(session.text, fontSize, session.font)
  const boxW = Math.max(line.width + 6, (textW + 20) / zoom)
  const boxH = Math.max(line.height, session.size * 1.2) + 6

  return (
    <input
      ref={ref}
      className="line-editor"
      value={session.text}
      spellCheck={false}
      enterKeyHint="done"
      onChange={(e) => updateSessionText(e.target.value)}
      onBlur={() => commitSession()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commitSession()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelSession()
        }
      }}
      style={{
        ...frameBoxStyle(line, line.x - 3, line.top - 3, zoom, boxW, boxH),
        padding: `0 ${3 * zoom}px`,
        fontSize,
        lineHeight: `${boxH * zoom}px`,
        ...css,
        color: session.color,
        background: session.bg,
      }}
    />
  )
}

/** Textarea over a paragraph. Cmd/Ctrl+Enter or blur commits. */
export function BlockEditor({
  session,
  block,
  firstLine,
  zoom,
}: {
  session: BlockSession
  block: TextBlock
  firstLine: Line | undefined
  zoom: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // A paragraph is long enough that selecting it all would make one keypress
    // destroy the text, so the caret goes to the start instead.
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(0, 0)
  }, [])

  const css = cssFontFor(session.font)
  const fontSize = session.size * zoom
  const above = firstLine ? firstLine.baseline - firstLine.top : session.size * 0.8
  const rows = Math.max(block.lineIds.length, session.text.split('\n').length)
  const height = Math.max(block.height, rows * session.lineHeight) + session.lineHeight

  return (
    <textarea
      ref={ref}
      className="block-editor"
      value={session.text}
      spellCheck={false}
      onChange={(e) => updateSessionText(e.target.value)}
      onBlur={() => commitSession()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          commitSession()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelSession()
        }
      }}
      style={{
        ...frameBoxStyle(
          block,
          block.x - 3,
          block.top - 3 - (above - session.size * 0.8),
          zoom,
          block.width + 6,
          height,
        ),
        padding: `${3 * zoom}px`,
        fontSize,
        lineHeight: `${session.lineHeight * zoom}px`,
        textAlign: block.align,
        ...css,
        color: session.color,
        background: session.bg,
      }}
    />
  )
}
