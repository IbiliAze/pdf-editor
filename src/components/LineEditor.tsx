import { useEffect, useRef } from 'react'
import { cssFontFor, measureText } from '../lib/fonts'
import type { EditingSession, Line, PageHandlers } from '../types'

interface LineEditorProps {
  editing: EditingSession
  line: Line
  zoom: number
  on: PageHandlers
}

/**
 * Inline input over a native text line. Mounted by PageView while a line
 * edit session is open; Enter/blur commits, Escape cancels.
 */
export default function LineEditor({ editing, line, zoom, on }: LineEditorProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const css = cssFontFor(editing.font)
  const fontSize = editing.size * zoom
  const textW = measureText(editing.text, fontSize, editing.font)
  const width = Math.max((line.width + 6) * zoom + 8, textW + 20)
  const height = (Math.max(line.height, editing.size * 1.2) + 6) * zoom

  return (
    <input
      ref={ref}
      className="line-editor"
      value={editing.text}
      spellCheck={false}
      autoFocus
      enterKeyHint="done"
      onChange={(e) => on.lineEditChange(e.target.value)}
      onBlur={() => on.commitLineEdit()}
      onPointerDown={(e) => e.stopPropagation()}
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
        height,
        padding: `0 ${3 * zoom}px`,
        fontSize,
        ...css,
        color: editing.color,
        background: editing.bg,
      }}
    />
  )
}
