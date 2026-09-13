import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import '../../features'
import { buildPdf, unrotatedSize } from '../export/buildPdf'
import type { ExportState } from '../export/buildPdf'
import { createPages, deletePages, movePages, rotatePages } from '../pageModel'
import { nid } from '../ids'
import type { EditorElement, Page, SourceDoc } from '../../types'
import type { TextElement } from '../../features/annotate'

const SIZES: [number, number][] = [
  [600, 800],
  [400, 500],
  [300, 900],
]

/** A three-page fixture whose pages are identifiable by their size. */
async function fixture(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  SIZES.forEach(([w, h], i) => {
    const page = doc.addPage([w, h])
    page.drawText(`Page ${i + 1}`, { x: 20, y: h - 40, size: 18, font })
  })
  const bytes = await doc.save()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function stateFor(bytes: ArrayBuffer): Promise<{ state: ExportState; pages: Page[] }> {
  const pages = createPages(
    'src-1',
    SIZES.map(([width, height]) => ({ width, height, rotate: 0 })),
  )
  const source: SourceDoc = {
    id: 'src-1',
    name: 'fixture',
    bytes,
    // buildPdf reads the pristine bytes, never the pdf.js proxy.
    pdfjs: null as never,
    pageCount: 3,
    encrypted: false,
  }
  return {
    pages,
    state: {
      sources: { 'src-1': source },
      pages,
      elements: [],
      linesById: {},
      blocksById: {},
      formFields: {},
      formValues: {},
      decorations: {},
      fileName: 'fixture',
    },
  }
}

const sizesOf = (doc: PDFDocument) =>
  doc.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())])

describe('buildPdf', () => {
  it('writes every page unchanged by default', async () => {
    const { state } = await stateFor(await fixture())
    const out = await PDFDocument.load(await buildPdf(state))
    expect(out.getPageCount()).toBe(3)
    expect(sizesOf(out)).toEqual(SIZES.map(([w, h]) => [w, h]))
  })

  it('writes pages in the model order', async () => {
    const { state, pages } = await stateFor(await fixture())
    state.pages = movePages(pages, [pages[2].id], 0)
    const out = await PDFDocument.load(await buildPdf(state))
    expect(sizesOf(out)).toEqual([
      [300, 900],
      [600, 800],
      [400, 500],
    ])
  })

  it('drops deleted pages', async () => {
    const { state, pages } = await stateFor(await fixture())
    state.pages = deletePages(pages, [pages[1].id])
    const out = await PDFDocument.load(await buildPdf(state))
    expect(out.getPageCount()).toBe(2)
    expect(sizesOf(out)).toEqual([
      [600, 800],
      [300, 900],
    ])
  })

  it('writes the rotation the model asks for', async () => {
    const { state, pages } = await stateFor(await fixture())
    state.pages = rotatePages(pages, [pages[0].id], 90)
    const out = await PDFDocument.load(await buildPdf(state))
    expect(out.getPage(0).getRotation().angle).toBe(90)
    expect(out.getPage(1).getRotation().angle).toBe(0)
    // Rotation is metadata: the media box keeps the unrotated size.
    expect(sizesOf(out)[0]).toEqual([600, 800])
    expect(unrotatedSize(state.pages[0])).toEqual({ width: 600, height: 800 })
  })

  it('exports only the requested pages', async () => {
    const { state, pages } = await stateFor(await fixture())
    const out = await PDFDocument.load(
      await buildPdf(state, { pageIds: [pages[1].id] }),
    )
    expect(out.getPageCount()).toBe(1)
    expect(sizesOf(out)).toEqual([[400, 500]])
  })

  it('duplicates a page without disturbing the original', async () => {
    const { state, pages } = await stateFor(await fixture())
    state.pages = [...pages, { ...pages[0], id: 'p-copy' }]
    const out = await PDFDocument.load(await buildPdf(state))
    expect(out.getPageCount()).toBe(4)
    expect(sizesOf(out)[3]).toEqual([600, 800])
  })

  it('rebuilds the document when a blank page is present', async () => {
    const { state, pages } = await stateFor(await fixture())
    const blank: Page = {
      id: 'p-blank',
      source: { kind: 'blank' },
      intrinsicRotation: 0,
      rotation: 0,
      width: 595,
      height: 842,
    }
    state.pages = [...pages, blank]
    const out = await PDFDocument.load(await buildPdf(state))
    expect(out.getPageCount()).toBe(4)
    expect(sizesOf(out)[3]).toEqual([595, 842])
  })

  it('draws an added text element and grows the file', async () => {
    const bytes = await fixture()
    const { state, pages } = await stateFor(bytes)
    const before = (await buildPdf(state)).byteLength
    const el: TextElement = {
      id: nid(),
      type: 'text',
      pageId: pages[0].id,
      x: 100,
      y: 100,
      w: 200,
      text: 'Added by the editor',
      size: 14,
      color: '#112233',
      font: { family: 'Helvetica', bold: false, italic: false },
    }
    state.elements = [el as EditorElement]
    const after = await buildPdf(state)
    expect(after.byteLength).toBeGreaterThan(before)
    const out = await PDFDocument.load(after)
    expect(out.getPageCount()).toBe(3)
  })
})
