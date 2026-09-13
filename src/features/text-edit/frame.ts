import type { CSSProperties } from 'react'
import { framePoint } from '../../lib/textLayer'

/**
 * Absolute placement for a box expressed in a run's own frame: (u, v) is its
 * top-left corner along/across the baseline, and the box is rotated with the
 * run around that corner.
 */
export function frameBoxStyle(
  anchor: { angle: number },
  u: number,
  v: number,
  zoom: number,
  w: number,
  h: number,
): CSSProperties {
  const origin = framePoint(anchor, u, v)
  const style: CSSProperties = {
    left: origin.x * zoom,
    top: origin.y * zoom,
    width: w * zoom,
    height: h * zoom,
  }
  if (anchor.angle) {
    style.transform = `rotate(${anchor.angle}deg)`
    style.transformOrigin = '0 0'
  }
  return style
}
