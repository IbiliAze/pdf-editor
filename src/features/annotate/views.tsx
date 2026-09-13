import { cssFontFor } from '../../lib/fonts'
import { HIGHLIGHT_COLOR } from '../../constants'
import type { RenderCtx } from '../../types'
import type { HighlightElement, PathElement, TextElement, WhiteoutElement } from './types'

export function WhiteoutView({ el, ctx }: { el: WhiteoutElement; ctx: RenderCtx }) {
  return (
    <div
      className={`el-whiteout${ctx.selected ? ' selected' : ''}`}
      style={{
        left: el.x * ctx.zoom,
        top: el.y * ctx.zoom,
        width: el.w * ctx.zoom,
        height: el.h * ctx.zoom,
        background: el.color ?? '#ffffff',
      }}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
    />
  )
}

export function HighlightView({ el, ctx }: { el: HighlightElement; ctx: RenderCtx }) {
  return (
    <div
      className={`el-highlight${ctx.selected ? ' selected' : ''}`}
      style={{
        left: el.x * ctx.zoom,
        top: el.y * ctx.zoom,
        width: el.w * ctx.zoom,
        height: el.h * ctx.zoom,
        background: el.color || HIGHLIGHT_COLOR,
      }}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
    />
  )
}

export function PathView({ el, ctx }: { el: PathElement; ctx: RenderCtx }) {
  return (
    <svg className="draw-layer" width={ctx.page.width * ctx.zoom} height={ctx.page.height * ctx.zoom}>
      <polyline
        points={el.points.map((p) => `${p.x * ctx.zoom},${p.y * ctx.zoom}`).join(' ')}
        fill="none"
        stroke={el.color}
        strokeWidth={Math.max(1, el.width * ctx.zoom)}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={el.marker ? 0.45 : 1}
        className={ctx.selected ? 'selected-vector' : ''}
        style={{ pointerEvents: ctx.tool === 'select' ? 'stroke' : 'none' }}
        onPointerDown={(e) => ctx.on.pointerDown(e, el)}
      />
    </svg>
  )
}

export function TextElementView({ el, ctx }: { el: TextElement; ctx: RenderCtx }) {
  const fontCss = cssFontFor(el.font)
  const common = {
    left: el.x * ctx.zoom,
    top: el.y * ctx.zoom,
    width: el.w * ctx.zoom,
    fontSize: el.size * ctx.zoom,
    lineHeight: 1.25,
    textAlign: el.align ?? 'left',
    color: el.color,
    ...fontCss,
  } as const

  if (ctx.editing) {
    return (
      <textarea
        autoFocus
        className="text-el editing"
        value={el.text}
        rows={Math.max(1, el.text.split('\n').length)}
        spellCheck={false}
        onChange={(e) => ctx.on.textChange(el.id, e.target.value)}
        onBlur={() => ctx.on.finishTextEdit(el.id)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') ctx.on.finishTextEdit(el.id)
        }}
        style={common}
      />
    )
  }

  return (
    <div
      className={`text-el${ctx.selected ? ' selected' : ''}`}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        ctx.on.doubleClick(e, el)
      }}
      style={common}
    >
      {el.text || ' '}
    </div>
  )
}
