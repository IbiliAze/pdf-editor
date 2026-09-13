import { useEffect, useRef, useState } from 'react'
import { store } from '../../store'
import { NOTE_SIZE } from './draw'
import type { RenderCtx } from '../../types'
import type { LinkElement, NoteElement } from './types'

export function NoteView({ el, ctx }: { el: NoteElement; ctx: RenderCtx }) {
  const [open, setOpen] = useState(!el.text)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])

  return (
    <div
      className={`el-note${ctx.selected ? ' selected' : ''}`}
      style={{
        left: el.x * ctx.zoom,
        top: el.y * ctx.zoom,
        width: NOTE_SIZE * ctx.zoom,
        height: NOTE_SIZE * ctx.zoom,
        background: el.color,
      }}
      title={el.text || 'Empty note'}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setOpen(true)
      }}
    >
      <span className="note-mark">✎</span>
      {open && (
        <div className="note-popover" onPointerDown={(e) => e.stopPropagation()}>
          <textarea
            ref={ref}
            value={el.text}
            placeholder="Write a comment…"
            onChange={(e) =>
              store.get().updateElement(el.id, (x) => ({ ...x, text: e.target.value }), true)
            }
            onBlur={() => {
              setOpen(false)
              store.get().pushHistory()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

export function LinkView({ el, ctx }: { el: LinkElement; ctx: RenderCtx }) {
  const target = el.target
  const label =
    target.kind === 'url'
      ? target.url
      : `page ${store.get().pages.findIndex((p) => p.id === target.pageId) + 1}`
  return (
    <div
      className={`el-link${ctx.selected ? ' selected' : ''}`}
      style={{
        left: el.x * ctx.zoom,
        top: el.y * ctx.zoom,
        width: el.w * ctx.zoom,
        height: el.h * ctx.zoom,
      }}
      title={`Links to ${label}`}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
    />
  )
}
