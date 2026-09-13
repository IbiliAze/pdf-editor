import { rgb } from 'pdf-lib'
import { hexToRgb01 } from '../../lib/colors'
import type { ExportCtx } from '../../types'
import type { ShapeElement } from './types'

const colorOf = (hex: string) => {
  const c = hexToRgb01(hex)
  return rgb(c.r, c.g, c.b)
}

const ARROW_HEAD = 3.2

export async function drawShape(el: ShapeElement, ctx: ExportCtx): Promise<void> {
  const stroke = colorOf(el.color)
  const fill = el.fill ? colorOf(el.fill) : undefined

  if (el.shape === 'rect') {
    const r = ctx.rectToPdf(el.x, el.y, el.w, el.h)
    ctx.page.drawRectangle({
      ...r,
      borderColor: stroke,
      borderWidth: el.strokeWidth,
      borderOpacity: el.opacity,
      ...(fill ? { color: fill, opacity: el.opacity } : { opacity: 0 }),
    })
    return
  }

  if (el.shape === 'ellipse') {
    const r = ctx.rectToPdf(el.x, el.y, el.w, el.h)
    ctx.page.drawEllipse({
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      xScale: r.width / 2,
      yScale: r.height / 2,
      borderColor: stroke,
      borderWidth: el.strokeWidth,
      borderOpacity: el.opacity,
      ...(fill ? { color: fill, opacity: el.opacity } : { opacity: 0 }),
    })
    return
  }

  const [ax, ay] = ctx.toPdf(el.x, el.y)
  const [bx, by] = ctx.toPdf(el.x + el.w, el.y + el.h)
  ctx.page.drawLine({
    start: { x: ax, y: ay },
    end: { x: bx, y: by },
    thickness: el.strokeWidth,
    color: stroke,
    opacity: el.opacity,
  })

  if (el.shape === 'arrow') {
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    if (len < 0.5) return
    const ux = dx / len
    const uy = dy / len
    const size = Math.max(4, el.strokeWidth * ARROW_HEAD)
    // Two short strokes back from the tip read as an arrowhead at any weight
    // and need no filled path.
    for (const sign of [1, -1]) {
      const wingX = -ux * size - sign * uy * size * 0.55
      const wingY = -uy * size + sign * ux * size * 0.55
      ctx.page.drawLine({
        start: { x: bx, y: by },
        end: { x: bx + wingX, y: by + wingY },
        thickness: el.strokeWidth,
        color: stroke,
        opacity: el.opacity,
      })
    }
  }
}
