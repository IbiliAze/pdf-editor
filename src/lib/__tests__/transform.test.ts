import { describe, expect, it } from 'vitest'
import { apply, invert, rectToPdfWith, viewSize, viewTransform } from '../export/transform'
import type { ViewBox } from '../export/transform'

const BOX: ViewBox = [0, 0, 600, 800]

describe('viewTransform', () => {
  it('flips the y axis for an unrotated page', () => {
    const m = viewTransform(BOX, 0)
    expect(apply(m, 0, 800)).toEqual([0, 0])
    expect(apply(m, 0, 0)).toEqual([0, 800])
    expect(apply(m, 600, 0)).toEqual([600, 800])
  })

  it('matches the display size pdf.js reports for each rotation', () => {
    expect(viewSize(BOX, 0)).toEqual({ width: 600, height: 800 })
    expect(viewSize(BOX, 90)).toEqual({ width: 800, height: 600 })
    expect(viewSize(BOX, 180)).toEqual({ width: 600, height: 800 })
    expect(viewSize(BOX, 270)).toEqual({ width: 800, height: 600 })
  })

  it('puts the PDF origin at a different display corner per rotation', () => {
    // PDF (0,0) is the bottom-left of the unrotated page.
    expect(apply(viewTransform(BOX, 0), 0, 0)).toEqual([0, 800])
    expect(apply(viewTransform(BOX, 90), 0, 0)).toEqual([0, 0])
    expect(apply(viewTransform(BOX, 180), 0, 0)).toEqual([600, 0])
    expect(apply(viewTransform(BOX, 270), 0, 0)).toEqual([800, 600])
  })

  it('round-trips display and PDF coordinates at every rotation', () => {
    for (const rot of [0, 90, 180, 270]) {
      const m = viewTransform(BOX, rot)
      const inv = invert(m)
      const [dx, dy] = apply(m, 123, 456)
      const [px, py] = apply(inv, dx, dy)
      expect(px).toBeCloseTo(123)
      expect(py).toBeCloseTo(456)
    }
  })

  it('honours a view box that does not start at the origin', () => {
    const offset: ViewBox = [20, 30, 620, 830]
    const m = viewTransform(offset, 0)
    // The lower-left of the crop box is the bottom-left of the display area.
    expect(apply(m, 20, 30)).toEqual([0, 800])
    const inv = invert(m)
    expect(apply(inv, 0, 0)).toEqual([20, 830])
  })
})

describe('rectToPdfWith', () => {
  it('normalises a display rect into PDF space', () => {
    const inv = invert(viewTransform(BOX, 0))
    expect(rectToPdfWith(inv, 100, 200, 50, 20)).toEqual({
      x: 100,
      y: 580,
      width: 50,
      height: 20,
    })
  })

  it('stays axis-aligned and positive on a quarter-turned page', () => {
    const inv = invert(viewTransform(BOX, 90))
    const r = rectToPdfWith(inv, 100, 200, 50, 20)
    expect(r.width).toBeCloseTo(20)
    expect(r.height).toBeCloseTo(50)
    expect(r.width).toBeGreaterThan(0)
    expect(r.height).toBeGreaterThan(0)
  })
})
