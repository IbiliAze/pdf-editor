import { describe, expect, it } from 'vitest'
import { findInLines } from '../search/find'
import { projectLines } from '../../lib/textLayer'
import type { RawItem } from '../../lib/textLayer'
import { viewTransform } from '../../lib/export/transform'
import type { FontSpec } from '../../types'

const FONT: FontSpec = { family: 'Arimo', bold: false, italic: false }

function item(str: string, x: number, y: number, size = 10): RawItem {
  return {
    str,
    transform: [size, 0, 0, size, x, y],
    width: str.length * size * 0.5,
    fontHeight: size,
    ascent: 0.8,
    descent: 0.2,
    fontName: 'f1',
    realName: 'Arial',
    font: FONT,
    hasEOL: false,
  }
}

const vp = { transform: viewTransform([0, 0, 600, 800], 0) }
const lines = (...items: RawItem[]) => projectLines(items, vp, 'p1')

describe('findInLines', () => {
  it('finds every occurrence in a run', () => {
    const l = lines(item('the word secret appears, and secret again', 60, 700))
    const hits = findInLines(l, 'secret')
    expect(hits).toHaveLength(2)
    expect(hits[0].start).toBeLessThan(hits[1].start)
    expect(hits.every((h) => h.text === 'secret')).toBe(true)
  })

  it('ignores case by default and honours match case', () => {
    const l = lines(item('Secret and secret', 60, 700))
    expect(findInLines(l, 'secret')).toHaveLength(2)
    expect(findInLines(l, 'secret', { caseSensitive: true })).toHaveLength(1)
  })

  it('matches whole words only when asked', () => {
    const l = lines(item('secretive secret', 60, 700))
    expect(findInLines(l, 'secret')).toHaveLength(2)
    expect(findInLines(l, 'secret', { wholeWord: true })).toHaveLength(1)
  })

  it('returns nothing for an empty query', () => {
    expect(findInLines(lines(item('anything', 60, 700)), '')).toEqual([])
  })

  it('searches across runs and reports the page and run each hit is in', () => {
    const l = lines(item('alpha secret', 60, 700), item('beta secret', 60, 600))
    const hits = findInLines(l, 'secret')
    expect(hits).toHaveLength(2)
    expect(new Set(hits.map((h) => h.lineId)).size).toBe(2)
    expect(hits.every((h) => h.pageId === 'p1')).toBe(true)
  })

  it('boxes each hit inside the run it belongs to', () => {
    const l = lines(item('prefix secret suffix', 60, 700))
    const [hit] = findInLines(l, 'secret')
    const line = l[0]
    expect(hit.rect.x).toBeGreaterThanOrEqual(line.x)
    expect(hit.rect.x + hit.rect.w).toBeLessThanOrEqual(line.x + line.width + 1)
    expect(hit.rect.h).toBeCloseTo(line.height)
  })

  it('does not loop forever on a repeated single character', () => {
    const l = lines(item('aaaa', 60, 700))
    expect(findInLines(l, 'a')).toHaveLength(4)
  })
})
