import type { ElementBase } from '../../types'

/**
 * An area whose content is removed, not merely covered. Redacting forces the
 * page to be rasterised at export, which is the only way to guarantee the
 * original text is gone from the file rather than hidden behind a rectangle.
 */
export interface RedactElement extends ElementBase {
  type: 'redact'
  x: number
  y: number
  w: number
  h: number
}

declare module '../../types' {
  interface ElementMap {
    redact: RedactElement
  }
}
