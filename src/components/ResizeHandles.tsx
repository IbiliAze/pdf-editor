import { boundsOf } from '../actions/elements'
import type { EditorElement, ElementEvents, ResizeHandle } from '../types'

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const POS: Record<ResizeHandle, [number, number]> = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
}

/** Eight drag handles around the selected element's display bounds. */
export function ResizeHandles({
  el,
  zoom,
  events,
}: {
  el: EditorElement
  zoom: number
  events: ElementEvents
}) {
  const b = boundsOf(el)
  if (!b) return null
  return (
    <>
      {HANDLES.map((h) => {
        const [fx, fy] = POS[h]
        return (
          <div
            key={h}
            className={`resize-handle handle-${h}`}
            style={{ left: (b.x + b.w * fx) * zoom, top: (b.y + b.h * fy) * zoom }}
            onPointerDown={(e) => events.resizePointerDown(e, el, h)}
          />
        )
      })}
    </>
  )
}
