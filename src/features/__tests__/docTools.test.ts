import { describe, expect, it } from 'vitest'
import { fillTemplate, numberSlot } from '../doc-tools/decorations'
import { normalizeUrl } from '../annotations'

describe('fillTemplate', () => {
  it('fills the page number and the total', () => {
    expect(fillTemplate('Page {n} of {N}', 0, 3, 'report')).toBe('Page 1 of 3')
    expect(fillTemplate('Page {n} of {N}', 2, 3, 'report')).toBe('Page 3 of 3')
  })

  it('offsets both numbers when numbering starts elsewhere', () => {
    expect(fillTemplate('{n}/{N}', 0, 3, 'report', 5)).toBe('5/7')
  })

  it('fills the file name and leaves unknown braces alone', () => {
    expect(fillTemplate('{filename} — {chapter}', 0, 1, 'report')).toBe('report — {chapter}')
  })

  it('handles an empty template', () => {
    expect(fillTemplate('', 0, 1, 'report')).toBe('')
  })
})

describe('numberSlot', () => {
  const W = 600
  const H = 800

  it('puts a top position at the margin and a bottom one near the foot', () => {
    expect(numberSlot('tc', W, H, 30, 10).y).toBe(30)
    expect(numberSlot('bc', W, H, 30, 10).y).toBeCloseTo(800 - 30 - 12)
  })

  it('derives the alignment from the corner', () => {
    expect(numberSlot('tl', W, H, 30, 10).align).toBe('left')
    expect(numberSlot('tc', W, H, 30, 10).align).toBe('center')
    expect(numberSlot('br', W, H, 30, 10).align).toBe('right')
  })

  it('spans the page between the margins', () => {
    const slot = numberSlot('bc', W, H, 30, 10)
    expect(slot.x).toBe(30)
    expect(slot.width).toBe(540)
  })
})

describe('normalizeUrl', () => {
  it('leaves a full address alone', () => {
    expect(normalizeUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(normalizeUrl('mailto:a@example.com')).toBe('mailto:a@example.com')
  })

  it('assumes https for a bare domain', () => {
    expect(normalizeUrl('example.com/handbook')).toBe('https://example.com/handbook')
    expect(normalizeUrl('//example.com')).toBe('https://example.com')
  })
})
