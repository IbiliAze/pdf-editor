import type { ElementBase } from '../../types'

/** A sticky note: a real PDF text annotation in the exported file. */
export interface NoteElement extends ElementBase {
  type: 'note'
  x: number
  y: number
  text: string
  color: string
  author?: string
  open?: boolean
}

export type LinkTarget =
  | { kind: 'url'; url: string }
  | { kind: 'page'; pageId: string }

/** A clickable area: a real PDF link annotation in the exported file. */
export interface LinkElement extends ElementBase {
  type: 'link'
  x: number
  y: number
  w: number
  h: number
  target: LinkTarget
  /** draw a visible border around the link */
  border?: boolean
}

declare module '../../types' {
  interface ElementMap {
    note: NoteElement
    link: LinkElement
  }
}
