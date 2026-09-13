import { PAGE_SIZES } from '../constants'
import { addRotation } from './geometry'
import { sid } from './ids'
import type { Page, Rotation } from '../types'

export interface SourcePageSize {
  width: number
  height: number
  /** the page's own /Rotate value */
  rotate: number
}

export function createPages(docId: string, sizes: SourcePageSize[]): Page[] {
  return sizes.map((s, i) => ({
    id: sid('p'),
    source: { kind: 'pdf' as const, docId, pageIndex: i },
    intrinsicRotation: ((s.rotate % 360) + 360) % 360,
    rotation: 0 as Rotation,
    width: s.width,
    height: s.height,
  }))
}

export const indexOfPage = (pages: Page[], id: string): number =>
  pages.findIndex((p) => p.id === id)

/** Move every page in `ids` so the first of them lands at `toIndex`. */
export function movePages(pages: Page[], ids: string[], toIndex: number): Page[] {
  const set = new Set(ids)
  const moving = pages.filter((p) => set.has(p.id))
  if (!moving.length) return pages
  const rest = pages.filter((p) => !set.has(p.id))
  // toIndex is an index into the original array; translate it to `rest`.
  const before = pages.slice(0, toIndex).filter((p) => !set.has(p.id)).length
  const at = Math.max(0, Math.min(rest.length, before))
  return [...rest.slice(0, at), ...moving, ...rest.slice(at)]
}

export function deletePages(pages: Page[], ids: string[]): Page[] {
  const set = new Set(ids)
  const next = pages.filter((p) => !set.has(p.id))
  return next.length ? next : pages
}

export function duplicatePage(pages: Page[], id: string): { pages: Page[]; newId: string } {
  const i = indexOfPage(pages, id)
  if (i < 0) return { pages, newId: '' }
  const copy: Page = { ...pages[i], id: sid('p') }
  return { pages: [...pages.slice(0, i + 1), copy, ...pages.slice(i + 1)], newId: copy.id }
}

export function insertBlank(
  pages: Page[],
  afterId: string | null,
  size: 'same' | keyof typeof PAGE_SIZES,
): { pages: Page[]; newId: string } {
  const i = afterId ? indexOfPage(pages, afterId) : pages.length - 1
  const ref = pages[i] ?? pages[pages.length - 1]
  let width = 595.28
  let height = 841.89
  if (size === 'same' && ref) {
    width = ref.width
    height = ref.height
  } else if (size !== 'same' && PAGE_SIZES[size]) {
    ;[width, height] = PAGE_SIZES[size]
  }
  const page: Page = {
    id: sid('p'),
    source: { kind: 'blank' },
    intrinsicRotation: 0,
    rotation: 0,
    width,
    height,
  }
  const at = i < 0 ? pages.length : i + 1
  return { pages: [...pages.slice(0, at), page, ...pages.slice(at)], newId: page.id }
}

/** Rotate pages by a multiple of 90 degrees, swapping their display size. */
export function rotatePages(pages: Page[], ids: string[], delta: number): Page[] {
  const set = new Set(ids)
  const swap = Math.abs(delta / 90) % 2 === 1
  return pages.map((p) =>
    set.has(p.id)
      ? {
          ...p,
          rotation: addRotation(p.rotation, delta),
          width: swap ? p.height : p.width,
          height: swap ? p.width : p.height,
        }
      : p,
  )
}

/**
 * Parse a 1-based page range expression ("all", "1-3, 7, 12-") into 0-based
 * page indices. Unparseable input yields an empty array.
 */
export function parsePageRange(expr: string, total: number): number[] {
  const text = String(expr ?? '').trim().toLowerCase()
  if (!text || text === 'all' || text === '*') {
    return Array.from({ length: total }, (_, i) => i)
  }
  const out = new Set<number>()
  for (const part of text.split(/[,;]/)) {
    const p = part.trim()
    if (!p) continue
    const m = /^(\d*)\s*-\s*(\d*)$/.exec(p)
    if (m) {
      const from = m[1] ? parseInt(m[1], 10) : 1
      const to = m[2] ? parseInt(m[2], 10) : total
      for (let i = Math.max(1, from); i <= Math.min(total, to); i++) out.add(i - 1)
      continue
    }
    const n = parseInt(p, 10)
    if (Number.isFinite(n) && n >= 1 && n <= total) out.add(n - 1)
  }
  return [...out].sort((a, b) => a - b)
}

/** Render a page range back into a compact expression, for round-tripping. */
export function formatPageRange(indices: number[], total: number): string {
  if (!indices.length) return ''
  if (indices.length === total) return 'all'
  const sorted = [...indices].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i]
    if (cur !== prev + 1) {
      parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`)
      start = cur
    }
    prev = cur
  }
  return parts.join(', ')
}
