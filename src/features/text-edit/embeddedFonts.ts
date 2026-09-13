import { registerExportPlugin } from '../../lib/export/buildPdf'
import type { ExportState } from '../../lib/export/buildPdf'

/**
 * Recover the font a PDF actually embedded, so replacement text can be drawn
 * in the original typeface instead of a lookalike.
 *
 * pdf.js rebuilds every embedded font as an OpenType file for the browser and
 * keeps the bytes on the font object once `fontExtraProperties` is on. Those
 * bytes are what gets re-embedded. Whether they can render a particular
 * replacement string is decided by the caller, because subset fonts only carry
 * the glyphs the document happened to use.
 */
interface PdfJsFont {
  name?: string
  data?: Uint8Array | ArrayBuffer
}

const cache = new Map<string, { bytes: Uint8Array; name: string } | null>()

export function parseFontKey(key: string): { docId: string; pageIndex: number; fontName: string } | null {
  const parts = key.split(':')
  if (parts.length < 3) return null
  const fontName = parts.slice(2).join(':')
  const pageIndex = Number(parts[1])
  if (!Number.isFinite(pageIndex)) return null
  return { docId: parts[0], pageIndex, fontName }
}

export async function lookupEmbeddedFont(
  state: ExportState,
  key: string,
): Promise<{ bytes: Uint8Array; name: string } | null> {
  if (cache.has(key)) return cache.get(key) ?? null
  let result: { bytes: Uint8Array; name: string } | null = null
  try {
    const parsed = parseFontKey(key)
    const src = parsed && state.sources[parsed.docId]
    if (parsed && src?.pdfjs) {
      const page = await src.pdfjs.getPage(parsed.pageIndex + 1)
      // Font objects only reach commonObjs while the operator list is built.
      await page.getOperatorList()
      const font = page.commonObjs.get(parsed.fontName) as PdfJsFont | null
      const data = font?.data
      if (data) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
        if (bytes.length > 64) result = { bytes, name: font?.name ?? parsed.fontName }
      }
    }
  } catch {
    // no usable bytes; the caller falls back to a matched family
  }
  cache.set(key, result)
  return result
}

/** Forget cached font bytes. Call when a document is closed. */
export const clearEmbeddedFontCache = (): void => cache.clear()

registerExportPlugin({ lookupEmbeddedFont })
