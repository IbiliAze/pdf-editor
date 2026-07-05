import type { PointerEvent as ReactPointerEvent } from 'react'

export type FontFamily =
  | 'Helvetica'
  | 'Times'
  | 'Courier'
  | 'Roboto'
  | 'Open Sans'
  | 'Lato'
  | 'Montserrat'
  | 'Merriweather'
  | 'Playfair Display'

/** Font match for a text run: one of the 14 standard PDF fonts. */
export interface FontSpec {
  family: FontFamily
  bold: boolean
  italic: boolean
}

export interface Point {
  x: number
  y: number
}

/**
 * An editable native text run extracted from the PDF. All geometry is in
 * scale-1 viewport units (CSS px at 100% zoom == PDF points). pdfX and
 * pdfBaseline are the run's raw PDF text-space origin, used at export so
 * replacement text lands exactly on the original baseline.
 */
export interface Line {
  id: string
  pageIndex: number
  text: string
  x: number
  width: number
  top: number
  height: number
  baseline: number
  fontHeight: number
  font: FontSpec
  pdfX: number
  pdfBaseline: number
}

export interface PageInfo {
  pageIndex: number
  width: number
  height: number
  lines: Line[]
}

interface ElementBase {
  id: number
  pageIndex: number
}

/** A committed replacement of a native text line (cover + redraw on export). */
export interface EditElement extends ElementBase {
  type: 'edit'
  lineId: string
  text: string
  /** sampled page background color the cover rectangle is painted with */
  bg: string
  /** current text color (sampled original unless the user restyled it) */
  color: string
  /** the sampled original color, kept to detect color overrides */
  baseColor?: string
  /** style overrides; the original line's font/size apply when absent */
  font?: FontSpec
  size?: number
}

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
}

export interface WhiteoutElement extends ElementBase {
  type: 'whiteout'
  x: number
  y: number
  w: number
  h: number
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
}

export type EditorElement =
  | EditElement
  | TextElement
  | WhiteoutElement
  | HighlightElement
  | PathElement

/** Shape being dragged out right now (not yet committed to elements). */
export type LiveDraw = WhiteoutElement | HighlightElement | PathElement

/** An open inline editor over a native text line. */
export interface EditingSession {
  lineId: string
  pageIndex: number
  text: string
  bg: string
  color: string
  /** sampled original color; a differing `color` marks a style override */
  baseColor: string
  font: FontSpec
  size: number
}

export type ToolId = 'edittext' | 'text' | 'select' | 'whiteout' | 'highlight' | 'pen'

export interface TextStyle {
  family: FontFamily
  bold: boolean
  italic: boolean
  size: number
  color: string
}

export interface Status {
  type: 'error' | 'success' | 'info'
  msg: string
}

/**
 * Callbacks PageView and its children invoke; implemented in App.tsx.
 * Pointer events (not mouse events) so touch input works on mobile.
 */
export interface PageHandlers {
  pagePointerDown: (e: ReactPointerEvent<HTMLDivElement>, page: PageInfo) => void
  pagePointerMove: (e: ReactPointerEvent<HTMLDivElement>, page: PageInfo) => void
  pagePointerUp: () => void
  pagePointerLeave: () => void
  lineClick: (line: Line, canvas: HTMLCanvasElement | null, page: PageInfo | null) => void
  lineEditChange: (text: string) => void
  commitLineEdit: () => void
  cancelLineEdit: () => void
  elementPointerDown: (e: ReactPointerEvent, el: EditorElement) => void
  resizePointerDown: (e: ReactPointerEvent, el: TextElement) => void
  elementDoubleClick: (el: EditorElement) => void
  elementTextChange: (id: number, text: string) => void
  finishElementEdit: (id: number) => void
}
