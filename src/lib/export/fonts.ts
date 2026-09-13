import type { PDFDocument, PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { fontFileFor, standardFontFor } from '../fonts'
import type { FontSpec } from '../../types'

// The 14 standard fonts only cover WinAnsi. Map lookalikes onto encodable
// characters and drop anything the font still cannot encode.
const REPLACEMENTS: Record<string, string> = {
  '­': '-', // soft hyphen
  '‐': '-', // hyphen
  '‑': '-', // non-breaking hyphen
  '‒': '-', // figure dash
  '–': '-', // en dash
  '—': '-', // em dash
  '−': '-', // minus sign
  'ʼ': "'", // modifier apostrophe
  '′': "'", // prime
  '″': '"', // double prime
  'ﬀ': 'ff',
  'ﬁ': 'fi',
  'ﬂ': 'fl',
  'ﬃ': 'ffi',
  'ﬄ': 'ffl',
  ' ': ' ', // non-breaking space
  ' ': ' ', // figure space
  ' ': ' ', // narrow no-break space
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
      // not encodable in this font; drop it
    }
  }
  return out
}

/** Bytes of the font a PDF actually embedded, as recovered from pdf.js. */
export interface EmbeddedFont {
  bytes: Uint8Array
  name: string
}

export type EmbeddedFontLookup = (fontKey: string) => Promise<EmbeddedFont | null>

/**
 * True when the original embedded font can safely render `sample`.
 *
 * Subset fonts only carry the glyphs the document used, and fonts pdf.js
 * rebuilt from a CID font can have a synthetic cmap, so coverage is checked
 * character by character. Spaces are checked like any other character: a PDF
 * often positions words with text-space offsets instead of a space glyph, and
 * a font without one draws .notdef boxes between every word.
 */
export function fontUsable(bytes: Uint8Array, sample: string): boolean {
  if (!bytes?.length) return false
  try {
    const font = fontkit.create(bytes)
    if (!font || !font.numGlyphs) return false
    for (const ch of sample) {
      const cp = ch.codePointAt(0)
      if (cp == null) continue
      // newlines are drawn as line breaks, never as glyphs
      if (cp === 10 || cp === 13) continue
      if (!font.hasGlyphForCodePoint(cp)) return false
    }
    return true
  } catch {
    return false
  }
}

export interface FontResolverOptions {
  /** looks up the bytes a source PDF embedded for a pdf.js font id */
  lookupEmbedded?: EmbeddedFontLookup
  /** disable reusing original embedded fonts */
  noEmbeddedReuse?: boolean
}

export interface FontResolver {
  /**
   * Embed a font for a run.
   * @param spec  matched family/bold/italic, used for the fallback
   * @param sample text that has to be encodable
   * @param fontKey identifies the original embedded font to try first
   */
  embed: (spec: FontSpec, sample?: string, fontKey?: string) => Promise<PDFFont>
}

/** Embeds fonts into one output document, caching by family and by source font. */
export function createFontResolver(
  out: PDFDocument,
  opts: FontResolverOptions = {},
): FontResolver {
  const byFamily = new Map<string, PDFFont>()
  const byKey = new Map<string, PDFFont | null>()
  const fileCache = new Map<string, ArrayBuffer>()

  const embedFallback = async (spec: FontSpec): Promise<PDFFont> => {
    const key = `${spec.family}-${spec.bold}-${spec.italic}`
    const cached = byFamily.get(key)
    if (cached) return cached
    const file = fontFileFor(spec)
    let font: PDFFont
    if (file) {
      let bytes = fileCache.get(file)
      if (!bytes) {
        const res = await fetch(file)
        if (!res.ok) throw new Error(`Could not load font ${file}`)
        bytes = await res.arrayBuffer()
        fileCache.set(file, bytes)
      }
      font = await out.embedFont(bytes, { subset: true })
    } else {
      font = await out.embedFont(standardFontFor(spec))
    }
    byFamily.set(key, font)
    return font
  }

  return {
    embed: async (spec, sample, fontKey) => {
      if (fontKey && sample && !opts.noEmbeddedReuse && opts.lookupEmbedded) {
        if (byKey.has(fontKey)) {
          const cached = byKey.get(fontKey)
          // A cached font is only reusable when it can encode this sample too.
          if (cached) {
            try {
              cached.widthOfTextAtSize(sample, 10)
              return cached
            } catch {
              // fall through to the family fallback
            }
          }
        } else {
          let font: PDFFont | null = null
          try {
            const embedded = await opts.lookupEmbedded(fontKey)
            if (embedded && fontUsable(embedded.bytes, sample)) {
              font = await out.embedFont(embedded.bytes, { subset: true })
            }
          } catch {
            font = null
          }
          byKey.set(fontKey, font)
          if (font) return font
        }
      }
      return embedFallback(spec)
    },
  }
}
