import { createElement } from 'react'
import { registerFeature } from '../registry'
import { drawHighlight, drawPath, drawTextElement, drawWhiteout } from './draw'
import { HighlightView, PathView, TextElementView, WhiteoutView } from './views'
import { addTextTool, highlightTool, penTool, selectTool, whiteoutTool } from './tools'
import type { ElementKind, Rect } from '../../types'
import type { HighlightElement, PathElement, TextElement, WhiteoutElement } from './types'

const boxBounds = (el: { x: number; y: number; w: number; h: number }): Rect => ({
  x: el.x,
  y: el.y,
  w: el.w,
  h: el.h,
})

const textKind: ElementKind<TextElement> = {
  type: 'text',
  layer: 20,
  render: (el, ctx) => createElement(TextElementView, { el, ctx }),
  draw: drawTextElement,
  bounds: (el) => ({ x: el.x, y: el.y, w: el.w, h: Math.max(el.size * 1.25, el.size) }),
  move: (el, dx, dy) => ({ ...el, x: el.x + dx, y: el.y + dy }),
  resize: (el, r) => ({ ...el, x: r.x, y: r.y, w: Math.max(24, r.w) }),
  rotatePage: (el, t) => {
    const p = t({ x: el.x, y: el.y })
    return { ...el, x: p.x, y: p.y }
  },
}

const whiteoutKind: ElementKind<WhiteoutElement> = {
  type: 'whiteout',
  layer: 5,
  render: (el, ctx) => createElement(WhiteoutView, { el, ctx }),
  draw: drawWhiteout,
  bounds: boxBounds,
  move: (el, dx, dy) => ({ ...el, x: el.x + dx, y: el.y + dy }),
  resize: (el, r) => ({ ...el, ...r }),
  rotatePage: (el, t) => {
    const a = t({ x: el.x, y: el.y })
    const b = t({ x: el.x + el.w, y: el.y + el.h })
    return {
      ...el,
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    }
  },
}

const highlightKind: ElementKind<HighlightElement> = {
  type: 'highlight',
  layer: 15,
  render: (el, ctx) => createElement(HighlightView, { el, ctx }),
  draw: drawHighlight,
  bounds: boxBounds,
  move: whiteoutKind.move as ElementKind<HighlightElement>['move'],
  resize: (el, r) => ({ ...el, ...r }),
  rotatePage: whiteoutKind.rotatePage as ElementKind<HighlightElement>['rotatePage'],
}

const pathKind: ElementKind<PathElement> = {
  type: 'path',
  layer: 25,
  render: (el, ctx) => createElement(PathView, { el, ctx }),
  draw: drawPath,
  bounds: (el) => {
    if (!el.points.length) return null
    const xs = el.points.map((p) => p.x)
    const ys = el.points.map((p) => p.y)
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    }
  },
  move: (el, dx, dy) => ({
    ...el,
    points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  }),
  rotatePage: (el, t) => ({ ...el, points: el.points.map(t) }),
}

registerFeature({
  name: 'annotate',
  elements: [textKind, whiteoutKind, highlightKind, pathKind],
  tools: [
    {
      id: 'text',
      label: 'Add text',
      icon: '+T',
      group: 'insert',
      order: 20,
      behaviour: addTextTool,
      hint: 'Click anywhere on a page to place a new text box. Drag its right edge to set the column width.',
    },
    {
      id: 'select',
      label: 'Select',
      icon: '↖',
      group: 'text',
      order: 1,
      behaviour: selectTool,
      hint: 'Click an edit or annotation to move, restyle, or delete it. Drag on empty space to select several.',
    },
    {
      id: 'whiteout',
      label: 'Whiteout',
      icon: '▭',
      group: 'annotate',
      order: 30,
      behaviour: whiteoutTool,
      hint: 'Drag over content to cover it. This hides content visually; use Redact to remove it.',
    },
    {
      id: 'highlight',
      label: 'Highlight',
      icon: 'H',
      group: 'annotate',
      order: 31,
      behaviour: highlightTool,
      hint: 'Drag over text to highlight it.',
    },
    {
      id: 'pen',
      label: 'Pen',
      icon: '✎',
      group: 'annotate',
      order: 32,
      behaviour: penTool,
      hint: 'Draw freehand on the page.',
    },
  ],
})

export * from './types'
