import type { Page, Point, Rect, Rotation } from '../types'

export const DEG = Math.PI / 180

/** Normalize a rectangle so width/height are positive. */
export function normRect<T extends Rect>(r: T): T {
  let { x, y, w, h } = r
  if (w < 0) {
    x += w
    w = -w
  }
  if (h < 0) {
    y += h
    h = -h
  }
  return { ...r, x, y, w, h }
}

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export const pointInRect = (p: Point, r: Rect, pad = 0): boolean =>
  p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad

export function unionRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of rects) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * Map a point from a page's display space into the display space it will have
 * after rotating the page by `delta` degrees clockwise. `w`/`h` are the page
 * size *before* the rotation.
 */
export function rotatePointForPage(p: Point, delta: number, w: number, h: number): Point {
  const d = ((delta % 360) + 360) % 360
  if (d === 90) return { x: h - p.y, y: p.x }
  if (d === 180) return { x: w - p.x, y: h - p.y }
  if (d === 270) return { x: p.y, y: w - p.x }
  return { ...p }
}

/** Same as rotatePointForPage but for an axis-aligned rectangle. */
export function rotateRectForPage(r: Rect, delta: number, w: number, h: number): Rect {
  const a = rotatePointForPage({ x: r.x, y: r.y }, delta, w, h)
  const b = rotatePointForPage({ x: r.x + r.w, y: r.y + r.h }, delta, w, h)
  return normRect({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y })
}

/** Page size after applying `delta` degrees of extra rotation. */
export function rotatedSize(page: Page, delta: number): { width: number; height: number } {
  const d = ((delta % 360) + 360) % 360
  return d === 90 || d === 270
    ? { width: page.height, height: page.width }
    : { width: page.width, height: page.height }
}

export const addRotation = (r: Rotation, delta: number): Rotation =>
  ((((r + delta) % 360) + 360) % 360) as Rotation

/** Rotate a vector by `deg` degrees clockwise in a y-down space. */
export function rotateVec(x: number, y: number, deg: number): Point {
  if (!deg) return { x, y }
  const a = deg * DEG
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: x * c - y * s, y: x * s + y * c }
}

/** Inverse of rotateVec. */
export function unrotateVec(x: number, y: number, deg: number): Point {
  return rotateVec(x, y, -deg)
}
