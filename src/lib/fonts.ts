import { StandardFonts } from 'pdf-lib'
import type { FontFamily, FontSpec } from '../types'

// Map a PDF font name (e.g. "ABCDEF+TimesNewRomanPS-BoldItalicMT") plus the
// pdf.js css family hint ("serif" | "sans-serif" | "monospace") onto one of
// the 14 standard fonts, so replacement text visually matches the original.
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

const TABLE: Record<FontFamily, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  Helvetica: [
    StandardFonts.Helvetica,
    StandardFonts.HelveticaBold,
    StandardFonts.HelveticaOblique,
    StandardFonts.HelveticaBoldOblique,
  ],
  Times: [
    StandardFonts.TimesRoman,
    StandardFonts.TimesRomanBold,
    StandardFonts.TimesRomanItalic,
    StandardFonts.TimesRomanBoldItalic,
  ],
  Courier: [
    StandardFonts.Courier,
    StandardFonts.CourierBold,
    StandardFonts.CourierOblique,
    StandardFonts.CourierBoldOblique,
  ],
}

export function standardFontFor(spec: Partial<FontSpec> = {}): StandardFonts {
  const row = TABLE[spec.family ?? 'Helvetica'] ?? TABLE.Helvetica
  return row[(spec.bold ? 1 : 0) + (spec.italic ? 2 : 0)]
}

const CSS_STACKS: Record<FontFamily, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  Times: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
}

export interface CssFont {
  fontFamily: string
  fontWeight: number
  fontStyle: 'italic' | 'normal'
}

export function cssFontFor(spec: Partial<FontSpec> = {}): CssFont {
  return {
    fontFamily: CSS_STACKS[spec.family ?? 'Helvetica'] ?? CSS_STACKS.Helvetica,
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
