import { registerFeature } from '../registry'
import { registerExportPlugin } from '../../lib/export/buildPdf'
import { store } from '../../store'
import { nid } from '../../lib/ids'
import { normRect } from '../../lib/geometry'
import { rasterizePage, redactedPageIds } from './rasterize'
import type { ElementKind, RenderCtx, ToolBehaviour } from '../../types'
import type { RedactElement } from './types'

const MIN_DRAG = 3

function RedactView({ el, ctx }: { el: RedactElement; ctx: RenderCtx }) {
  return (
    <div
      className={`el-redact${ctx.selected ? ' selected' : ''}`}
      title="This area is removed from the exported file"
      style={{
        left: el.x * ctx.zoom,
        top: el.y * ctx.zoom,
        width: el.w * ctx.zoom,
        height: el.h * ctx.zoom,
      }}
      onPointerDown={(e) => ctx.on.pointerDown(e, el)}
    />
  )
}

const redactKind: ElementKind<RedactElement> = {
  type: 'redact',
  // Redactions are burned into the raster, so nothing draws them at export.
  layer: 0,
  render: (el, ctx) => <RedactView el={el} ctx={ctx} />,
  draw: async () => {},
  bounds: (el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }),
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

const redactTool: ToolBehaviour = {
  cursor: 'crosshair',
  pointerDown: ({ page, point }) => {
    const el: RedactElement = {
      id: nid(),
      type: 'redact',
      pageId: page.id,
      x: point.x,
      y: point.y,
      w: 0,
      h: 0,
    }
    store.set({ liveDraw: el })
  },
  pointerMove: ({ page, point }) => {
    const d = store.get().liveDraw as RedactElement | null
    if (!d || d.type !== 'redact' || d.pageId !== page.id) return
    store.set({ liveDraw: { ...d, w: point.x - d.x, h: point.y - d.y } })
  },
  pointerUp: () => {
    const d = store.get().liveDraw as RedactElement | null
    store.set({ liveDraw: null })
    if (!d) return
    if (Math.abs(d.w) < MIN_DRAG || Math.abs(d.h) < MIN_DRAG) return
    store.get().addElement(normRect(d), { select: false })
  },
}

/** Add a redaction covering a rectangle, used by "redact all matches". */
export function redactRect(pageId: string, rect: { x: number; y: number; w: number; h: number }): RedactElement {
  return { id: nid(), type: 'redact', pageId, ...rect }
}

registerExportPlugin({
  rasterizePages: redactedPageIds,
  rasterize: rasterizePage,
})

registerFeature({
  name: 'redaction',
  elements: [redactKind],
  tools: [
    {
      id: 'redact',
      label: 'Redact',
      icon: '■',
      group: 'annotate',
      order: 50,
      behaviour: redactTool,
      hint: 'Drag over anything that must be removed. Redacted pages are exported as images, so the hidden content is gone from the file and the rest of that page stops being selectable text.',
    },
  ],
})

export * from './types'
export { redactedPageIds } from './rasterize'
