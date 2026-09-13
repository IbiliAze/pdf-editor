import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib'
import type { PDFDocumentProxy } from './lib/pdfjs'

// ---------------------------------------------------------------------------
// fonts
// ---------------------------------------------------------------------------

export type FontFamily =
  | 'Helvetica'
  | 'Times'
  | 'Courier'
  | 'Arimo'
  | 'Tinos'
  | 'Cousine'
  | 'Carlito'
  | 'Caladea'
  | 'Roboto'
  | 'Open Sans'
  | 'Lato'
  | 'Montserrat'
  | 'Merriweather'
  | 'Playfair Display'
  | 'Great Vibes'

/** Font match for a text run. */
export interface FontSpec {
  family: FontFamily
  bold: boolean
  italic: boolean
}

export interface TextStyle {
  family: FontFamily
  bold: boolean
  italic: boolean
  size: number
  color: string
}

// ---------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// ---------------------------------------------------------------------------
// document / page model
// ---------------------------------------------------------------------------

/** A loaded PDF file. Several can be alive at once once pages are merged. */
export interface SourceDoc {
  id: string
  name: string
  /** pristine bytes, never handed to pdf.js (which transfers its buffer) */
  bytes: ArrayBuffer
  pdfjs: PDFDocumentProxy
  pageCount: number
  encrypted: boolean
}

export type PageSource =
  | { kind: 'pdf'; docId: string; pageIndex: number }
  | { kind: 'blank' }

export type Rotation = 0 | 90 | 180 | 270

/**
 * One page of the document being assembled. `width`/`height` are the display
 * size at scale 1 with the total rotation applied, so they swap on 90/270.
 */
export interface Page {
  id: string
  source: PageSource
  /** the source page's own /Rotate value */
  intrinsicRotation: number
  /** rotation the user added on top of the intrinsic one */
  rotation: Rotation
  width: number
  height: number
}

export const totalRotation = (p: Page): number =>
  (((p.intrinsicRotation + p.rotation) % 360) + 360) % 360

// ---------------------------------------------------------------------------
// extracted text
// ---------------------------------------------------------------------------

/** One pdf.js text item inside a line, kept so edits can keep a prefix. */
export interface Span {
  str: string
  /** x in the line's own (unrotated) frame, display units */
  x: number
  width: number
  pdfX: number
  pdfY: number
  fontName: string
}

/**
 * An editable native text run. Geometry is in scale-1 display units of the
 * page at its current rotation; for angled runs it is expressed in the run's
 * own frame, which `angle` rotates into place around (x, baseline).
 */
export interface Line {
  id: string
  pageId: string
  text: string
  spans: Span[]
  x: number
  width: number
  top: number
  height: number
  baseline: number
  fontHeight: number
  /** display-space rotation of the run in degrees, 0 for horizontal text */
  angle: number
  font: FontSpec
  /** raw pdf.js font id, used to look up the embedded font bytes */
  fontName: string
  /** raw PDF text-space origin of the run, for exact export placement */
  pdfX: number
  pdfBaseline: number
  /** run rotation in PDF space, degrees */
  pdfAngle: number
  blockId?: string
}

/** A paragraph: consecutive lines that can be re-flowed together. */
export interface TextBlock {
  id: string
  pageId: string
  lineIds: string[]
  x: number
  top: number
  width: number
  height: number
  /** baseline-to-baseline distance */
  pitch: number
  fontHeight: number
  font: FontSpec
  align: 'left' | 'center' | 'right'
  angle: number
}

// ---------------------------------------------------------------------------
// elements
// ---------------------------------------------------------------------------

export interface ElementBase {
  id: number
  pageId: string
}

/**
 * Open registry of element types. Feature modules add their own via
 * declaration merging:
 *   declare module '../../types' { interface ElementMap { shape: ShapeElement } }
 */
export interface ElementMap {}

export type ElementType = keyof ElementMap & string
export type EditorElement = ElementMap[keyof ElementMap] & ElementBase & { type: string }

// ---------------------------------------------------------------------------
// form fields
// ---------------------------------------------------------------------------

export type FormFieldType = 'text' | 'checkbox' | 'radio' | 'combo' | 'list'

export interface FormField {
  id: string
  pageId: string
  /** fully qualified field name, matches pdf-lib's getField() */
  name: string
  type: FormFieldType
  rect: Rect
  defaultValue: string | boolean | string[]
  options?: { value: string; label: string }[]
  /** the /AP on-state for this particular widget (checkbox / radio) */
  exportValue?: string
  readOnly: boolean
  multiline: boolean
  maxLen?: number
}

export type FormValue = string | boolean | string[]

// ---------------------------------------------------------------------------
// document decorations (watermark, page numbers, header/footer)
// ---------------------------------------------------------------------------

/** "all" or a 1-based page-number range expression such as "1-3, 7". */
export type PageRange = string

export interface Watermark {
  text: string
  font: FontSpec
  size: number
  color: string
  opacity: number
  angle: number
  pages: PageRange
}

export type NumberPosition = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br'

export interface PageNumbers {
  template: string
  position: NumberPosition
  font: FontSpec
  size: number
  color: string
  margin: number
  startAt: number
  pages: PageRange
}

export interface TextBand {
  left: string
  center: string
  right: string
  font: FontSpec
  size: number
  color: string
  margin: number
  pages: PageRange
}

export interface DocDecorations {
  watermark?: Watermark
  pageNumbers?: PageNumbers
  header?: TextBand
  footer?: TextBand
}

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

export interface SearchMatch {
  pageId: string
  lineId: string
  /** character offsets within the run's text */
  start: number
  end: number
  /** display-space box around the matched characters */
  rect: Rect
  angle: number
  text: string
}

// ---------------------------------------------------------------------------
// editor sessions
// ---------------------------------------------------------------------------

/** An open inline editor over a native text line. */
export interface LineSession {
  kind: 'line'
  lineId: string
  pageId: string
  text: string
  bg: string
  color: string
  /** sampled original color; a differing `color` marks a style override */
  baseColor: string
  font: FontSpec
  size: number
  /** where to put the caret on open; the whole run is selected when absent */
  caret?: number
}

/** An open editor over a whole paragraph. */
export interface BlockSession {
  kind: 'block'
  blockId: string
  pageId: string
  text: string
  bg: string
  color: string
  baseColor: string
  font: FontSpec
  size: number
  lineHeight: number
}

/** Typing inside an element that owns its own text (added text boxes, notes). */
export interface ElementSession {
  kind: 'element'
  id: number
}

export type EditSession = LineSession | BlockSession | ElementSession

export type ToolId = string

export interface Status {
  type: 'error' | 'success' | 'info'
  msg: string
}

// ---------------------------------------------------------------------------
// feature registry contracts
// ---------------------------------------------------------------------------

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface ElementEvents {
  pointerDown: (e: ReactPointerEvent, el: EditorElement) => void
  doubleClick: (e: React.MouseEvent, el: EditorElement) => void
  resizePointerDown: (e: ReactPointerEvent, el: EditorElement, handle: ResizeHandle) => void
  /** live text change inside an element that is being typed in */
  textChange: (id: number, text: string) => void
  finishTextEdit: (id: number) => void
}

export interface RenderCtx {
  zoom: number
  tool: ToolId
  page: Page
  selected: boolean
  /** true when this element is the one being typed in */
  editing: boolean
  linesById: Record<string, Line>
  blocksById: Record<string, TextBlock>
  /** lineId/blockId of an open inline session, so its cover can hide */
  hiddenLineId: string | null
  hiddenBlockId: string | null
  on: ElementEvents
}

export interface ExportCtx {
  out: PDFDocument
  page: PDFPage
  /** rotation the output page is drawn at; 0 once a page has been rasterised */
  totalRotation: number
  toPdf: (x: number, y: number) => [number, number]
  rectToPdf: (x: number, y: number, w: number, h: number) => {
    x: number
    y: number
    width: number
    height: number
  }
  embedFont: (spec: FontSpec, sample?: string, fontKey?: string) => Promise<PDFFont>
  embedImage: (assetId: string) => Promise<import('pdf-lib').PDFImage | null>
  /** reference of another output page, for in-document links */
  refForPage: (pageId: string) => import('pdf-lib').PDFRef | undefined
  linesById: Record<string, Line>
  blocksById: Record<string, TextBlock>
  modelPage: Page
}

export interface ElementKind<E extends EditorElement = EditorElement> {
  type: string
  render: (el: E, ctx: RenderCtx) => ReactNode
  draw: (el: E, ctx: ExportCtx) => Promise<void>
  /** display-space bounds, used for selection and page-rotation transforms */
  bounds?: (el: E, ctx: { linesById: Record<string, Line>; blocksById: Record<string, TextBlock> }) => Rect | null
  move?: (el: E, dx: number, dy: number) => E
  resize?: (el: E, rect: Rect) => E
  /** re-map coordinates when the page is rotated */
  rotatePage?: (el: E, t: (p: Point) => Point, from: Page, to: Page) => E
  /** elements pinned to native text cannot be dragged */
  pinned?: boolean
  /** draw order bucket; lower draws first (default 0) */
  layer?: number
}

/** What a tool does with pointer input on a page. */
export interface ToolCtx {
  page: Page
  /** pointer position in page display units */
  point: Point
  event: ReactPointerEvent<HTMLElement>
  canvas: HTMLCanvasElement | null
}

export interface ToolBehaviour {
  pointerDown?: (ctx: ToolCtx) => void
  pointerMove?: (ctx: ToolCtx) => void
  pointerUp?: (ctx: ToolCtx) => void
  /** css cursor for the page overlay */
  cursor?: string
  /** show the native text hit targets for this tool */
  showLineHits?: 'line' | 'block'
}

export interface ToolDef {
  id: ToolId
  label: string
  icon: string
  hint: string
  group: 'text' | 'annotate' | 'insert' | 'page'
  order: number
  behaviour?: ToolBehaviour
  /** hidden from the main toolbar (opened from a panel instead) */
  hidden?: boolean
}
