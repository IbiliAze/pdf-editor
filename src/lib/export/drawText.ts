import { degrees, rgb } from 'pdf-lib'
import type { PDFFont } from 'pdf-lib'
import { hexToRgb01 } from '../colors'
import { sanitizeForFont } from './fonts'
import type { ExportCtx } from '../../types'

export interface DisplayTextOptions {
  /** top-left corner of the text box in page display units */
  x: number
  y: number
  /** column width, used for centre/right alignment and wrapping */
  width?: number
  size: number
  font: PDFFont
  color: string
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  opacity?: number
}

/** Baseline offset from the top of a line box, as a fraction of the size. */
export const BASELINE_RATIO = 0.8

const widthOf = (font: PDFFont, text: string, size: number): number => {
  try {
    return font.widthOfTextAtSize(text, size)
  } catch {
    return text.length * size * 0.5
  }
}

/**
 * Draw text positioned in page *display* space, one line at a time, so page
 * rotation is honoured for every line rather than only the first.
 */
export function drawDisplayText(ctx: ExportCtx, text: string, o: DisplayTextOptions): void {
  const clean = sanitizeForFont(text, o.font)
  if (!clean) return
  const lineHeight = o.lineHeight ?? o.size * 1.25
  const c = hexToRgb01(o.color)
  const lines = clean.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]
    if (!lineText) continue
    let dx = 0
    if (o.width && o.align && o.align !== 'left') {
      const w = widthOf(o.font, lineText, o.size)
      dx = o.align === 'center' ? (o.width - w) / 2 : o.width - w
    }
    const baselineY = o.y + i * lineHeight + o.size * BASELINE_RATIO
    const [px, py] = ctx.toPdf(o.x + dx, baselineY)
    ctx.page.drawText(lineText, {
      x: px,
      y: py,
      size: o.size,
      font: o.font,
      color: rgb(c.r, c.g, c.b),
      rotate: degrees(ctx.totalRotation),
      ...(o.opacity != null ? { opacity: o.opacity } : {}),
    })
  }
}

/** Greedy wrap of display-space text to a column width. */
export function wrapToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/).filter((w) => w !== '')
    let current = ''
    for (const word of words) {
      const candidate = current + word
      if (widthOf(font, candidate.trimEnd(), size) > maxWidth && current.trim()) {
        out.push(current.trimEnd())
        current = word.trimStart()
      } else {
        current = candidate
      }
    }
    out.push(current.trimEnd())
  }
  return out.join('\n')
}
