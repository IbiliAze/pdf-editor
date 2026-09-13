import { degrees, rgb } from 'pdf-lib'
import type { PDFFont } from 'pdf-lib'
import { hexToRgb01 } from '../../lib/colors'
import { drawDisplayText, BASELINE_RATIO } from '../../lib/export/drawText'
import { parsePageRange } from '../../lib/pageModel'
import type { ExportState } from '../../lib/export/buildPdf'
import type { ExportCtx, FontSpec, NumberPosition, TextBand } from '../../types'

export interface DecorationSlot {
  x: number
  y: number
  width: number
  align: 'left' | 'center' | 'right'
}

/** Fill {n}, {N}, {filename} and {date} in a header, footer or page number. */
export function fillTemplate(
  template: string,
  index: number,
  total: number,
  fileName: string,
  startAt = 1,
): string {
  return String(template ?? '')
    .replace(/\{n\}/g, String(index + startAt))
    .replace(/\{N\}/g, String(total + startAt - 1))
    .replace(/\{filename\}/g, fileName)
    .replace(/\{date\}/g, new Date().toLocaleDateString())
}

const inRange = (expr: string | undefined, index: number, total: number): boolean =>
  parsePageRange(expr ?? 'all', total).includes(index)

/** Where a page-number sits, given the page size and margin. */
export function numberSlot(
  position: NumberPosition,
  width: number,
  height: number,
  margin: number,
  size: number,
): DecorationSlot {
  const top = position.startsWith('t')
  const align = position.endsWith('l') ? 'left' : position.endsWith('r') ? 'right' : 'center'
  return {
    x: margin,
    y: top ? margin : height - margin - size * 1.2,
    width: width - margin * 2,
    align,
  }
}

/** Draw the watermark, page numbers, header and footer onto one page. */
export async function drawDecorations(
  state: ExportState,
  ctx: ExportCtx,
  index: number,
  total: number,
): Promise<void> {
  const { watermark, pageNumbers, header, footer } = state.decorations
  const { width, height } = ctx.modelPage
  const fileName = state.fileName || 'document'

  if (watermark?.text && inRange(watermark.pages, index, total)) {
    const font = await ctx.embedFont(watermark.font, watermark.text)
    const textWidth = safeWidth(font, watermark.text, watermark.size)
    const c = hexToRgb01(watermark.color)
    // Rotate about the page centre: place the baseline start so the text is
    // centred once the rotation is applied.
    const angle = watermark.angle
    const rad = (angle * Math.PI) / 180
    const cx = width / 2
    const cy = height / 2
    const halfW = textWidth / 2
    const startX = cx - halfW * Math.cos(rad) - 0
    const startY = cy - halfW * Math.sin(rad) + watermark.size * 0.35
    const [px, py] = ctx.toPdf(startX, startY)
    ctx.page.drawText(watermark.text, {
      x: px,
      y: py,
      size: watermark.size,
      font,
      color: rgb(c.r, c.g, c.b),
      opacity: watermark.opacity,
      rotate: degrees(ctx.totalRotation - angle),
    })
  }

  if (pageNumbers?.template && inRange(pageNumbers.pages, index, total)) {
    const font = await ctx.embedFont(pageNumbers.font, pageNumbers.template)
    const text = fillTemplate(
      pageNumbers.template,
      index,
      total,
      fileName,
      pageNumbers.startAt,
    )
    const slot = numberSlot(
      pageNumbers.position,
      width,
      height,
      pageNumbers.margin,
      pageNumbers.size,
    )
    drawDisplayText(ctx, text, {
      x: slot.x,
      y: slot.y,
      width: slot.width,
      align: slot.align,
      size: pageNumbers.size,
      font,
      color: pageNumbers.color,
    })
  }

  for (const [band, atTop] of [
    [header, true],
    [footer, false],
  ] as [TextBand | undefined, boolean][]) {
    if (!band || !inRange(band.pages, index, total)) continue
    const parts: [string, 'left' | 'center' | 'right'][] = [
      [band.left, 'left'],
      [band.center, 'center'],
      [band.right, 'right'],
    ]
    if (!parts.some(([t]) => t?.trim())) continue
    const font = await ctx.embedFont(band.font, parts.map(([t]) => t).join(' '))
    const y = atTop ? band.margin : height - band.margin - band.size * 1.2
    for (const [template, align] of parts) {
      if (!template?.trim()) continue
      drawDisplayText(ctx, fillTemplate(template, index, total, fileName), {
        x: band.margin,
        y,
        width: width - band.margin * 2,
        align,
        size: band.size,
        font,
        color: band.color,
      })
    }
  }
}

function safeWidth(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size)
  } catch {
    return text.length * size * 0.5
  }
}

export const defaultFont: FontSpec = { family: 'Arimo', bold: false, italic: false }
export { BASELINE_RATIO }
