import type { StateCreator } from 'zustand'
import { pdfjsLib } from '../lib/pdfjs'
import { createPages } from '../lib/pageModel'
import { extractRawItems, groupIntoBlocks, projectLines } from '../lib/textLayer'
import type { RawItem } from '../lib/textLayer'
import { clearEmbeddedFontCache } from '../features/text-edit/embeddedFonts'
import { clearThumbnailCache } from '../features/pages/Thumbnail'
import { baseName, sid } from '../lib/utils'
import { totalRotation } from '../types'
import type { Page, SourceDoc } from '../types'
import type { DocumentSlice, EditorStore, PageText } from './types'

/**
 * Raw text items per source page, outside the store: they are large, never
 * rendered, and shared by every page that points at the same source page.
 */
const rawCache = new Map<string, RawItem[]>()

const rawKey = (docId: string, pageIndex: number) => `${docId}:${pageIndex}`

export const clearRawCache = (docId?: string): void => {
  if (!docId) {
    rawCache.clear()
    return
  }
  for (const key of [...rawCache.keys()]) {
    if (key.startsWith(`${docId}:`)) rawCache.delete(key)
  }
}

export async function loadSource(file: File): Promise<{ source: SourceDoc; pages: Page[] }> {
  const bytes = await file.arrayBuffer()
  // pdf.js transfers its buffer to the worker, so hand it a copy and keep the
  // pristine original for pdf-lib at export time.
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(bytes.slice(0)),
    fontExtraProperties: true,
  })
  const doc = await task.promise

  const sizes = []
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1)
    const vp = page.getViewport({ scale: 1 })
    sizes.push({ width: vp.width, height: vp.height, rotate: page.rotate })
  }

  const source: SourceDoc = {
    id: sid('src'),
    name: baseName(file.name),
    bytes,
    pdfjs: doc,
    pageCount: doc.numPages,
    encrypted: false,
  }
  return { source, pages: createPages(source.id, sizes) }
}

export const createDocumentSlice: StateCreator<EditorStore, [], [], DocumentSlice> = (
  set,
  get,
) => ({
  sources: {},
  pages: [],
  pageText: {},
  pendingText: {},
  formFields: {},
  fileName: '',
  loading: false,

  openFile: async (file) => {
    set({ loading: true })
    try {
      const { source, pages } = await loadSource(file)
      // Only tear the old document down once the new one has fully parsed, so
      // a failed open leaves the previous document intact.
      for (const old of Object.values(get().sources)) {
        try {
          old.pdfjs.destroy()
        } catch {
          // already destroyed
        }
      }
      clearRawCache()
      clearEmbeddedFontCache()
      clearThumbnailCache()
      set({
        sources: { [source.id]: source },
        pages,
        pageText: {},
        pendingText: {},
        formFields: {},
        fileName: source.name,
        elements: [],
        formValues: {},
        decorations: {},
        past: [],
        future: [],
        selectedIds: [],
        session: null,
        liveDraw: null,
        activePageId: pages[0]?.id ?? null,
      })
    } finally {
      set({ loading: false })
    }
  },

  addSource: async (file, afterPageId) => {
    const { source, pages: newPages } = await loadSource(file)
    const state = get()
    const at = afterPageId
      ? state.pages.findIndex((p) => p.id === afterPageId) + 1
      : state.pages.length
    const pages = [...state.pages.slice(0, at), ...newPages, ...state.pages.slice(at)]
    set({ sources: { ...state.sources, [source.id]: source } })
    state.commit((s) => ({ ...s, pages }))
    return newPages.length
  },

  ensurePageText: async (pageId) => {
    const state = get()
    if (state.pageText[pageId] || state.pendingText[pageId]) return
    const page = state.pages.find((p) => p.id === pageId)
    if (!page) return
    if (page.source.kind === 'blank') {
      set((s) => ({ pageText: { ...s.pageText, [pageId]: { lines: [], blocks: [] } } }))
      return
    }
    set((s) => ({ pendingText: { ...s.pendingText, [pageId]: true } }))
    try {
      const text = await buildPageText(get, page)
      set((s) => ({ pageText: { ...s.pageText, [pageId]: text } }))
    } catch {
      set((s) => ({ pageText: { ...s.pageText, [pageId]: { lines: [], blocks: [] } } }))
    } finally {
      set((s) => {
        const pending = { ...s.pendingText }
        delete pending[pageId]
        return { pendingText: pending }
      })
    }
  },

  ensureAllPageText: async (onProgress) => {
    const pages = get().pages
    for (let i = 0; i < pages.length; i++) {
      await get().ensurePageText(pages[i].id)
      onProgress?.(i + 1, pages.length)
    }
  },

  invalidatePageText: (pageIds) => {
    set((s) => {
      const next = { ...s.pageText }
      for (const id of pageIds) delete next[id]
      return { pageText: next }
    })
  },

  closeDocument: () => {
    for (const src of Object.values(get().sources)) {
      try {
        src.pdfjs.destroy()
      } catch {
        // already destroyed
      }
    }
    clearRawCache()
    clearEmbeddedFontCache()
    clearThumbnailCache()
    set({
      sources: {},
      pages: [],
      pageText: {},
      pendingText: {},
      formFields: {},
      fileName: '',
      elements: [],
      formValues: {},
      decorations: {},
      past: [],
      future: [],
      selectedIds: [],
      session: null,
      liveDraw: null,
      activePageId: null,
    })
  },
})

/** Extract (or re-project) the text of one page at its current rotation. */
async function buildPageText(get: () => EditorStore, page: Page): Promise<PageText> {
  if (page.source.kind === 'blank') return { lines: [], blocks: [] }
  const src = get().sources[page.source.docId]
  if (!src) return { lines: [], blocks: [] }

  const key = rawKey(page.source.docId, page.source.pageIndex)
  let raw = rawCache.get(key)
  const pdfPage = await src.pdfjs.getPage(page.source.pageIndex + 1)
  if (!raw) {
    raw = await extractRawItems(pdfPage)
    rawCache.set(key, raw)
  }
  const vp = pdfPage.getViewport({ scale: 1, rotation: totalRotation(page) })
  const lines = projectLines(raw, vp, page.id)
  const blocks = groupIntoBlocks(lines)
  return { lines, blocks }
}
