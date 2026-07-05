import { BlendMode, LineCapStyle, PDFDocument, PDFFont, degrees, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { fontFileFor, standardFontFor } from './fonts'
import { hexToRgb01 } from './colors'
import { HIGHLIGHT_COLOR } from '../constants'
import type { PDFDocumentProxy, PageViewport } from './pdfjs'
import type { EditorElement, FontSpec, Line } from '../types'

const colorOf = (hex: string) => {
  const c = hexToRgb01(hex)
  return rgb(c.r, c.g, c.b)
}

// The 14 standard fonts only cover WinAnsi. Map lookalikes onto encodable
// characters and drop anything the font still cannot encode.
const REPLACEMENTS: Record<string, string> = {
  '­': '-', // soft hyphen
  '‐': '-', // hyphen
  '‑': '-', // non-breaking hyphen
  '−': '-', // minus sign
  'ʼ': "'", // modifier apostrophe
  '′': "'", // prime
  '″': '"', // double prime
  'ﬁ': 'fi',
  'ﬂ': 'fl',
  ' ': ' ', // non-breaking space
  ' ': '\n', // line separator
  ' ': '\n', // paragraph separator
}

export function sanitizeForFont(text: string, font: PDFFont): string {
  let out = ''
  for (const ch of String(text)) {
    const mapped = REPLACEMENTS[ch] ?? ch
    if (mapped === '\n') {
      out += '\n'
      continue
    }
    try {
      font.widthOfTextAtSize(mapped, 10)
      out += mapped
    } catch {
      // not encodable in WinAnsi; drop it
    }
  }
  return out
}

export interface BuildEditedPdfArgs {
  bytes: ArrayBuffer
  pdfjsDoc: PDFDocumentProxy
  elements: EditorElement[]
  linesById: Record<string, Line>
}

/**
 * Build the edited PDF: every element is drawn onto the original document.
 * Native text edits cover the original run with its sampled background
 * color and draw the replacement at the run's exact PDF baseline.
 */
export async function buildEditedPdf({
  bytes,
  pdfjsDoc,
  elements,
  linesById,
}: BuildEditedPdfArgs): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  doc.registerFontkit(fontkit)
  const pdfPages = doc.getPages()

  const fontCache = new Map<string, PDFFont>()
  const embed = async (spec: FontSpec | undefined): Promise<PDFFont> => {
    const key = `${spec?.family}-${spec?.bold}-${spec?.italic}`
    let font = fontCache.get(key)
    if (!font) {
      const file = fontFileFor(spec ?? {})
      if (file) {
        // custom family: fetch the TTF and embed a subset of it
        const fontBytes = await fetch(file).then((r) => {
          if (!r.ok) throw new Error(`Could not load font ${file}`)
          return r.arrayBuffer()
        })
        font = await doc.embedFont(fontBytes, { subset: true })
      } else {
        font = await doc.embedFont(standardFontFor(spec ?? {}))
      }
      fontCache.set(key, font)
    }
    return font
  }

  const vpCache = new Map<number, PageViewport>()
  const viewportOf = async (i: number): Promise<PageViewport> => {
    let vp = vpCache.get(i)
    if (!vp) {
      vp = (await pdfjsDoc.getPage(i + 1)).getViewport({ scale: 1 })
      vpCache.set(i, vp)
    }
    return vp
  }

  for (const el of elements) {
    const page = pdfPages[el.pageIndex]
    if (!page) continue
    const vp = await viewportOf(el.pageIndex)
    const toPdf = (x: number, y: number) => vp.convertToPdfPoint(x, y)
    const rectToPdf = (x: number, y: number, w: number, h: number) => {
      const [ax, ay] = toPdf(x, y)
      const [bx, by] = toPdf(x + w, y + h)
      return {
        x: Math.min(ax, bx),
        y: Math.min(ay, by),
        width: Math.abs(ax - bx),
        height: Math.abs(ay - by),
      }
    }
    const rot = (((vp.rotation || 0) % 360) + 360) % 360

    if (el.type === 'edit') {
      const line = linesById[el.lineId]
      if (!line) continue
      const font = await embed(el.font ?? line.font)
      const size = el.size ?? line.fontHeight
      const text = sanitizeForFont(el.text, font)
      const drawnW = text ? font.widthOfTextAtSize(text, size) : 0
      const coverW = Math.max(line.width, drawnW) + 2
      page.drawRectangle({
        ...rectToPdf(line.x - 1, line.top - 1, coverW, line.height + 2),
        color: colorOf(el.bg),
      })
      if (text) {
        page.drawText(text, {
          x: line.pdfX,
          y: line.pdfBaseline,
          size,
          font,
          color: colorOf(el.color),
        })
      }
    } else if (el.type === 'text') {
      const font = await embed(el.font)
      const text = sanitizeForFont(el.text, font)
      if (!text.trim()) continue
      const [px, py] = toPdf(el.x, el.y)
      page.drawText(text, {
        x: px,
        y: py - el.size * 0.8,
        size: el.size,
        font,
        color: colorOf(el.color),
        lineHeight: el.size * 1.25,
        rotate: degrees(rot),
      })
    } else if (el.type === 'whiteout') {
      page.drawRectangle({
        ...rectToPdf(el.x, el.y, el.w, el.h),
        color: rgb(1, 1, 1),
      })
    } else if (el.type === 'highlight') {
      page.drawRectangle({
        ...rectToPdf(el.x, el.y, el.w, el.h),
        color: colorOf(el.color || HIGHLIGHT_COLOR),
        opacity: 0.45,
        blendMode: BlendMode.Multiply,
      })
    } else if (el.type === 'path') {
      for (let i = 1; i < el.points.length; i++) {
        const [ax, ay] = toPdf(el.points[i - 1].x, el.points[i - 1].y)
        const [bx, by] = toPdf(el.points[i].x, el.points[i].y)
        page.drawLine({
          start: { x: ax, y: ay },
          end: { x: bx, y: by },
          thickness: el.width,
          color: colorOf(el.color),
          lineCap: LineCapStyle.Round,
        })
      }
    }
  }

  return doc.save()
}
