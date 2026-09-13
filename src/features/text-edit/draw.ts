import { degrees, rgb } from 'pdf-lib'
import type { PDFFont } from 'pdf-lib'
import { hexToRgb01 } from '../../lib/colors'
import { DEG } from '../../lib/geometry'
import { sanitizeForFont } from '../../lib/export/fonts'
import type { ExportCtx, Line, TextBlock } from '../../types'
import type { BlockEditElement, EditElement } from './types'

const colorOf = (hex: string) => {
  const c = hexToRgb01(hex)
  return rgb(c.r, c.g, c.b)
}

/** Unit vectors of a run's text frame in PDF space (y-up). */
function frameVectors(angleDeg: number) {
  const a = angleDeg * DEG
  const c = Math.cos(a)
  const s = Math.sin(a)
  // along the baseline, and "up" from the baseline
  return { bx: c, by: s, ux: -s, uy: c }
}

/** Identifies the source font of a run so its bytes can be reused. */
export function fontKeyOf(ctx: ExportCtx, line: Line): string | undefined {
  const src = ctx.modelPage.source
  if (src.kind !== 'pdf' || !line.fontName) return undefined
  return `${src.docId}:${src.pageIndex}:${line.fontName}`
}

const COVER_PAD = 0.6

/** Cover an original run from `du` onwards and draw `text` in its place. */
function coverAndDraw(
  ctx: ExportCtx,
  line: Line,
  opts: {
    du: number
    text: string
    font: PDFFont
    size: number
    bg: string
    color: string
    /** minimum length of the covered stretch along the baseline */
    minCover: number
    /** extra rows of cover below the run (re-flowed paragraphs) */
  },
): void {
  const { bx, by, ux, uy } = frameVectors(line.pdfAngle)
  const above = line.baseline - line.top
  const below = line.top + line.height - line.baseline
  const drawn = opts.text ? opts.font.widthOfTextAtSize(opts.text, opts.size) : 0
  const coverLen = Math.max(opts.minCover, drawn) + COVER_PAD * 2

  const startX = line.pdfX + opts.du * bx
  const startY = line.pdfBaseline + opts.du * by
  const cornerX = startX - COVER_PAD * bx - (below + COVER_PAD) * ux
  const cornerY = startY - COVER_PAD * by - (below + COVER_PAD) * uy

  ctx.page.drawRectangle({
    x: cornerX,
    y: cornerY,
    width: coverLen,
    height: above + below + COVER_PAD * 2,
    rotate: degrees(line.pdfAngle),
    color: colorOf(opts.bg),
  })

  if (opts.text) {
    ctx.page.drawText(opts.text, {
      x: startX,
      y: startY,
      size: opts.size,
      font: opts.font,
      color: colorOf(opts.color),
      lineHeight: opts.size * 1.15,
      rotate: degrees(line.pdfAngle),
    })
  }
}

export async function drawEdit(el: EditElement, ctx: ExportCtx): Promise<void> {
  const line = ctx.linesById[el.lineId]
  if (!line) return
  const spec = el.font ?? line.font
  const size = el.size ?? line.fontHeight
  const tail = el.text.slice(el.keep ?? 0)
  const restyled = !!el.font || el.size != null || (!!el.baseColor && el.color !== el.baseColor)
  const font = await ctx.embedFont(spec, tail, restyled ? undefined : fontKeyOf(ctx, line))
  const text = sanitizeForFont(tail, font)
  const du = el.coverOffset ?? 0

  coverAndDraw(ctx, line, {
    du,
    text,
    font,
    size,
    bg: el.bg,
    color: el.color,
    minCover: Math.max(0, line.width - du),
  })
}

/** Greedy word wrap against a width, measured with the real embedded font. */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      out.push('')
      continue
    }
    const words = para.split(/(\s+)/).filter((w) => w !== '')
    let current = ''
    for (const word of words) {
      const candidate = current + word
      const w = safeWidth(font, candidate.trimEnd(), size)
      if (w > maxWidth && current.trim()) {
        out.push(current.trimEnd())
        current = word.trimStart()
      } else {
        current = candidate
      }
    }
    if (current.trim() || !out.length) out.push(current.trimEnd())
  }
  return out
}

function safeWidth(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size)
  } catch {
    return text.length * size * 0.5
  }
}

export async function drawBlockEdit(el: BlockEditElement, ctx: ExportCtx): Promise<void> {
  const block = ctx.blocksById[el.blockId]
  if (!block) return
  const lines = block.lineIds.map((id) => ctx.linesById[id]).filter(Boolean) as Line[]
  if (!lines.length) return

  const first = lines[0]
  const spec = el.font ?? block.font
  const size = el.size ?? block.fontHeight
  const pitch = el.pitch ?? block.pitch
  const restyled = !!el.font || el.size != null || (!!el.baseColor && el.color !== el.baseColor)
  const font = await ctx.embedFont(spec, el.text, restyled ? undefined : fontKeyOf(ctx, first))

  const wrapped = wrapText(sanitizeForFont(el.text, font), font, size, block.width)

  // Cover every original line where it sits.
  for (const line of lines) {
    coverAndDraw(ctx, line, {
      du: 0,
      text: '',
      font,
      size,
      bg: el.bg,
      color: el.color,
      minCover: line.width,
    })
  }
  // Re-flowed text can need more rows than the original had; cover those too.
  coverOverflow(ctx, block, lines, wrapped.length, el.bg, size)

  const { bx, by, ux, uy } = frameVectors(first.pdfAngle)
  for (let i = 0; i < wrapped.length; i++) {
    const text = wrapped[i]
    if (!text) continue
    const w = safeWidth(font, text, size)
    let du = 0
    if (block.align === 'center') du = (block.width - w) / 2
    else if (block.align === 'right') du = block.width - w
    const dv = -i * pitch
    ctx.page.drawText(text, {
      x: first.pdfX + du * bx + dv * ux,
      y: first.pdfBaseline + du * by + dv * uy,
      size,
      font,
      color: colorOf(el.color),
      rotate: degrees(first.pdfAngle),
    })
  }
}

/** Paint the background over rows the re-flowed paragraph spills onto. */
function coverOverflow(
  ctx: ExportCtx,
  block: TextBlock,
  lines: Line[],
  rows: number,
  bg: string,
  size: number,
): void {
  if (rows <= lines.length) return
  const first = lines[0]
  const { bx, by, ux, uy } = frameVectors(first.pdfAngle)
  const above = first.baseline - first.top
  const below = first.top + first.height - first.baseline
  const pitch = block.pitch
  for (let i = lines.length; i < rows; i++) {
    const dv = -i * pitch
    const baseX = first.pdfX + dv * ux
    const baseY = first.pdfBaseline + dv * uy
    ctx.page.drawRectangle({
      x: baseX - COVER_PAD * bx - (below + COVER_PAD) * ux,
      y: baseY - COVER_PAD * by - (below + COVER_PAD) * uy,
      width: Math.max(block.width, size) + COVER_PAD * 2,
      height: above + below + COVER_PAD * 2,
      rotate: degrees(first.pdfAngle),
      color: colorOf(bg),
    })
  }
}
