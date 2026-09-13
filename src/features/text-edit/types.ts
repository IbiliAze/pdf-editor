import type { ElementBase, FontSpec } from '../../types'

/** A committed replacement of a native text run (cover + redraw on export). */
export interface EditElement extends ElementBase {
  type: 'edit'
  lineId: string
  text: string
  /** sampled page background the cover rectangle is painted with */
  bg: string
  /** current text color (the sampled original unless the user restyled it) */
  color: string
  /** the sampled original color, kept to detect color overrides */
  baseColor?: string
  /** style overrides; the original run's font/size apply when absent */
  font?: FontSpec
  size?: number
  /** leading characters of the original run left untouched */
  keep?: number
  /** distance along the baseline where the cover and redraw start */
  coverOffset?: number
}

/** A committed replacement of a whole paragraph, re-flowed to its width. */
export interface BlockEditElement extends ElementBase {
  type: 'blockedit'
  blockId: string
  text: string
  bg: string
  color: string
  baseColor?: string
  font?: FontSpec
  size?: number
  /** baseline-to-baseline distance override */
  pitch?: number
}

declare module '../../types' {
  interface ElementMap {
    edit: EditElement
    blockedit: BlockEditElement
  }
}
