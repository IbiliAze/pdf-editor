import { BlendMode, LineCapStyle, rgb } from 'pdf-lib'
import { hexToRgb01 } from '../../lib/colors'
import { drawDisplayText } from '../../lib/export/drawText'
import { HIGHLIGHT_COLOR } from '../../constants'
import type { ExportCtx } from '../../types'
import type { HighlightElement, PathElement, TextElement, WhiteoutElement } from './types'

const colorOf = (hex: string) => {
  const c = hexToRgb01(hex)
  return rgb(c.r, c.g, c.b)
}

export async function drawTextElement(el: TextElement, ctx: ExportCtx): Promise<void> {
  if (!el.text.trim()) return
  const font = await ctx.embedFont(el.font, el.text)
  drawDisplayText(ctx, el.text, {
    x: el.x,
    y: el.y,
    width: el.w,
    size: el.size,
    font,
    color: el.color,
    lineHeight: el.size * 1.25,
    align: el.align ?? 'left',
  })
}

export async function drawWhiteout(el: WhiteoutElement, ctx: ExportCtx): Promise<void> {
  ctx.page.drawRectangle({
    ...ctx.rectToPdf(el.x, el.y, el.w, el.h),
    color: el.color ? colorOf(el.color) : rgb(1, 1, 1),
  })
}

export async function drawHighlight(el: HighlightElement, ctx: ExportCtx): Promise<void> {
  ctx.page.drawRectangle({
    ...ctx.rectToPdf(el.x, el.y, el.w, el.h),
    color: colorOf(el.color || HIGHLIGHT_COLOR),
    opacity: 0.45,
    blendMode: BlendMode.Multiply,
  })
}

export async function drawPath(el: PathElement, ctx: ExportCtx): Promise<void> {
  for (let i = 1; i < el.points.length; i++) {
    const [ax, ay] = ctx.toPdf(el.points[i - 1].x, el.points[i - 1].y)
    const [bx, by] = ctx.toPdf(el.points[i].x, el.points[i].y)
    ctx.page.drawLine({
      start: { x: ax, y: ay },
      end: { x: bx, y: by },
      thickness: el.width,
      color: colorOf(el.color),
      lineCap: LineCapStyle.Round,
      ...(el.marker ? { opacity: 0.45, blendMode: BlendMode.Multiply } : {}),
    })
  }
}
