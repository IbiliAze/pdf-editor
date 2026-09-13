import type { PDFPageProxy } from './pdfjs'
import { detectFont } from './fonts'
import { clampInt, rgbToHex } from './colors'
import { DEG } from './geometry'
import type { FontSpec, Line, Rect, Span, TextBlock } from '../types'

/**
 * One pdf.js text item, kept in raw PDF text space so lines can be
 * re-projected whenever the page rotation changes.
 */
export interface RawItem {
  str: string
  /** raw PDF text-space transform [a,b,c,d,e,f] */
  transform: number[]
  /** advance length of the run in PDF user units */
  width: number
  /** font height in PDF user units */
  fontHeight: number
  /** ascent / descent as a fraction of the font height */
  ascent: number
  descent: number
  /** pdf.js font id, e.g. "g_d0_f1" */
  fontName: string
  /** the font's real name from the PDF, when resolvable */
  realName: string
  font: FontSpec
  hasEOL: boolean
}

interface PdfTextStyle {
  ascent?: number
  descent?: number
  fontFamily?: string
}

/**
 * Pull every text item off a page in raw PDF space.
 *
 * The operator list is built first on purpose: pdf.js only publishes font
 * objects to `page.commonObjs` while building it, so without this the real
 * font names (and the embedded font bytes) are not available. The operator
 * list is cached by pdf.js, so the later render does not repeat the work.
 */
export async function extractRawItems(page: PDFPageProxy): Promise<RawItem[]> {
  try {
    await page.getOperatorList()
  } catch {
    // Not fatal: we fall back to the css family hint for font matching.
  }
  const textContent = await page.getTextContent()
  const items: RawItem[] = []
  const nameCache = new Map<string, string>()

  for (const item of textContent.items) {
    if (!('str' in item)) continue
    if (!item.str.trim() || !item.width) continue
    // Vertical writing mode (CJK) is not supported by the cover-and-redraw
    // approach; those runs stay read-only.
    if ((item as { vertical?: boolean }).vertical) continue
    const fontHeight = item.height || Math.hypot(item.transform[2], item.transform[3])
    if (!fontHeight) continue

    const style: PdfTextStyle = textContent.styles?.[item.fontName] ?? {}
    let realName = nameCache.get(item.fontName) ?? ''
    if (!realName) {
      try {
        const fontData = page.commonObjs.get(item.fontName) as { name?: string } | null
        realName = fontData?.name ?? ''
      } catch {
        // font object not published; the css family hint still applies
      }
      nameCache.set(item.fontName, realName)
    }

    items.push({
      str: item.str,
      transform: item.transform.slice(),
      width: item.width,
      fontHeight,
      ascent: style.ascent && style.ascent > 0 ? style.ascent : 0.8,
      descent: Math.min(Math.abs(style.descent ?? 0.2), 0.5) || 0.2,
      fontName: item.fontName,
      realName,
      font: detectFont(realName, style.fontFamily),
      hasEOL: !!item.hasEOL,
    })
  }
  return items
}

interface Placed extends RawItem {
  /** position along the run's baseline, in the run's own frame */
  u: number
  /** perpendicular offset (baseline height), in the run's own frame */
  v: number
  angle: number
}

const norm360 = (d: number): number => ((d % 360) + 360) % 360

/** Multiply two PDF transform matrices (same as pdf.js Util.transform). */
function mulTransform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

/**
 * Project raw items into the display space of a page viewport and group them
 * into editable line runs. Geometry is expressed in each run's own frame,
 * which `angle` rotates into place around the run origin.
 */
export function projectLines(
  items: RawItem[],
  viewport: { transform: number[] },
  pageId: string,
): Line[] {
  const placed: Placed[] = []
  for (const it of items) {
    const tx = mulTransform(viewport.transform, it.transform)
    const h = Math.hypot(tx[2], tx[3])
    if (!h) continue
    // Display space is y-down, so atan2(b, a) is a clockwise angle, matching
    // the CSS rotate() used to place the hit target and inline editor.
    const angle = Math.atan2(tx[1], tx[0]) / DEG
    const a = angle * DEG
    const c = Math.cos(a)
    const s = Math.sin(a)
    placed.push({
      ...it,
      fontHeight: h,
      angle,
      u: tx[4] * c + tx[5] * s,
      v: -tx[4] * s + tx[5] * c,
    })
  }

  // Bucket by angle so a rotated stamp and the body text never merge.
  const buckets = new Map<number, Placed[]>()
  for (const p of placed) {
    const key = Math.round(norm360(p.angle))
    const near = [key, key - 1, key + 1].find((k) => buckets.has(norm360(k)))
    const bk = near != null ? norm360(near) : key
    const list = buckets.get(bk)
    if (list) list.push(p)
    else buckets.set(bk, [p])
  }

  const lines: Line[] = []
  let n = 0
  for (const bucket of buckets.values()) {
    for (const run of groupBucket(bucket)) {
      lines.push(finishRun(run, pageId, n++))
    }
  }
  lines.sort((a, b) => a.top - b.top || a.x - b.x)
  return lines
}

/** Split one angle bucket into baseline rows, then into runs within a row. */
function groupBucket(items: Placed[]): Placed[][] {
  const rows: { v: number; items: Placed[] }[] = []
  const sorted = items.slice().sort((a, b) => a.v - b.v || a.u - b.u)
  for (const it of sorted) {
    const tol = Math.max(2, it.fontHeight * 0.4)
    const row = rows.find((r) => Math.abs(r.v - it.v) <= tol)
    if (row) row.items.push(it)
    else rows.push({ v: it.v, items: [it] })
  }

  const runs: Placed[][] = []
  for (const row of rows) {
    row.items.sort((a, b) => a.u - b.u)
    let run: Placed[] = []
    const flush = () => {
      if (run.length) runs.push(run)
      run = []
    }
    for (const it of row.items) {
      if (!run.length) {
        run = [it]
        continue
      }
      const prev = run[run.length - 1]
      const gap = it.u - (prev.u + prev.width)
      const ref = Math.max(prev.fontHeight, it.fontHeight)
      const sizeJump = ref / Math.max(1, Math.min(prev.fontHeight, it.fontHeight))
      // Big horizontal gaps mean separate columns/fields; large size jumps mean
      // superscripts and the like. Both start a new editable run.
      if (prev.hasEOL || gap > ref * 1.4 || gap < -ref * 0.5 || sizeJump > 1.3) {
        flush()
        run = [it]
      } else {
        run.push(it)
      }
    }
    flush()
  }
  return runs
}

function finishRun(items: Placed[], pageId: string, n: number): Line {
  let text = ''
  const spans: Span[] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (i > 0) {
      const prev = items[i - 1]
      const gap = it.u - (prev.u + prev.width)
      if (gap > it.fontHeight * 0.19 && !text.endsWith(' ') && !it.str.startsWith(' ')) {
        text += ' '
        // the synthetic space belongs to the preceding span
        spans[spans.length - 1].str += ' '
      }
    }
    spans.push({
      str: it.str,
      x: it.u,
      width: it.width,
      pdfX: it.transform[4],
      pdfY: it.transform[5],
      fontName: it.fontName,
    })
    text += it.str
  }

  const dominant = items.reduce((a, b) => (b.width > a.width ? b : a))
  const first = items[0]
  const last = items[items.length - 1]
  const baseline = dominant.v
  const top = baseline - dominant.ascent * dominant.fontHeight
  const bottom = baseline + dominant.descent * dominant.fontHeight

  return {
    id: `${pageId}:${n}`,
    pageId,
    text,
    spans,
    x: first.u,
    width: last.u + last.width - first.u,
    top,
    height: bottom - top,
    baseline,
    fontHeight: dominant.fontHeight,
    angle: dominant.angle,
    font: dominant.font,
    fontName: dominant.fontName,
    pdfX: first.transform[4],
    pdfBaseline: first.transform[5],
    pdfAngle: Math.atan2(first.transform[1], first.transform[0]) / DEG,
  }
}

// ---------------------------------------------------------------------------
// display-space helpers for rotated runs
// ---------------------------------------------------------------------------

/** Map a point from a rotated run's own frame into page display space. */
export function framePoint(
  anchor: { angle: number },
  u: number,
  v: number,
): { x: number; y: number } {
  if (!anchor.angle) return { x: u, y: v }
  const a = anchor.angle * DEG
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: u * c - v * s, y: u * s + v * c }
}

/** Axis-aligned display-space bounding box of a run. */
export function lineBBox(line: Line): Rect {
  if (!line.angle) {
    return { x: line.x, y: line.top, w: line.width, h: line.height }
  }
  const pts = [
    framePoint(line, line.x, line.top),
    framePoint(line, line.x + line.width, line.top),
    framePoint(line, line.x, line.top + line.height),
    framePoint(line, line.x + line.width, line.top + line.height),
  ]
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  }
}

// ---------------------------------------------------------------------------
// paragraph blocks
// ---------------------------------------------------------------------------

/**
 * Group consecutive lines into paragraphs that can be re-flowed as a unit.
 * Lines must share an angle, sit within 1.6 line heights of each other, keep a
 * consistent font size, and line up on the left edge or on their centres.
 */
export function groupIntoBlocks(lines: Line[]): TextBlock[] {
  const byAngle = new Map<number, Line[]>()
  for (const l of lines) {
    const key = Math.round(norm360(l.angle))
    const list = byAngle.get(key)
    if (list) list.push(l)
    else byAngle.set(key, [l])
  }

  const blocks: TextBlock[] = []
  let n = 0
  for (const group of byAngle.values()) {
    const sorted = group.slice().sort((a, b) => a.baseline - b.baseline || a.x - b.x)
    let run: Line[] = []

    const flush = () => {
      if (run.length >= 2) blocks.push(makeBlock(run, n++))
      run = []
    }

    for (const line of sorted) {
      if (!run.length) {
        run = [line]
        continue
      }
      const prev = run[run.length - 1]
      const pitch = line.baseline - prev.baseline
      const ref = Math.max(prev.fontHeight, line.fontHeight)
      const sizeRatio = ref / Math.max(0.01, Math.min(prev.fontHeight, line.fontHeight))
      const leftAligned = Math.abs(line.x - run[0].x) < ref * 0.75
      const centreAligned =
        Math.abs(line.x + line.width / 2 - (run[0].x + run[0].width / 2)) < ref * 0.75
      const pitchOk = pitch > ref * 0.6 && pitch < ref * 2.4
      const pitchStable =
        run.length < 2 || Math.abs(pitch - (run[1].baseline - run[0].baseline)) < ref * 0.35

      if (pitchOk && pitchStable && sizeRatio < 1.15 && (leftAligned || centreAligned)) {
        run.push(line)
      } else {
        flush()
        run = [line]
      }
    }
    flush()
  }
  return blocks
}

function makeBlock(lines: Line[], n: number): TextBlock {
  const first = lines[0]
  const x = Math.min(...lines.map((l) => l.x))
  const right = Math.max(...lines.map((l) => l.x + l.width))
  const top = Math.min(...lines.map((l) => l.top))
  const bottom = Math.max(...lines.map((l) => l.top + l.height))
  const pitch =
    lines.length > 1
      ? (lines[lines.length - 1].baseline - first.baseline) / (lines.length - 1)
      : first.fontHeight * 1.2

  const centres = lines.map((l) => l.x + l.width / 2)
  const centreSpread = Math.max(...centres) - Math.min(...centres)
  const leftSpread = Math.max(...lines.map((l) => l.x)) - x
  const align: TextBlock['align'] =
    centreSpread < leftSpread * 0.5 && leftSpread > first.fontHeight * 0.5 ? 'center' : 'left'

  const id = `${first.pageId}:b${n}`
  for (const l of lines) l.blockId = id

  return {
    id,
    pageId: first.pageId,
    lineIds: lines.map((l) => l.id),
    x,
    top,
    width: right - x,
    height: bottom - top,
    pitch,
    fontHeight: first.fontHeight,
    font: first.font,
    align,
    angle: first.angle,
  }
}

// ---------------------------------------------------------------------------
// partial-run edits
// ---------------------------------------------------------------------------

export interface PartialEdit {
  /** number of leading characters kept as original glyphs */
  keep: number
  /** offset along the baseline where the cover (and redraw) starts */
  offset: number
}

/**
 * Work out how much of a run can be left untouched when only its tail changed.
 * Returns `keep: 0` when the whole run has to be redrawn.
 */
export function partialEdit(line: Line, next: string, restyled: boolean): PartialEdit {
  if (restyled || !line.spans.length) return { keep: 0, offset: 0 }

  const old = line.text
  let common = 0
  while (common < old.length && common < next.length && old[common] === next[common]) common++
  // Keeping only a sliver is not worth the seam it risks.
  if (common < 3 || common === old.length) return { keep: 0, offset: 0 }

  // Walk spans to find the last span boundary at or before the common prefix.
  let consumed = 0
  let keep = 0
  let offset = 0
  for (const span of line.spans) {
    const end = consumed + span.str.length
    if (end > common) break
    consumed = end
    keep = end
    offset = span.x + span.width - line.x
  }
  if (!keep) return { keep: 0, offset: 0 }
  // Back off a hair so no original glyph survives half-covered.
  return { keep, offset: Math.max(0, offset - 0.5) }
}

// ---------------------------------------------------------------------------
// colour sampling
// ---------------------------------------------------------------------------

export interface SampledColors {
  bg: string
  color: string
}

/**
 * Sample the rendered canvas around a rect to recover its background and text
 * colors, so the cover rectangle and replacement text blend in even on
 * non-white pages. `scale` is device pixels per scale-1 display unit.
 */
export function sampleRectColors(
  canvas: HTMLCanvasElement,
  rect: Rect,
  scale: number,
): SampledColors {
  const fallback: SampledColors = { bg: '#ffffff', color: '#111827' }
  try {
    if (!canvas || !canvas.width || !scale) return fallback
    const pad = Math.max(2, Math.round(2 * scale))
    const x0 = clampInt(Math.floor(rect.x * scale) - pad, 0, canvas.width - 1)
    const y0 = clampInt(Math.floor(rect.y * scale) - pad, 0, canvas.height - 1)
    const x1 = clampInt(Math.ceil((rect.x + rect.w) * scale) + pad, 0, canvas.width)
    const y1 = clampInt(Math.ceil((rect.y + rect.h) * scale) + pad, 0, canvas.height)
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
        const d = (data[i] - bg.r) ** 2 + (data[i + 1] - bg.g) ** 2 + (data[i + 2] - bg.b) ** 2
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

/** Convenience wrapper: sample the colours around one text run. */
export const sampleLineColors = (
  canvas: HTMLCanvasElement,
  line: Line,
  scale: number,
): SampledColors => sampleRectColors(canvas, lineBBox(line), scale)
