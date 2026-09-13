import { describe, expect, it } from 'vitest'
import '../../features'
import { redactedPageIds } from '../redaction'
import { chooseStrategy } from '../../lib/export/buildPdf'
import type { ExportState } from '../../lib/export/buildPdf'
import type { EditorElement, Page, SourceDoc } from '../../types'

const page = (id: string): Page => ({
  id,
  source: { kind: 'pdf', docId: 'src-1', pageIndex: Number(id.slice(1)) },
  intrinsicRotation: 0,
  rotation: 0,
  width: 600,
  height: 800,
})

const source: SourceDoc = {
  id: 'src-1',
  name: 'doc',
  bytes: new ArrayBuffer(8),
  pdfjs: null as never,
  pageCount: 2,
  encrypted: false,
}

const state = (elements: EditorElement[], pages = [page('p0'), page('p1')]): ExportState => ({
  sources: { 'src-1': source },
  pages,
  elements,
  linesById: {},
  blocksById: {},
  formFields: {},
  formValues: {},
  decorations: {},
  fileName: 'doc',
})

const redact = (pageId: string): EditorElement =>
  ({ id: 1, type: 'redact', pageId, x: 0, y: 0, w: 10, h: 10 }) as EditorElement

describe('redactedPageIds', () => {
  it('lists only pages that carry a redaction', () => {
    const s = state([redact('p1')])
    expect(redactedPageIds(s, ['p0', 'p1'])).toEqual(['p1'])
  })

  it('ignores redactions on pages outside the export', () => {
    const s = state([redact('p1')])
    expect(redactedPageIds(s, ['p0'])).toEqual([])
  })

  it('reports each page once however many redactions it has', () => {
    const s = state([redact('p0'), redact('p0')])
    expect(redactedPageIds(s, ['p0', 'p1'])).toEqual(['p0'])
  })
})

describe('chooseStrategy', () => {
  it('edits the original document in place when it can', () => {
    expect(chooseStrategy(state([]), ['p0', 'p1'])).toBe('inplace')
  })

  it('rebuilds when a page has to be rasterised, so nothing redacted is copied', () => {
    expect(chooseStrategy(state([redact('p1')]), ['p0', 'p1'])).toBe('rebuild')
  })

  it('rebuilds once pages come from more than one file', () => {
    const merged = state([], [
      page('p0'),
      { ...page('p1'), source: { kind: 'pdf', docId: 'src-2', pageIndex: 0 } },
    ])
    expect(chooseStrategy(merged, ['p0', 'p1'])).toBe('rebuild')
  })

  it('rebuilds when a blank page is in the mix', () => {
    const withBlank = state([], [
      page('p0'),
      { ...page('p1'), source: { kind: 'blank' } },
    ])
    expect(chooseStrategy(withBlank, ['p0', 'p1'])).toBe('rebuild')
  })
})
