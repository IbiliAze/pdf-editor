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
