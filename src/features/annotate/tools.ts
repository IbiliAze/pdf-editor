import { store } from '../../store'
import { nid } from '../../lib/ids'
import { normRect, rectsOverlap } from '../../lib/geometry'
import { boundsOf } from '../../actions/elements'
import { HIGHLIGHT_COLOR } from '../../constants'
import { kindOf } from '../registry'
import type { EditorElement, Rect, ToolBehaviour, ToolCtx } from '../../types'
import type { HighlightElement, PathElement, TextElement, WhiteoutElement } from './types'

const MIN_DRAG = 2

export const addTextTool: ToolBehaviour = {
  cursor: 'text',
  pointerDown: ({ page, point, event }) => {
    const s = store.get()
    const el: TextElement = {
      id: nid(),
      type: 'text',
      pageId: page.id,
      x: point.x,
      y: point.y,
      w: 240,
      text: '',
      size: s.textStyle.size,
      color: s.textStyle.color,
      font: { family: s.textStyle.family, bold: s.textStyle.bold, italic: s.textStyle.italic },
    }
    s.addElement(el)
    store.set({ session: { kind: 'element', id: el.id } })
    event.preventDefault()
  },
}

function rectTool(make: (ctx: ToolCtx) => EditorElement): ToolBehaviour {
  return {
    cursor: 'crosshair',
    pointerDown: (ctx) => store.set({ liveDraw: make(ctx) }),
    pointerMove: ({ page, point }) => {
      const d = store.get().liveDraw as (EditorElement & Rect) | null
      if (!d || d.pageId !== page.id) return
      store.set({ liveDraw: { ...d, w: point.x - d.x, h: point.y - d.y } as EditorElement })
    },
    pointerUp: () => {
      const d = store.get().liveDraw as (EditorElement & Rect) | null
      store.set({ liveDraw: null })
      if (!d) return
      const r = normRect(d) as EditorElement
      if (Math.abs(d.w) > MIN_DRAG && Math.abs(d.h) > MIN_DRAG) {
        store.get().addElement(r, { select: false })
      }
    },
  }
}

export const whiteoutTool = rectTool(({ page, point }) => {
  const el: WhiteoutElement = {
    id: nid(),
    type: 'whiteout',
    pageId: page.id,
    x: point.x,
    y: point.y,
    w: 0,
    h: 0,
  }
  return el
})

export const highlightTool = rectTool(({ page, point }) => {
  const el: HighlightElement = {
    id: nid(),
    type: 'highlight',
    pageId: page.id,
    x: point.x,
    y: point.y,
    w: 0,
    h: 0,
    color: HIGHLIGHT_COLOR,
  }
  return el
})

export const penTool: ToolBehaviour = {
  cursor: 'crosshair',
  pointerDown: ({ page, point }) => {
    const s = store.get()
    const el: PathElement = {
      id: nid(),
      type: 'path',
      pageId: page.id,
      points: [point],
      color: s.textStyle.color,
      width: 2,
    }
    store.set({ liveDraw: el })
  },
  pointerMove: ({ page, point }) => {
    const d = store.get().liveDraw as PathElement | null
    if (!d || d.type !== 'path' || d.pageId !== page.id) return
    const last = d.points[d.points.length - 1]
    // Drop sub-pixel moves so the exported path stays small.
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.6) return
    store.set({ liveDraw: { ...d, points: [...d.points, point] } })
  },
  pointerUp: () => {
    const d = store.get().liveDraw as PathElement | null
    store.set({ liveDraw: null })
    if (d && d.points.length > 1) store.get().addElement(d, { select: false })
  },
}

interface MarqueeState {
  pageId: string
  origin: { x: number; y: number }
  additive: boolean
  base: number[]
}

let marquee: MarqueeState | null = null

export const selectTool: ToolBehaviour = {
  cursor: 'default',
  pointerDown: ({ page, point, event }) => {
    const s = store.get()
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    marquee = { pageId: page.id, origin: point, additive, base: additive ? s.selectedIds : [] }
    if (!additive) s.clearSelection()
    store.set({ marquee: { x: point.x, y: point.y, w: 0, h: 0 } })
  },
  pointerMove: ({ page, point }) => {
    if (!marquee || marquee.pageId !== page.id) return
    store.set({
      marquee: normRect({
        x: marquee.origin.x,
        y: marquee.origin.y,
        w: point.x - marquee.origin.x,
        h: point.y - marquee.origin.y,
      }),
    })
  },
  pointerUp: () => {
    const state = store.get()
    const rect = state.marquee
    const m = marquee
    marquee = null
    store.set({ marquee: null })
    if (!m || !rect) return
    if (rect.w < MIN_DRAG && rect.h < MIN_DRAG) return
    const hits: number[] = []
    for (const el of state.elements) {
      if (el.pageId !== m.pageId) continue
      if (kindOf(el)?.pinned) continue
      const b = boundsOf(el)
      if (b && rectsOverlap(b, rect)) hits.push(el.id)
    }
    store.set({ selectedIds: [...new Set([...m.base, ...hits])] })
  },
}
