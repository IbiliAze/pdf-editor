import { cssFontFor, measureText } from '../lib/fonts'
import type { EditorElement, Line, PageHandlers, ToolId } from '../types'

interface ElementViewProps {
  el: EditorElement
  zoom: number
  tool: ToolId
  /** page size in display px (for the svg path layer) */
  pageW: number
  pageH: number
  isSelected: boolean
  /** id of the added text box currently being typed in, if any */
  editingElId: number | null
  /** lineId of the open native-text edit session, if any (its cover is hidden) */
  editingLineId: string | null
  linesById: Record<string, Line>
  on: PageHandlers
}

/** Renders one committed editor element on a page overlay. */
export default function ElementView({
  el,
  zoom,
  tool,
  pageW,
  pageH,
  isSelected,
  editingElId,
  editingLineId,
  linesById,
  on,
}: ElementViewProps) {
  if (el.type === 'whiteout') {
    return (
      <div
        className={`el-whiteout${isSelected ? ' selected' : ''}`}
        style={{ left: el.x * zoom, top: el.y * zoom, width: el.w * zoom, height: el.h * zoom }}
        onPointerDown={(e) => on.elementPointerDown(e, el)}
      />
    )
  }

  if (el.type === 'highlight') {
    return (
      <div
        className={`el-highlight${isSelected ? ' selected' : ''}`}
        style={{
          left: el.x * zoom,
          top: el.y * zoom,
          width: el.w * zoom,
          height: el.h * zoom,
          background: el.color,
        }}
        onPointerDown={(e) => on.elementPointerDown(e, el)}
      />
    )
  }

  if (el.type === 'path') {
    return (
      <svg className="draw-layer" width={pageW} height={pageH}>
        <polyline
          points={el.points.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
          fill="none"
          stroke={el.color}
          strokeWidth={Math.max(1, el.width * zoom)}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isSelected ? 'selected-vector' : ''}
          style={{ pointerEvents: tool === 'select' ? 'stroke' : 'none' }}
          onPointerDown={(e) => on.elementPointerDown(e, el)}
        />
      </svg>
    )
  }

  if (el.type === 'edit') {
    // The open editor input replaces the cover while this line is edited.
    if (editingLineId === el.lineId) return null
    const line = linesById[el.lineId]
    if (!line) return null
    const font = el.font ?? line.font
    const size = el.size ?? line.fontHeight
    const textW = measureText(el.text, size * zoom, font)
    const coverW = Math.max((line.width + 2) * zoom, textW + 2)
    return (
      <div
        className={`edit-cover${isSelected ? ' selected' : ''}`}
        onPointerDown={(e) => on.elementPointerDown(e, el)}
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
            fontSize: size * zoom,
            ...cssFontFor(font),
            color: el.color,
            lineHeight: `${(line.height + 2) * zoom}px`,
          }}
        >
          {el.text}
        </span>
      </div>
    )
  }

  // el.type === 'text'
  const fontCss = cssFontFor(el.font)
  if (el.id === editingElId) {
    return (
      <textarea
        autoFocus
        className="text-el editing"
        value={el.text}
        rows={Math.max(1, el.text.split('\n').length)}
        spellCheck={false}
        onChange={(e) => on.elementTextChange(el.id, e.target.value)}
        onBlur={() => on.finishElementEdit(el.id)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') on.finishElementEdit(el.id)
        }}
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
      className={`text-el${isSelected ? ' selected' : ''}`}
      onPointerDown={(e) => on.elementPointerDown(e, el)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        on.elementDoubleClick(el)
      }}
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
      {isSelected && tool === 'select' && (
        <div className="resize-handle" onPointerDown={(e) => on.resizePointerDown(e, el)} />
      )}
    </div>
  )
}
