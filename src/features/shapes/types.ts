import type { ElementBase } from '../../types'

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow'

/**
 * A vector shape. `w`/`h` stay signed for lines and arrows, because their sign
 * is the direction the line was drawn in.
 */
export interface ShapeElement extends ElementBase {
  type: 'shape'
  shape: ShapeKind
  x: number
  y: number
  w: number
  h: number
  color: string
  strokeWidth: number
  fill: string | null
  opacity: number
}

declare module '../../types' {
  interface ElementMap {
    shape: ShapeElement
  }
}
