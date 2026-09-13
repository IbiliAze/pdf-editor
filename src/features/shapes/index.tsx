import { registerFeature } from '../registry'
import { store } from '../../store'
import { nid } from '../../lib/ids'
import { normRect } from '../../lib/geometry'
import { drawShape } from './draw'
import { ShapeView } from './views'
import type { ElementKind, Point, ToolBehaviour } from '../../types'
import type { ShapeElement, ShapeKind } from './types'

const MIN_DRAG = 3

const shapeKind: ElementKind<ShapeElement> = {
  type: 'shape',
  layer: 24,
  render: (el, ctx) => <ShapeView el={el} ctx={ctx} />,
  draw: drawShape,
  bounds: (el) => normRect({ x: el.x, y: el.y, w: el.w, h: el.h }),
  move: (el, dx, dy) => ({ ...el, x: el.x + dx, y: el.y + dy }),
  resize: (el, r) => {
    // Lines keep their direction: the handle drag sets the bounding box, and
    // the sign of w/h says which way the line runs inside it.
    if (el.shape === 'line' || el.shape === 'arrow') {
      return { ...el, x: r.x, y: r.y, w: Math.sign(el.w || 1) * r.w, h: Math.sign(el.h || 1) * r.h }
    }
    return { ...el, ...r }
  },
  rotatePage: (el, t) => {
    const a = t({ x: el.x, y: el.y })
    const b = t({ x: el.x + el.w, y: el.y + el.h })
    return { ...el, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
  },
}

/** Snap a drag to a square, circle, or 45-degree line while shift is held. */
function constrain(from: Point, to: Point, shape: ShapeKind): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (shape === 'line' || shape === 'arrow') {
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
    const len = Math.hypot(dx, dy)
    return { x: from.x + Math.cos(angle) * len, y: from.y + Math.sin(angle) * len }
  }
  const size = Math.max(Math.abs(dx), Math.abs(dy))
  return { x: from.x + Math.sign(dx || 1) * size, y: from.y + Math.sign(dy || 1) * size }
}

function shapeTool(shape: ShapeKind): ToolBehaviour {
  return {
    cursor: 'crosshair',
    pointerDown: ({ page, point }) => {
      const style = store.get().shapeStyle
      const el: ShapeElement = {
        id: nid(),
        type: 'shape',
        pageId: page.id,
        shape,
        x: point.x,
        y: point.y,
        w: 0,
        h: 0,
        color: style.stroke,
        strokeWidth: style.strokeWidth,
        fill: shape === 'line' || shape === 'arrow' ? null : style.fill,
        opacity: style.opacity,
      }
      store.set({ liveDraw: el })
    },
    pointerMove: ({ page, point, event }) => {
      const d = store.get().liveDraw as ShapeElement | null
      if (!d || d.type !== 'shape' || d.pageId !== page.id) return
      const end = event.shiftKey ? constrain({ x: d.x, y: d.y }, point, shape) : point
      store.set({ liveDraw: { ...d, w: end.x - d.x, h: end.y - d.y } })
    },
    pointerUp: () => {
      const d = store.get().liveDraw as ShapeElement | null
      store.set({ liveDraw: null })
      if (!d) return
      if (Math.abs(d.w) < MIN_DRAG && Math.abs(d.h) < MIN_DRAG) return
      const el =
        d.shape === 'line' || d.shape === 'arrow' ? d : { ...d, ...normRect(d) }
      store.get().addElement(el, { select: false })
    },
  }
}

const TOOLS: { id: string; shape: ShapeKind; label: string; icon: string; hint: string }[] = [
  { id: 'rect', shape: 'rect', label: 'Rectangle', icon: '▢', hint: 'Drag to draw a rectangle. Hold Shift for a square.' },
  { id: 'ellipse', shape: 'ellipse', label: 'Ellipse', icon: '◯', hint: 'Drag to draw an ellipse. Hold Shift for a circle.' },
  { id: 'line', shape: 'line', label: 'Line', icon: '╱', hint: 'Drag to draw a line. Hold Shift to snap to 45 degrees.' },
  { id: 'arrow', shape: 'arrow', label: 'Arrow', icon: '↗', hint: 'Drag to draw an arrow. Hold Shift to snap to 45 degrees.' },
]

registerFeature({
  name: 'shapes',
  elements: [shapeKind],
  tools: TOOLS.map((t, i) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    group: 'annotate' as const,
    order: 40 + i,
    behaviour: shapeTool(t.shape),
    hint: t.hint,
  })),
})

export * from './types'
