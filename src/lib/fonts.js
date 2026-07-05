import { StandardFonts } from 'pdf-lib'

// Map a PDF font name (e.g. "ABCDEF+TimesNewRomanPS-BoldItalicMT") plus the
// pdf.js css family hint ("serif" | "sans-serif" | "monospace") onto one of
// the 14 standard fonts, so replacement text visually matches the original.
export function detectFont(rawName = '', familyHint = '') {
  const name = String(rawName).toLowerCase()
  const hint = String(familyHint).toLowerCase()
  let family = 'Helvetica'
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

const TABLE = {
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

export function standardFontFor({ family, bold, italic } = {}) {
  const row = TABLE[family] || TABLE.Helvetica
  return row[(bold ? 1 : 0) + (italic ? 2 : 0)]
}

const CSS_STACKS = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  Times: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
}

export function cssFontFor({ family, bold, italic } = {}) {
  return {
    fontFamily: CSS_STACKS[family] || CSS_STACKS.Helvetica,
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? 'italic' : 'normal',
  }
}

let measureCanvas = null

export function measureText(text, fontSizePx, fontSpec) {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  const css = cssFontFor(fontSpec)
  ctx.font = `${css.fontStyle} ${css.fontWeight} ${fontSizePx}px ${css.fontFamily}`
  return ctx.measureText(text).width
}
