import { store } from '../store'
import { kindOf } from '../features/registry'
import { nid } from '../lib/ids'
import type { EditorElement, Rect } from '../types'

export function deleteSelected(): void {
  const s = store.get()
  if (!s.selectedIds.length) return
  s.removeElements(s.selectedIds)
}

export function duplicateSelected(): void {
  const s = store.get()
  if (!s.selectedIds.length) return
  const ids = new Set(s.selectedIds)
  const copies: EditorElement[] = []
  for (const el of s.elements) {
    if (!ids.has(el.id)) continue
    const kind = kindOf(el)
    if (!kind?.move) continue
    copies.push({ ...kind.move(el, 12, 12), id: nid() } as EditorElement)
  }
  if (!copies.length) return
  s.commit((snap) => ({ ...snap, elements: [...snap.elements, ...copies] }))
  store.set({ selectedIds: copies.map((c) => c.id) })
}

export function nudgeSelected(dx: number, dy: number): void {
  const s = store.get()
  if (!s.selectedIds.length) return
  const ids = new Set(s.selectedIds)
  s.commit((snap) => ({
    ...snap,
    elements: snap.elements.map((el) => {
      if (!ids.has(el.id)) return el
      const kind = kindOf(el)
      return kind?.move ? kind.move(el, dx, dy) : el
    }),
  }))
}

/** Display-space bounds of an element, via its kind. */
export function boundsOf(el: EditorElement): Rect | null {
  const kind = kindOf(el)
  if (!kind?.bounds) return null
  return kind.bounds(el, {
    linesById: linesForPage(el.pageId),
    blocksById: blocksForPage(el.pageId),
  })
}

function linesForPage(pageId: string) {
  const map: Record<string, import('../types').Line> = {}
  for (const l of store.get().pageText[pageId]?.lines ?? []) map[l.id] = l
  return map
}

function blocksForPage(pageId: string) {
  const map: Record<string, import('../types').TextBlock> = {}
  for (const b of store.get().pageText[pageId]?.blocks ?? []) map[b.id] = b
  return map
}
