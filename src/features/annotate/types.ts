import type { ElementBase, FontSpec, Point } from '../../types'

/** A user-added text box. */
export interface TextElement extends ElementBase {
  type: 'text'
  x: number
  y: number
  w: number
  text: string
  size: number
  color: string
  font: FontSpec
  align?: 'left' | 'center' | 'right'
}

export interface WhiteoutElement extends ElementBase {
  type: 'whiteout'
  x: number
  y: number
  w: number
  h: number
  /** fill colour; white unless sampled from the page */
  color?: string
}

export interface HighlightElement extends ElementBase {
  type: 'highlight'
  x: number
  y: number
  w: number
  h: number
  color: string
}

export interface PathElement extends ElementBase {
  type: 'path'
  points: Point[]
  color: string
  width: number
  /** highlighter pens draw translucent and multiply */
  marker?: boolean
}

declare module '../../types' {
  interface ElementMap {
    text: TextElement
    whiteout: WhiteoutElement
    highlight: HighlightElement
    path: PathElement
  }
}
