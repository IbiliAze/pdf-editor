import { describe, expect, it } from 'vitest'
import { groupIntoBlocks, lineBBox, partialEdit, projectLines } from '../textLayer'
import type { RawItem } from '../textLayer'
import { viewTransform } from '../export/transform'
import type { FontSpec } from '../../types'

const FONT: FontSpec = { family: 'Arimo', bold: false, italic: false }

/** A horizontal run at PDF-space (x, y) of the given size. */
function item(str: string, x: number, y: number, size = 10, width?: number): RawItem {
  return {
    str,
    transform: [size, 0, 0, size, x, y],
    width: width ?? str.length * size * 0.5,
    fontHeight: size,
    ascent: 0.8,
    descent: 0.2,
    fontName: 'f1',
    realName: 'Arial',
    font: FONT,
    hasEOL: false,
  }
}

const PAGE_H = 800
const PAGE_W = 600
const vp = (rotation = 0) => ({
  transform: viewTransform([0, 0, PAGE_W, PAGE_H], rotation),
})

describe('projectLines', () => {
  it('places a horizontal run in display space with the y axis flipped', () => {
    const lines = projectLines([item('Hello world', 72, 700)], vp(), 'p1')
    expect(lines).toHaveLength(1)
    const line = lines[0]
    expect(line.text).toBe('Hello world')
    expect(line.x).toBeCloseTo(72)
    expect(line.baseline).toBeCloseTo(PAGE_H - 700)
    expect(line.angle).toBeCloseTo(0)
    expect(line.top).toBeCloseTo(PAGE_H - 700 - 8)
    expect(line.height).toBeCloseTo(10)
    expect(line.pdfX).toBe(72)
    expect(line.pdfBaseline).toBe(700)
    expect(line.pdfAngle).toBeCloseTo(0)
  })

  it('joins items on the same baseline into one run', () => {
    const lines = projectLines(
      [item('Hello', 72, 700), item('world', 72 + 25 + 2, 700)],
      vp(),
      'p1',
    )
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('Hello world')
    expect(lines[0].spans).toHaveLength(2)
  })

  it('splits runs separated by a wide gap, so table columns stay apart', () => {
    const lines = projectLines([item('Name', 72, 700), item('Value', 300, 700)], vp(), 'p1')
    expect(lines.map((l) => l.text)).toEqual(['Name', 'Value'])
  })

  it('splits runs whose font size jumps', () => {
    const lines = projectLines([item('Head', 72, 700, 20), item('note', 115, 700, 8)], vp(), 'p1')
    expect(lines).toHaveLength(2)
  })

  it('keeps rotated runs, recording their display angle', () => {
    // A run rotated 90 degrees counter-clockwise in PDF space.
    const rotated: RawItem = {
      ...item('SIDEWAYS', 100, 100),
      transform: [0, 10, -10, 0, 100, 100],
    }
    const lines = projectLines([rotated], vp(), 'p1')
    expect(lines).toHaveLength(1)
    // PDF counter-clockwise becomes display clockwise-negative.
    expect(lines[0].angle).toBeCloseTo(-90)
    expect(lines[0].pdfAngle).toBeCloseTo(90)
    const box = lineBBox(lines[0])
    expect(box.h).toBeGreaterThan(box.w)
  })

  it('reports horizontal text as rotated once the page is turned', () => {
    const lines = projectLines([item('Hello', 72, 700)], vp(90), 'p1')
    expect(lines[0].angle).toBeCloseTo(90)
  })

  it('does not merge runs at different angles', () => {
    const rotated: RawItem = {
      ...item('SIDE', 72, 700),
      transform: [0, 10, -10, 0, 72, 700],
    }
    const lines = projectLines([item('Flat', 72, 700), rotated], vp(), 'p1')
    expect(lines).toHaveLength(2)
  })
})

describe('groupIntoBlocks', () => {
  const paragraph = (count: number, pitch = 14) =>
    Array.from({ length: count }, (_, i) => item(`line number ${i}`, 72, 700 - i * pitch))

  it('groups evenly spaced, left-aligned lines into one block', () => {
    const lines = projectLines(paragraph(4), vp(), 'p1')
    const blocks = groupIntoBlocks(lines)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].lineIds).toHaveLength(4)
    expect(blocks[0].pitch).toBeCloseTo(14)
    expect(blocks[0].align).toBe('left')
    expect(lines.every((l) => l.blockId === blocks[0].id)).toBe(true)
  })

  it('ignores a single stray line', () => {
    const lines = projectLines([item('Only one', 72, 700)], vp(), 'p1')
    expect(groupIntoBlocks(lines)).toHaveLength(0)
  })

  it('breaks the block where the spacing jumps', () => {
    const raw = [
      item('alpha line one', 72, 700),
      item('alpha line two', 72, 686),
      item('beta line one', 72, 560),
      item('beta line two', 72, 546),
    ]
    const blocks = groupIntoBlocks(projectLines(raw, vp(), 'p1'))
    expect(blocks).toHaveLength(2)
  })

  it('detects a centred block', () => {
    const raw = [
      item('a much longer heading line', 100, 700),
      item('shorter line', 135, 686),
    ]
    const blocks = groupIntoBlocks(projectLines(raw, vp(), 'p1'))
    expect(blocks).toHaveLength(1)
    expect(blocks[0].align).toBe('center')
  })
})

describe('partialEdit', () => {
  const twoSpans = () =>
    projectLines([item('Hello ', 72, 700), item('world', 102, 700)], vp(), 'p1')[0]

  it('keeps the untouched leading span when only the tail changed', () => {
    const line = twoSpans()
    const r = partialEdit(line, 'Hello there', false)
    expect(r.keep).toBe(6)
    expect(r.offset).toBeGreaterThan(0)
  })

  it('redraws the whole run when the style changed', () => {
    const line = twoSpans()
    expect(partialEdit(line, 'Hello there', true)).toEqual({ keep: 0, offset: 0 })
  })

  it('redraws the whole run when the change is at the start', () => {
    const line = twoSpans()
    expect(partialEdit(line, 'Goodbye world', false).keep).toBe(0)
  })

  it('redraws the whole run when nothing changed', () => {
    const line = twoSpans()
    expect(partialEdit(line, line.text, false).keep).toBe(0)
  })

  it('never keeps more characters than the spans it verified', () => {
    const line = twoSpans()
    const r = partialEdit(line, 'Hello worlds', false)
    expect(line.text.slice(0, r.keep)).toBe('Hello '.slice(0, r.keep))
  })
})
