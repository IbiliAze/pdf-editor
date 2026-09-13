import { StandardFonts } from 'pdf-lib'
import type { FontFamily, FontSpec } from '../types'

interface VariantFiles {
  regular: string
  bold: string
  italic: string
  boldItalic: string
}

interface FamilyDef {
  /** name shown in the font dropdown */
  label: string
  /** css stack used for on-page preview (see @font-face in styles.css) */
  css: string
  /** built-in standard-14 fonts: [regular, bold, italic, boldItalic] */
  standard?: [StandardFonts, StandardFonts, StandardFonts, StandardFonts]
  /** TTFs served from public/fonts, embedded (subset) at export time */
  files?: VariantFiles
  /** hidden from the dropdown (still selectable programmatically) */
  hidden?: boolean
}

const files = (slug: string): VariantFiles => ({
  regular: `/fonts/${slug}-regular.ttf`,
  bold: `/fonts/${slug}-bold.ttf`,
  italic: `/fonts/${slug}-italic.ttf`,
  boldItalic: `/fonts/${slug}-bolditalic.ttf`,
})

const single = (file: string): VariantFiles => ({
  regular: file,
  bold: file,
  italic: file,
  boldItalic: file,
})

export const FONT_FAMILIES: Record<FontFamily, FamilyDef> = {
  // Metric-compatible substitutes: same advance widths as the commercial
  // originals, so replacement text keeps the length of the run it covers.
  Arimo: { label: 'Arimo (Arial)', css: "'Arimo', Arial, Helvetica, sans-serif", files: files('arimo') },
  Tinos: { label: 'Tinos (Times)', css: "'Tinos', 'Times New Roman', serif", files: files('tinos') },
  Cousine: { label: 'Cousine (Courier)', css: "'Cousine', 'Courier New', monospace", files: files('cousine') },
  Carlito: { label: 'Carlito (Calibri)', css: "'Carlito', Calibri, sans-serif", files: files('carlito') },
  Caladea: { label: 'Caladea (Cambria)', css: "'Caladea', Cambria, serif", files: files('caladea') },

  // The standard 14. No embedding needed, but WinAnsi encoding only.
  Helvetica: {
    label: 'Helvetica',
    css: 'Helvetica, Arial, sans-serif',
    standard: [
      StandardFonts.Helvetica,
      StandardFonts.HelveticaBold,
      StandardFonts.HelveticaOblique,
      StandardFonts.HelveticaBoldOblique,
    ],
  },
  Times: {
    label: 'Times',
    css: '"Times New Roman", Times, serif',
    standard: [
      StandardFonts.TimesRoman,
      StandardFonts.TimesRomanBold,
      StandardFonts.TimesRomanItalic,
      StandardFonts.TimesRomanBoldItalic,
    ],
  },
  Courier: {
    label: 'Courier',
    css: '"Courier New", Courier, monospace',
    standard: [
      StandardFonts.Courier,
      StandardFonts.CourierBold,
      StandardFonts.CourierOblique,
      StandardFonts.CourierBoldOblique,
    ],
  },

  Roboto: { label: 'Roboto', css: "'Roboto', sans-serif", files: files('roboto') },
  'Open Sans': { label: 'Open Sans', css: "'Open Sans', sans-serif", files: files('opensans') },
  Lato: { label: 'Lato', css: "'Lato', sans-serif", files: files('lato') },
  Montserrat: { label: 'Montserrat', css: "'Montserrat', sans-serif", files: files('montserrat') },
  Merriweather: { label: 'Merriweather', css: "'Merriweather', serif", files: files('merriweather') },
  'Playfair Display': { label: 'Playfair Display', css: "'Playfair Display', serif", files: files('playfair') },
  'Great Vibes': {
    label: 'Great Vibes',
    css: "'Great Vibes', cursive",
    files: single('/fonts/greatvibes-regular.ttf'),
  },
}

export const FAMILIES = (Object.keys(FONT_FAMILIES) as FontFamily[]).filter(
  (f) => !FONT_FAMILIES[f].hidden,
)

export const familyLabel = (f: FontFamily): string => FONT_FAMILIES[f]?.label ?? f

/**
 * Map a PDF font name (e.g. "ABCDEF+TimesNewRomanPS-BoldItalicMT") plus the
 * pdf.js css family hint ("serif" | "sans-serif" | "monospace") onto a bundled
 * family, preferring one whose metrics match the original.
 */
const NAME_MAP: [RegExp, FontFamily][] = [
  [/calibri|carlito/, 'Carlito'],
  [/cambria|caladea/, 'Caladea'],
  [/courier|cousine|mono|consolas|menlo|inconsolata|lucidaconsole/, 'Cousine'],
  [/times|tinos|liberationserif|thorndale|nimbusroman|freeserif/, 'Tinos'],
  [/georgia|gelasio|garamond|palatino|bookman|minion|charter|utopia|century|book ?antiqua|cambria ?math/, 'Tinos'],
  [/arial|helvetica|arimo|liberationsans|albany|nimbussans|freesans|segoe|tahoma|verdana|geneva/, 'Arimo'],
  [/roboto/, 'Roboto'],
  [/opensans|open ?sans/, 'Open Sans'],
  [/lato/, 'Lato'],
  [/montserrat/, 'Montserrat'],
  [/merriweather/, 'Merriweather'],
  [/playfair/, 'Playfair Display'],
]

export function detectFont(rawName = '', familyHint = ''): FontSpec {
  const name = String(rawName).toLowerCase().replace(/^[a-z]{6}\+/i, '')
  const hint = String(familyHint).toLowerCase()

  let family: FontFamily | null = null
  for (const [re, fam] of NAME_MAP) {
    if (re.test(name)) {
      family = fam
      break
    }
  }
  if (!family) {
    if (/mono/.test(hint)) family = 'Cousine'
    else if (/serif/.test(hint) && !/sans/.test(hint)) family = 'Tinos'
    else family = 'Arimo'
  }

  // "semibold"/"demibold" read as bold; "light"/"thin" never do. Order matters
  // because many names contain both a weight word and "italic".
  const bold = /bold|black|heavy|semibold|demibold|extrabold|ultra|\bbd\b/.test(name) && !/semibolditalicdisabled/.test(name)
  const italic = /italic|oblique|\bit\b/.test(name)
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
  if (typeof document === 'undefined') return text.length * fontSizePx * 0.5
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return 0
  const css = cssFontFor(fontSpec)
  ctx.font = `${css.fontStyle} ${css.fontWeight} ${fontSizePx}px ${css.fontFamily}`
  return ctx.measureText(text).width
}
