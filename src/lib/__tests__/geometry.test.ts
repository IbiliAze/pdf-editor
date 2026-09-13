import { describe, expect, it } from 'vitest'
import {
  addRotation,
  normRect,
  pointInRect,
  rectsOverlap,
  rotatePointForPage,
  rotateRectForPage,
  unionRect,
} from '../geometry'

const W = 600
const H = 800

describe('rotatePointForPage', () => {
  it('sends the top-left corner to the top-right on a quarter turn', () => {
    expect(rotatePointForPage({ x: 0, y: 0 }, 90, W, H)).toEqual({ x: 800, y: 0 })
    expect(rotatePointForPage({ x: W, y: 0 }, 90, W, H)).toEqual({ x: 800, y: 600 })
  })

  it('sends the top-left corner to the bottom-left turning the other way', () => {
    expect(rotatePointForPage({ x: 0, y: 0 }, -90, W, H)).toEqual({ x: 0, y: 600 })
  })

  it('mirrors both axes on a half turn', () => {
    expect(rotatePointForPage({ x: 10, y: 20 }, 180, W, H)).toEqual({ x: 590, y: 780 })
  })

  it('returns to the start after four quarter turns', () => {
    let p = { x: 123, y: 456 }
    let w = W
    let h = H
    for (let i = 0; i < 4; i++) {
      p = rotatePointForPage(p, 90, w, h)
      ;[w, h] = [h, w]
    }
    expect(p).toEqual({ x: 123, y: 456 })
  })

  it('leaves a point alone for a zero or full turn', () => {
    expect(rotatePointForPage({ x: 5, y: 6 }, 0, W, H)).toEqual({ x: 5, y: 6 })
    expect(rotatePointForPage({ x: 5, y: 6 }, 360, W, H)).toEqual({ x: 5, y: 6 })
  })
})

describe('rotateRectForPage', () => {
  it('swaps width and height on a quarter turn and stays positive', () => {
    const r = rotateRectForPage({ x: 10, y: 20, w: 100, h: 40 }, 90, W, H)
    expect(r.w).toBe(40)
    expect(r.h).toBe(100)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
  })

  it('keeps a rect inside the rotated page', () => {
    const r = rotateRectForPage({ x: 0, y: 0, w: W, h: H }, 90, W, H)
    expect(r).toEqual({ x: 0, y: 0, w: H, h: W })
  })
})

describe('rect helpers', () => {
  it('normalises negative sizes', () => {
    expect(normRect({ x: 10, y: 10, w: -4, h: -6 })).toEqual({ x: 6, y: 4, w: 4, h: 6 })
  })

  it('detects overlap but not mere touching at a distance', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    expect(rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
    expect(rectsOverlap(a, { x: 20, y: 0, w: 5, h: 5 })).toBe(false)
  })

  it('tests point containment with an optional margin', () => {
    const r = { x: 0, y: 0, w: 10, h: 10 }
    expect(pointInRect({ x: 5, y: 5 }, r)).toBe(true)
    expect(pointInRect({ x: 11, y: 5 }, r)).toBe(false)
    expect(pointInRect({ x: 11, y: 5 }, r, 2)).toBe(true)
  })

  it('unions rects and returns null for none', () => {
    expect(unionRect([])).toBeNull()
    expect(unionRect([{ x: 0, y: 0, w: 5, h: 5 }, { x: 10, y: 2, w: 5, h: 20 }])).toEqual({
      x: 0,
      y: 0,
      w: 15,
      h: 22,
    })
  })
})

describe('addRotation', () => {
  it('wraps in both directions', () => {
    expect(addRotation(270, 90)).toBe(0)
    expect(addRotation(0, -90)).toBe(270)
    expect(addRotation(180, 180)).toBe(0)
  })
})
