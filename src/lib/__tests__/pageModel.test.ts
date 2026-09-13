import { describe, expect, it } from 'vitest'
import {
  createPages,
  deletePages,
  duplicatePage,
  formatPageRange,
  insertBlank,
  movePages,
  parsePageRange,
  rotatePages,
} from '../pageModel'
import { totalRotation } from '../../types'

const sizes = [
  { width: 600, height: 800, rotate: 0 },
  { width: 600, height: 800, rotate: 0 },
  { width: 400, height: 400, rotate: 90 },
]

const ids = (pages: { id: string }[]) => pages.map((p) => p.id)

describe('createPages', () => {
  it('keeps the source order and carries the intrinsic rotation', () => {
    const pages = createPages('src-1', sizes)
    expect(pages).toHaveLength(3)
    expect(pages[0].source).toEqual({ kind: 'pdf', docId: 'src-1', pageIndex: 0 })
    expect(pages[2].intrinsicRotation).toBe(90)
    expect(pages[2].rotation).toBe(0)
    expect(totalRotation(pages[2])).toBe(90)
  })
})

describe('movePages', () => {
  it('moves a page forward', () => {
    const pages = createPages('s', sizes)
    const moved = movePages(pages, [pages[0].id], 3)
    expect(ids(moved)).toEqual([pages[1].id, pages[2].id, pages[0].id])
  })

  it('moves a page backward', () => {
    const pages = createPages('s', sizes)
    const moved = movePages(pages, [pages[2].id], 0)
    expect(ids(moved)).toEqual([pages[2].id, pages[0].id, pages[1].id])
  })

  it('keeps a multi-page selection contiguous', () => {
    const pages = createPages('s', sizes)
    const moved = movePages(pages, [pages[0].id, pages[2].id], 2)
    expect(ids(moved)).toEqual([pages[1].id, pages[0].id, pages[2].id])
  })

  it('never loses or duplicates a page', () => {
    const pages = createPages('s', sizes)
    for (let to = 0; to <= 3; to++) {
      const moved = movePages(pages, [pages[1].id], to)
      expect(new Set(ids(moved)).size).toBe(3)
    }
  })
})

describe('deletePages', () => {
  it('removes the named pages', () => {
    const pages = createPages('s', sizes)
    expect(ids(deletePages(pages, [pages[1].id]))).toEqual([pages[0].id, pages[2].id])
  })

  it('refuses to empty the document', () => {
    const pages = createPages('s', sizes)
    expect(deletePages(pages, ids(pages))).toBe(pages)
  })
})

describe('duplicatePage', () => {
  it('inserts a copy right after the original with a new id', () => {
    const pages = createPages('s', sizes)
    const { pages: next, newId } = duplicatePage(pages, pages[0].id)
    expect(next).toHaveLength(4)
    expect(next[1].id).toBe(newId)
    expect(next[1].id).not.toBe(pages[0].id)
    expect(next[1].source).toEqual(pages[0].source)
  })
})

describe('insertBlank', () => {
  it('matches the reference page size with "same"', () => {
    const pages = createPages('s', sizes)
    const { pages: next, newId } = insertBlank(pages, pages[0].id, 'same')
    const blank = next.find((p) => p.id === newId)!
    expect(next.indexOf(blank)).toBe(1)
    expect(blank.source).toEqual({ kind: 'blank' })
    expect(blank.width).toBe(600)
    expect(blank.height).toBe(800)
  })

  it('uses a named preset', () => {
    const pages = createPages('s', sizes)
    const { pages: next, newId } = insertBlank(pages, null, 'Letter')
    const blank = next.find((p) => p.id === newId)!
    expect(blank.width).toBe(612)
    expect(blank.height).toBe(792)
  })
})

describe('rotatePages', () => {
  it('swaps the display size on a quarter turn and accumulates', () => {
    const pages = createPages('s', sizes)
    const once = rotatePages(pages, [pages[0].id], 90)
    expect(once[0].rotation).toBe(90)
    expect(once[0].width).toBe(800)
    expect(once[0].height).toBe(600)

    const twice = rotatePages(once, [pages[0].id], 90)
    expect(twice[0].rotation).toBe(180)
    expect(twice[0].width).toBe(600)
    expect(twice[0].height).toBe(800)
  })

  it('adds to the intrinsic rotation rather than replacing it', () => {
    const pages = createPages('s', sizes)
    const rotated = rotatePages(pages, [pages[2].id], -90)
    expect(rotated[2].rotation).toBe(270)
    expect(totalRotation(rotated[2])).toBe(0)
  })
})

describe('parsePageRange', () => {
  it('treats empty and "all" as every page', () => {
    expect(parsePageRange('', 3)).toEqual([0, 1, 2])
    expect(parsePageRange('all', 3)).toEqual([0, 1, 2])
  })

  it('parses lists and ranges, de-duplicated and sorted', () => {
    expect(parsePageRange('3, 1-2, 1', 5)).toEqual([0, 1, 2])
  })

  it('supports open-ended ranges and clamps out-of-bounds input', () => {
    expect(parsePageRange('4-', 5)).toEqual([3, 4])
    expect(parsePageRange('-2', 5)).toEqual([0, 1])
    expect(parsePageRange('9', 5)).toEqual([])
  })

  it('round-trips through formatPageRange', () => {
    expect(formatPageRange([0, 1, 2, 6], 10)).toBe('1-3, 7')
    expect(parsePageRange('1-3, 7', 10)).toEqual([0, 1, 2, 6])
  })
})
