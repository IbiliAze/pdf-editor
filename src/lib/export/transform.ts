/**
 * Display <-> PDF user space conversion.
 *
 * The matrix is built exactly the way pdf.js builds a PageViewport transform,
 * so coordinates captured over a rendered page convert back to the same PDF
 * points. Blank pages get the same treatment with a synthetic view box.
 */
export type Matrix = [number, number, number, number, number, number]

export type ViewBox = [number, number, number, number]

export function viewTransform(viewBox: ViewBox, rotation: number, scale = 1): Matrix {
  const rot = ((rotation % 360) + 360) % 360
  let a = 1
  let b = 0
  let c = 0
  let d = -1
  if (rot === 180) {
    a = -1
    b = 0
    c = 0
    d = 1
  } else if (rot === 90) {
    a = 0
    b = 1
    c = 1
    d = 0
  } else if (rot === 270) {
    a = 0
    b = -1
    c = -1
    d = 0
  }

  const centerX = (viewBox[0] + viewBox[2]) / 2
  const centerY = (viewBox[1] + viewBox[3]) / 2
  let offsetX: number
  let offsetY: number
  if (a === 0) {
    offsetX = Math.abs(centerY - viewBox[1]) * scale
    offsetY = Math.abs(centerX - viewBox[0]) * scale
  } else {
    offsetX = Math.abs(centerX - viewBox[0]) * scale
    offsetY = Math.abs(centerY - viewBox[1]) * scale
  }

  return [
    a * scale,
    b * scale,
    c * scale,
    d * scale,
    offsetX - a * scale * centerX - c * scale * centerY,
    offsetY - b * scale * centerX - d * scale * centerY,
  ]
}

export function viewSize(viewBox: ViewBox, rotation: number, scale = 1): { width: number; height: number } {
  const rot = ((rotation % 360) + 360) % 360
  const w = Math.abs(viewBox[2] - viewBox[0]) * scale
  const h = Math.abs(viewBox[3] - viewBox[1]) * scale
  return rot === 90 || rot === 270 ? { width: h, height: w } : { width: w, height: h }
}

export function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2]
  if (!det) return [1, 0, 0, 1, 0, 0]
  const a = m[3] / det
  const b = -m[1] / det
  const c = -m[2] / det
  const d = m[0] / det
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])]
}

export const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
]

/** Convert a display-space rect to an axis-aligned PDF-space rect. */
export function rectToPdfWith(
  inv: Matrix,
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number } {
  const [ax, ay] = apply(inv, x, y)
  const [bx, by] = apply(inv, x + w, y + h)
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(ax - bx),
    height: Math.abs(ay - by),
  }
}
