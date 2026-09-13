import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { fontUsable, sanitizeForFont } from '../export/fonts'

const read = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../../public/fonts/${name}`, import.meta.url)))

describe('fontUsable', () => {
  const arimo = read('arimo-regular.ttf')

  it('accepts a full font for ordinary text', () => {
    expect(fontUsable(arimo, 'Hello world')).toBe(true)
  })

  it('requires a glyph for the space, not just the letters', () => {
    // A font that can draw the letters but not the space would render
    // .notdef boxes between words, so it must be rejected.
    expect(fontUsable(arimo, 'Hello world')).toBe(true)
    expect(fontUsable(arimo, 'Καλημέρα')).toBe(true)
    // Han characters are outside these Latin faces.
    expect(fontUsable(arimo, '日本語')).toBe(false)
  })

  it('ignores newlines, which are drawn as line breaks', () => {
    expect(fontUsable(arimo, 'one\ntwo')).toBe(true)
  })

  it('rejects empty or unparseable bytes', () => {
    expect(fontUsable(new Uint8Array(), 'x')).toBe(false)
    expect(fontUsable(new Uint8Array([1, 2, 3, 4]), 'x')).toBe(false)
  })

  it('can parse every bundled family', () => {
    for (const name of ['tinos-regular.ttf', 'cousine-bold.ttf', 'carlito-italic.ttf', 'caladea-regular.ttf', 'greatvibes-regular.ttf']) {
      expect(fontkit.create(read(name)).numGlyphs).toBeGreaterThan(0)
    }
  })
})

describe('sanitizeForFont', () => {
  it('maps characters WinAnsi cannot encode onto lookalikes', async () => {
    const doc = await PDFDocument.create()
    const helv = await doc.embedFont(StandardFonts.Helvetica)
    expect(sanitizeForFont('one–two', helv)).toBe('one-two')
    expect(sanitizeForFont('ﬁne', helv)).toBe('fine')
    expect(sanitizeForFont('a b', helv)).toBe('a b')
  })

  it('drops what it still cannot encode rather than failing the export', async () => {
    const doc = await PDFDocument.create()
    const helv = await doc.embedFont(StandardFonts.Helvetica)
    expect(sanitizeForFont('price 日本', helv)).toBe('price ')
  })

  it('keeps everything for a font with wide coverage', async () => {
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)
    const font = await doc.embedFont(read('arimo-regular.ttf'), { subset: true })
    expect(sanitizeForFont('Καλημέρα κόσμε', font)).toBe('Καλημέρα κόσμε')
  })

  it('turns paragraph separators into newlines', async () => {
    const doc = await PDFDocument.create()
    const helv = await doc.embedFont(StandardFonts.Helvetica)
    expect(sanitizeForFont('a b', helv)).toBe('a\nb')
  })
})
