import { PDFDocument, degrees } from 'pdf-lib'
import type { PDFImage, PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { inDrawOrder, kindOf } from '../../features/registry'
import { createFontResolver } from './fonts'
import { apply, invert, rectToPdfWith, viewTransform } from './transform'
import type { Matrix, ViewBox } from './transform'
import { totalRotation } from '../../types'
import type {
  DocDecorations,
  EditorElement,
  ExportCtx,
  FormField,
  FormValue,
  Line,
  Page,
  SourceDoc,
  TextBlock,
} from '../../types'

export interface ExportState {
  sources: Record<string, SourceDoc>
  pages: Page[]
  elements: EditorElement[]
  linesById: Record<string, Line>
  blocksById: Record<string, TextBlock>
  formFields: Record<string, FormField[]>
  formValues: Record<string, FormValue>
  decorations: DocDecorations
  fileName: string
}

export interface ExportOptions {
  /** subset and order of pages to write; defaults to every page */
  pageIds?: string[]
  flattenForms?: boolean
  redactDpi?: number
  password?: {
    userPassword: string
    ownerPassword?: string
  }
  onProgress?: (message: string, fraction: number) => void
}

/** Hooks other features install so buildPdf stays free of their imports. */
export interface ExportPlugins {
  /** page ids whose content must be rasterised (redaction) */
  rasterizePages?: (state: ExportState, pageIds: string[]) => string[]
  rasterize?: (
    state: ExportState,
    page: Page,
    dpi: number,
  ) => Promise<{ bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null>
  applyForms?: (
    doc: PDFDocument,
    state: ExportState,
    mode: 'inplace' | 'rebuild',
    ctxForPage: (pageId: string) => ExportCtx | null,
    flatten: boolean,
  ) => Promise<void>
  drawDecorations?: (state: ExportState, ctx: ExportCtx, index: number, total: number) => Promise<void>
  embedImage?: (doc: PDFDocument, assetId: string) => Promise<PDFImage | null>
  lookupEmbeddedFont?: (
    state: ExportState,
    fontKey: string,
  ) => Promise<{ bytes: Uint8Array; name: string } | null>
  encrypt?: (bytes: Uint8Array, password: NonNullable<ExportOptions['password']>) => Promise<Uint8Array>
}

const plugins: ExportPlugins = {}

export function registerExportPlugin(p: Partial<ExportPlugins>): void {
  Object.assign(plugins, p)
}

export type ExportStrategy = 'inplace' | 'rebuild'

/** Unrotated PDF page size for a model page. */
export function unrotatedSize(page: Page): { width: number; height: number } {
  const rot = totalRotation(page)
  return rot === 90 || rot === 270
    ? { width: page.height, height: page.width }
    : { width: page.width, height: page.height }
}

/**
 * In-place keeps the original document object (and with it the AcroForm,
 * outlines and metadata). It is only possible while every page still comes
 * from the one source document and nothing has to be rasterised.
 */
export function chooseStrategy(state: ExportState, pageIds: string[]): ExportStrategy {
  const pages = state.pages.filter((p) => pageIds.includes(p.id))
  const docIds = new Set<string>()
  for (const p of pages) {
    if (p.source.kind === 'blank') return 'rebuild'
    docIds.add(p.source.docId)
  }
  if (docIds.size !== 1) return 'rebuild'
  const redacted = plugins.rasterizePages?.(state, pageIds) ?? []
  return redacted.length ? 'rebuild' : 'inplace'
}

async function loadSourceDoc(src: SourceDoc): Promise<PDFDocument> {
  return PDFDocument.load(src.bytes, { ignoreEncryption: true })
}

interface Assembled {
  out: PDFDocument
  pdfPageFor: Map<string, PDFPage>
  strategy: ExportStrategy
}

async function assemble(
  state: ExportState,
  pageIds: string[],
  strategy: ExportStrategy,
  opts: ExportOptions,
): Promise<Assembled> {
  const order = pageIds
    .map((id) => state.pages.find((p) => p.id === id))
    .filter((p): p is Page => !!p)

  const rasterIds = new Set(plugins.rasterizePages?.(state, pageIds) ?? [])
  const pdfPageFor = new Map<string, PDFPage>()

  if (strategy === 'inplace') {
    const docId = (order[0].source as { docId: string }).docId
    const out = await loadSourceDoc(state.sources[docId])
    const originals = out.getPages()
    const used = new Set<number>()
    const chosen: PDFPage[] = []
    for (const page of order) {
      const idx = (page.source as { pageIndex: number }).pageIndex
      let pdfPage = originals[idx]
      if (!pdfPage) continue
      if (used.has(idx)) {
        const [copy] = await out.copyPages(out, [idx])
        pdfPage = copy
      }
      used.add(idx)
      chosen.push(pdfPage)
      pdfPageFor.set(page.id, pdfPage)
    }
    // Rebuild the page tree in the requested order.
    for (let i = out.getPageCount() - 1; i >= 0; i--) out.removePage(i)
    for (const page of chosen) out.addPage(page)
    applyRotations(order, pdfPageFor)
    return { out, pdfPageFor, strategy }
  }

  const out = await PDFDocument.create()
  const loaded = new Map<string, PDFDocument>()
  const dpi = opts.redactDpi ?? 200

  for (let i = 0; i < order.length; i++) {
    const page = order[i]
    opts.onProgress?.('Assembling pages…', (i / Math.max(1, order.length)) * 0.4)

    if (page.source.kind === 'blank' || rasterIds.has(page.id)) {
      const size = unrotatedSize(page)
      const pdfPage = out.addPage([size.width, size.height])
      pdfPageFor.set(page.id, pdfPage)
      if (rasterIds.has(page.id) && plugins.rasterize) {
        const raster = await plugins.rasterize(state, page, dpi)
        if (raster) {
          const img =
            raster.mime === 'image/png'
              ? await out.embedPng(raster.bytes)
              : await out.embedJpg(raster.bytes)
          // The raster already shows the page at its display rotation, so the
          // new page carries no rotation of its own.
          pdfPage.setSize(page.width, page.height)
          pdfPage.drawImage(img, { x: 0, y: 0, width: page.width, height: page.height })
        }
      }
      continue
    }

    const src = state.sources[page.source.docId]
    if (!src) continue
    let doc = loaded.get(page.source.docId)
    if (!doc) {
      doc = await loadSourceDoc(src)
      loaded.set(page.source.docId, doc)
    }
    const [copy] = await out.copyPages(doc, [page.source.pageIndex])
    out.addPage(copy)
    pdfPageFor.set(page.id, copy)
  }

  applyRotations(
    order.filter((p) => !rasterIds.has(p.id)),
    pdfPageFor,
  )
  return { out, pdfPageFor, strategy }
}

function applyRotations(order: Page[], pdfPageFor: Map<string, PDFPage>): void {
  for (const page of order) {
    const pdfPage = pdfPageFor.get(page.id)
    if (!pdfPage) continue
    try {
      pdfPage.setRotation(degrees(totalRotation(page)))
    } catch {
      // malformed /Rotate on the source page; leave it alone
    }
  }
}

/** Build the export-time drawing context for one page. */
function makeCtx(
  state: ExportState,
  out: PDFDocument,
  page: Page,
  pdfPage: PDFPage,
  rasterised: boolean,
  embedFont: ExportCtx['embedFont'],
  imageCache: Map<string, PDFImage | null>,
): ExportCtx {
  const size = unrotatedSize(page)
  let viewBox: ViewBox = [0, 0, size.width, size.height]
  try {
    const box = pdfPage.getMediaBox()
    viewBox = [box.x, box.y, box.x + box.width, box.y + box.height]
  } catch {
    // keep the derived box
  }
  // A rasterised page was rebuilt upright, so its drawing space is unrotated.
  const rot = rasterised ? 0 : totalRotation(page)
  const m: Matrix = viewTransform(rasterised ? [0, 0, page.width, page.height] : viewBox, rot)
  const inv = invert(m)

  return {
    out,
    page: pdfPage,
    totalRotation: rot,
    modelPage: page,
    linesById: state.linesById,
    blocksById: state.blocksById,
    embedFont,
    embedImage: async (assetId) => {
      if (imageCache.has(assetId)) return imageCache.get(assetId) ?? null
      const img = plugins.embedImage ? await plugins.embedImage(out, assetId) : null
      imageCache.set(assetId, img)
      return img
    },
    toPdf: (x, y) => apply(inv, x, y),
    rectToPdf: (x, y, w, h) => rectToPdfWith(inv, x, y, w, h),
  }
}

/** Write the edited PDF. */
export async function buildPdf(
  state: ExportState,
  opts: ExportOptions = {},
): Promise<Uint8Array> {
  const pageIds = opts.pageIds?.length
    ? opts.pageIds
    : state.pages.map((p) => p.id)
  if (!pageIds.length) throw new Error('No pages to export.')

  const strategy = chooseStrategy(state, pageIds)
  const { out, pdfPageFor } = await assemble(state, pageIds, strategy, opts)
  out.registerFontkit(fontkit)

  const resolver = createFontResolver(out, {
    lookupEmbedded: plugins.lookupEmbeddedFont
      ? (key) => plugins.lookupEmbeddedFont!(state, key)
      : undefined,
  })
  const imageCache = new Map<string, PDFImage | null>()
  const rasterIds = new Set(plugins.rasterizePages?.(state, pageIds) ?? [])

  const ctxByPage = new Map<string, ExportCtx>()
  const order = pageIds
    .map((id) => state.pages.find((p) => p.id === id))
    .filter((p): p is Page => !!p)

  for (const page of order) {
    const pdfPage = pdfPageFor.get(page.id)
    if (!pdfPage) continue
    ctxByPage.set(
      page.id,
      makeCtx(state, out, page, pdfPage, rasterIds.has(page.id), resolver.embed, imageCache),
    )
  }

  if (plugins.applyForms) {
    await plugins.applyForms(
      out,
      state,
      strategy,
      (pageId) => ctxByPage.get(pageId) ?? null,
      !!opts.flattenForms,
    )
  }

  const byPage = new Map<string, EditorElement[]>()
  for (const el of inDrawOrder(state.elements)) {
    const list = byPage.get(el.pageId)
    if (list) list.push(el)
    else byPage.set(el.pageId, [el])
  }

  for (let i = 0; i < order.length; i++) {
    const page = order[i]
    const ctx = ctxByPage.get(page.id)
    if (!ctx) continue
    opts.onProgress?.('Drawing edits…', 0.4 + (i / Math.max(1, order.length)) * 0.5)
    for (const el of byPage.get(page.id) ?? []) {
      const kind = kindOf(el)
      if (!kind) continue
      try {
        await kind.draw(el, ctx)
      } catch (err) {
        console.warn(`Could not draw ${el.type} element`, err)
      }
    }
    if (plugins.drawDecorations) {
      await plugins.drawDecorations(state, ctx, i, order.length)
    }
  }

  opts.onProgress?.('Writing file…', 0.95)
  let bytes = await out.save()
  if (opts.password?.userPassword && plugins.encrypt) {
    bytes = await plugins.encrypt(bytes, opts.password)
  }
  return bytes
}
