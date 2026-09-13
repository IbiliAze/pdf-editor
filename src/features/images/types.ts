import type { ElementBase } from '../../types'

/** An imported image or a signature stamp. */
export interface ImageElement extends ElementBase {
  type: 'image'
  x: number
  y: number
  w: number
  h: number
  assetId: string
  kind: 'image' | 'signature'
  opacity?: number
}

declare module '../../types' {
  interface ElementMap {
    image: ImageElement
  }
}
