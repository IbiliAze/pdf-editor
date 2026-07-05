import { pdfjsLib } from './pdfjs'
import type { PDFPageProxy } from './pdfjs'
import { detectFont } from './fonts'
import { clampInt, rgbToHex } from './colors'
import type { FontSpec, Line } from '../types'

interface RawItem {
  str: string
  x: number
  baseline: number
  width: number
  fontHeight: number
  ascent: number
  descent: number
  font: FontSpec
  pdfX: number
  pdfBaseline: number
}

interface PdfTextStyle {
  ascent?: number
  descent?: number
  fontFamily?: string
}

/**
 * Extract the text of a page as editable line runs. All geometry is in
 * scale-1 viewport units (CSS px at 100% zoom == PDF points), except
 * pdfX/pdfBaseline which are the raw PDF text-space origin of the run and
 * are used at export time so replacement text lands exactly on the
 * original baseline.
 */
export async function extractPageLines(page: PDFPageProxy, pageIndex: number): Promise<Line[]> {
  const viewport = page.getViewport({ scale: 1 })
  const textContent = await page.getTextContent()
  const items: RawItem[] = []

  for (const item of textContent.items) {
    if (!('str' in item)) continue
    if (!item.str.trim() || !item.width) continue
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
    const fontHeight = Math.hypot(tx[2], tx[3])
    if (!fontHeight) continue
    // Skip text that is not horizontal in display space; covering and
    // re-drawing it from a horizontal bounding box would be wrong.
    if (Math.abs(tx[1]) > fontHeight * 0.05) continue

    const style: PdfTextStyle = textContent.styles?.[item.fontName] ?? {}
    let realName = ''
    try {
      const fontData = page.commonObjs.get(item.fontName) as { name?: string } | null
      realName = fontData?.name ?? ''
    } catch {
      // font data not resolved yet; the css family hint still applies
    }

    items.push({
      str: item.str,
      x: tx[4],
      baseline: tx[5],
      width: item.width,
      fontHeight,
      ascent: style.ascent && style.ascent > 0 ? style.ascent : 0.8,
      descent: Math.min(Math.abs(style.descent ?? 0.2), 0.5) || 0.2,
      font: detectFont(realName, style.fontFamily),
      pdfX: item.transform[4],
      pdfBaseline: item.transform[5],
    })
  }

  return groupIntoLines(items, pageIndex)
}

function groupIntoLines(items: RawItem[], pageIndex: number): Line[] {
  const rows: { baseline: number; items: RawItem[] }[] = []
  const sorted = items.slice().sort((a, b) => a.baseline - b.baseline || a.x - b.x)
  for (const it of sorted) {
    const tol = Math.max(2, it.fontHeight * 0.4)
    const row = rows.find((r) => Math.abs(r.baseline - it.baseline) <= tol)
    if (row) row.items.push(it)
    else rows.push({ baseline: it.baseline, items: [it] })
  }

  const lines: Line[] = []
  let n = 0
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x)
    let run: RawItem[] | null = null
    const flush = () => {
      if (run) lines.push(finishRun(run, pageIndex, n++))
      run = null
    }
    for (const it of row.items) {
      if (!run) {
        run = [it]
        continue
      }
      const prev = run[run.length - 1]
      const gap = it.x - (prev.x + prev.width)
      const ref = Math.max(prev.fontHeight, it.fontHeight)
      const sizeJump = ref / Math.max(1, Math.min(prev.fontHeight, it.fontHeight))
      // Big horizontal gaps mean separate columns/fields; large size jumps
      // mean superscripts etc. Both start a new editable run.
      if (gap > ref * 1.4 || gap < -ref * 0.5 || sizeJump > 1.3) {
        flush()
        run = [it]
      } else {
        run.push(it)
      }
    }
    flush()
  }
  return lines
}

function finishRun(items: RawItem[], pageIndex: number, n: number): Line {
  let text = ''
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (i > 0) {
      const prev = items[i - 1]
      const gap = it.x - (prev.x + prev.width)
      if (gap > it.fontHeight * 0.19 && !text.endsWith(' ') && !it.str.startsWith(' ')) {
        text += ' '
      }
    }
    text += it.str
  }

  const dominant = items.reduce((a, b) => (b.width > a.width ? b : a))
  const first = items[0]
  const last = items[items.length - 1]
  const top = dominant.baseline - dominant.ascent * dominant.fontHeight
  const bottom = dominant.baseline + dominant.descent * dominant.fontHeight

  return {
    id: `l-${pageIndex}-${n}`,
    pageIndex,
    text,
    x: first.x,
    width: last.x + last.width - first.x,
    top,
    height: bottom - top,
    baseline: dominant.baseline,
    fontHeight: dominant.fontHeight,
    font: dominant.font,
    pdfX: first.pdfX,
    pdfBaseline: first.pdfBaseline,
  }
}

export interface SampledColors {
  bg: string
  color: string
}

/**
 * Sample the rendered canvas around a line to recover its background and
 * text colors, so the cover rectangle and replacement text blend in even on
 * non-white pages. `scale` is device pixels per scale-1 viewport unit.
 */
export function sampleLineColors(
  canvas: HTMLCanvasElement,
  line: Line,
  scale: number,
): SampledColors {
  const fallback: SampledColors = { bg: '#ffffff', color: '#111827' }
  try {
    if (!canvas || !canvas.width || !scale) return fallback
    const pad = Math.max(2, Math.round(2 * scale))
    const x0 = clampInt(Math.floor(line.x * scale) - pad, 0, canvas.width - 1)
    const y0 = clampInt(Math.floor(line.top * scale) - pad, 0, canvas.height - 1)
    const x1 = clampInt(Math.ceil((line.x + line.width) * scale) + pad, 0, canvas.width)
    const y1 = clampInt(Math.ceil((line.top + line.height) * scale) + pad, 0, canvas.height)
    const w = x1 - x0
    const h = y1 - y0
    if (w < 3 || h < 3) return fallback
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return fallback
    const data = ctx.getImageData(x0, y0, w, h).data

    // Background: the dominant color along the border of the padded box.
    const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
    const addBorder = (px: number, py: number) => {
      const i = (py * w + px) * 4
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
      e.n++
      e.r += data[i]
      e.g += data[i + 1]
      e.b += data[i + 2]
      buckets.set(key, e)
    }
    for (let px = 0; px < w; px++) {
      addBorder(px, 0)
      addBorder(px, h - 1)
    }
    for (let py = 0; py < h; py++) {
      addBorder(0, py)
      addBorder(w - 1, py)
    }
    let bg = { r: 255, g: 255, b: 255 }
    let best = 0
    for (const e of buckets.values()) {
      if (e.n > best) {
        best = e.n
        bg = { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }
      }
    }
    const bgHex = rgbToHex(bg)

    // Text color: average of the pixels farthest from the background.
    const step = Math.max(1, Math.round(Math.sqrt((w * h) / 40000)))
    let maxD = 0
    const samples: [number, number][] = []
    for (let yy = 0; yy < h; yy += step) {
      for (let xx = 0; xx < w; xx += step) {
        const i = (yy * w + xx) * 4
        const d =
          (data[i] - bg.r) ** 2 + (data[i + 1] - bg.g) ** 2 + (data[i + 2] - bg.b) ** 2
        if (d > maxD) maxD = d
        samples.push([d, i])
      }
    }
    if (maxD < 3200) return { bg: bgHex, color: '#111827' }
    const thr = maxD * 0.6
    let cn = 0
    let cr = 0
    let cg = 0
    let cb = 0
    for (const [d, i] of samples) {
      if (d >= thr) {
        cn++
        cr += data[i]
        cg += data[i + 1]
        cb += data[i + 2]
      }
    }
    if (!cn) return { bg: bgHex, color: '#111827' }
    return { bg: bgHex, color: rgbToHex({ r: cr / cn, g: cg / cn, b: cb / cn }) }
  } catch {
    return fallback
  }
}
