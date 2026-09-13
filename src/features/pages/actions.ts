import { store } from '../../store'
import { kindOf } from '../registry'
import * as model from '../../lib/pageModel'
import { rotatePointForPage } from '../../lib/geometry'
import { nid, sid } from '../../lib/ids'
import { downloadPdf } from '../../actions/exportPdf'
import { gatedDownload } from '../auth'
import type { PAGE_SIZES } from '../../constants'
import type { EditorElement, Page, Point } from '../../types'
import type { Snapshot } from '../../store/types'

const byId = (pages: Page[], id: string) => pages.find((p) => p.id === id)

/**
 * Turn pages by a multiple of 90 degrees. Elements are carried into the new
 * display space; extracted text is dropped so it re-projects at the new angle.
 */
export function rotatePages(ids: string[], delta: number): void {
  const s = store.get()
  if (!ids.length) return
  const set = new Set(ids)
  const before = new Map(s.pages.map((p) => [p.id, p]))

  s.commit((snap: Snapshot) => {
    const pages = model.rotatePages(snap.pages, ids, delta)
    const after = new Map(pages.map((p) => [p.id, p]))
    const elements = snap.elements.map((el) => {
      if (!set.has(el.pageId)) return el
      const kind = kindOf(el)
      const from = before.get(el.pageId)
      const to = after.get(el.pageId)
      if (!kind?.rotatePage || !from || !to) return el
      const t = (p: Point) => rotatePointForPage(p, delta, from.width, from.height)
      return kind.rotatePage(el, t, from, to)
    })
    return { ...snap, pages, elements }
  })
  // Native text edits are pinned to runs that no longer exist at this angle.
  store.get().invalidatePageText(ids)
}

export function deletePages(ids: string[]): void {
  const s = store.get()
  if (!ids.length || ids.length >= s.pages.length) return
  const set = new Set(ids)
  s.commit((snap) => ({
    ...snap,
    pages: model.deletePages(snap.pages, ids),
    elements: snap.elements.filter((el) => !set.has(el.pageId)),
  }))
  store.set({ selectedIds: [], session: null })
}

export function movePages(ids: string[], toIndex: number): void {
  store.get().commit((snap) => ({ ...snap, pages: model.movePages(snap.pages, ids, toIndex) }))
}

/** Copy pages, including everything drawn on them. */
export function duplicatePages(ids: string[]): void {
  const s = store.get()
  const newIds: string[] = []
  s.commit((snap) => {
    let pages = snap.pages
    const extra: EditorElement[] = []
    for (const id of ids) {
      const index = model.indexOfPage(pages, id)
      if (index < 0) continue
      const source = byId(pages, id)!
      const copy: Page = { ...source, id: sid('p') }
      pages = [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)]
      newIds.push(copy.id)
      for (const el of snap.elements) {
        if (el.pageId !== id) continue
        // Native text edits point at run ids that only exist on the original
        // page, so they cannot be carried over.
        if (kindOf(el)?.pinned) continue
        extra.push({ ...el, id: nid(), pageId: copy.id } as EditorElement)
      }
    }
    return { ...snap, pages, elements: [...snap.elements, ...extra] }
  })
  if (newIds.length) store.set({ activePageId: newIds[newIds.length - 1] })
}

export function insertBlank(afterId: string | null, size: 'same' | keyof typeof PAGE_SIZES): void {
  let newId = ''
  store.get().commit((snap) => {
    const result = model.insertBlank(snap.pages, afterId, size)
    newId = result.newId
    return { ...snap, pages: result.pages }
  })
  if (newId) store.set({ activePageId: newId })
}

/** Add every page of another PDF after `afterId`. */
export async function mergeFile(file: File, afterId: string | null): Promise<number> {
  const added = await store.get().addSource(file, afterId)
  store.get().setStatus({
    type: 'success',
    msg: `Added ${added} page${added === 1 ? '' : 's'} from ${file.name}.`,
  })
  return added
}

/** Download the chosen pages as their own PDF. */
export async function extractPages(ids: string[], suffix = 'extract'): Promise<void> {
  if (!ids.length) return
  const s = store.get()
  const order = s.pages.filter((p) => ids.includes(p.id)).map((p) => p.id)
  await gatedDownload(
    () => downloadPdf({ pageIds: order, fileName: `${s.fileName || 'document'}-${suffix}` }),
    'pages',
  ).catch(() => undefined)
}

/**
 * Split into one file per range. Ranges are 1-based over the current page
 * order, e.g. "1-3, 7, 10-".
 */
export async function splitByRanges(expression: string, separate: boolean): Promise<void> {
  const s = store.get()
  const groups = separate
    ? expression.split(/[,;]/).map((part) => part.trim()).filter(Boolean)
    : [expression]
  const jobs = groups
    .map((expr, i) => ({
      expr,
      ids: model
        .parsePageRange(expr, s.pages.length)
        .map((index) => s.pages[index]?.id)
        .filter(Boolean) as string[],
      index: i + 1,
    }))
    .filter((j) => j.ids.length)

  if (!jobs.length) {
    s.setStatus({ type: 'error', msg: 'That page range did not match any pages.' })
    return
  }

  await gatedDownload(async () => {
    const results = []
    for (const job of jobs) {
      const label = job.expr.replace(/\s+/g, '') || String(job.index)
      results.push(
        await downloadPdf({
          pageIds: job.ids,
          fileName: `${s.fileName || 'document'}-${label}`,
        }),
      )
    }
    return results
  }, 'split').catch(() => undefined)
}
