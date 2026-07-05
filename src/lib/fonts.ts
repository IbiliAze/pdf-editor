import { StandardFonts } from 'pdf-lib'
import type { FontFamily, FontSpec } from '../types'

interface VariantFiles {
  regular: string
  bold: string
  italic: string
  boldItalic: string
}

interface FamilyDef {
  /** css stack used for on-page preview (see @font-face in styles.css) */
  css: string
  /** built-in standard-14 fonts: [regular, bold, italic, boldItalic] */
  standard?: [StandardFonts, StandardFonts, StandardFonts, StandardFonts]
  /** TTFs served from public/fonts, embedded (subset) at export time */
  files?: VariantFiles
}

const files = (slug: string): VariantFiles => ({
  regular: `/fonts/${slug}-regular.ttf`,
  bold: `/fonts/${slug}-bold.ttf`,
  italic: `/fonts/${slug}-italic.ttf`,
  boldItalic: `/fonts/${slug}-bolditalic.ttf`,
})

export const FONT_FAMILIES: Record<FontFamily, FamilyDef> = {
  Helvetica: {
    css: 'Helvetica, Arial, sans-serif',
    standard: [
      StandardFonts.Helvetica,
      StandardFonts.HelveticaBold,
      StandardFonts.HelveticaOblique,
      StandardFonts.HelveticaBoldOblique,
    ],
  },
  Times: {
    css: '"Times New Roman", Times, serif',
    standard: [
      StandardFonts.TimesRoman,
      StandardFonts.TimesRomanBold,
      StandardFonts.TimesRomanItalic,
      StandardFonts.TimesRomanBoldItalic,
    ],
  },
  Courier: {
    css: '"Courier New", Courier, monospace',
    standard: [
      StandardFonts.Courier,
      StandardFonts.CourierBold,
      StandardFonts.CourierOblique,
      StandardFonts.CourierBoldOblique,
    ],
  },
  Roboto: { css: "'Roboto', sans-serif", files: files('roboto') },
  'Open Sans': { css: "'Open Sans', sans-serif", files: files('opensans') },
  Lato: { css: "'Lato', sans-serif", files: files('lato') },
  Montserrat: { css: "'Montserrat', sans-serif", files: files('montserrat') },
  Merriweather: { css: "'Merriweather', serif", files: files('merriweather') },
  'Playfair Display': { css: "'Playfair Display', serif", files: files('playfair') },
}

export const FAMILIES = Object.keys(FONT_FAMILIES) as FontFamily[]

// Map a PDF font name (e.g. "ABCDEF+TimesNewRomanPS-BoldItalicMT") plus the
// pdf.js css family hint ("serif" | "sans-serif" | "monospace") onto one of
// the standard families, so replacement text visually matches the original.
// Native text always maps to the standard three; the custom families are
// offered for user-added text and explicit overrides.
export function detectFont(rawName = '', familyHint = ''): FontSpec {
  const name = String(rawName).toLowerCase()
  const hint = String(familyHint).toLowerCase()
  let family: FontFamily = 'Helvetica'
  if (/courier|mono|consolas|menlo/.test(name) || /mono/.test(hint)) {
    family = 'Courier'
  } else if (
    /times|georgia|garamond|palatino|cambria|bookman|minion|charter|utopia|century|roman/.test(name) ||
    (/serif/.test(hint) && !/sans/.test(hint))
  ) {
    family = 'Times'
  }
  const bold = /bold|black|heavy|semibold|demibold|extrabold|ultra/.test(name)
  const italic = /italic|oblique/.test(name)
  return { family, bold, italic }
}

/** TTF url for the variant, or null when the family is a standard-14 font. */
export function fontFileFor(spec: Partial<FontSpec> = {}): string | null {
  const def = FONT_FAMILIES[spec.family ?? 'Helvetica']
  if (!def?.files) return null
  if (spec.bold && spec.italic) return def.files.boldItalic
  if (spec.bold) return def.files.bold
  if (spec.italic) return def.files.italic
  return def.files.regular
}

export function standardFontFor(spec: Partial<FontSpec> = {}): StandardFonts {
  const row = FONT_FAMILIES[spec.family ?? 'Helvetica']?.standard ?? FONT_FAMILIES.Helvetica.standard!
  return row[(spec.bold ? 1 : 0) + (spec.italic ? 2 : 0)]
}

export interface CssFont {
  fontFamily: string
  fontWeight: number
  fontStyle: 'italic' | 'normal'
}

export function cssFontFor(spec: Partial<FontSpec> = {}): CssFont {
  return {
    fontFamily: (FONT_FAMILIES[spec.family ?? 'Helvetica'] ?? FONT_FAMILIES.Helvetica).css,
    fontWeight: spec.bold ? 700 : 400,
    fontStyle: spec.italic ? 'italic' : 'normal',
  }
}

let measureCanvas: HTMLCanvasElement | null = null

/** Width in px of `text` rendered with the css approximation of `fontSpec`. */
export function measureText(text: string, fontSizePx: number, fontSpec: FontSpec): number {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return 0
  const css = cssFontFor(fontSpec)
  ctx.font = `${css.fontStyle} ${css.fontWeight} ${fontSizePx}px ${css.fontFamily}`
  return ctx.measureText(text).width
}
