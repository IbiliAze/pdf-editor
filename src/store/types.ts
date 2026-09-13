import type {
  DocDecorations,
  EditSession,
  EditorElement,
  FormField,
  FormValue,
  Line,
  Page,
  Rect,
  SourceDoc,
  Status,
  TextBlock,
  TextStyle,
  ToolId,
} from '../types'

/** Everything undo/redo restores together. */
export interface Snapshot {
  pages: Page[]
  elements: EditorElement[]
  formValues: Record<string, FormValue>
  decorations: DocDecorations
}

export interface PageText {
  lines: Line[]
  blocks: TextBlock[]
}

export interface ShapeStyle {
  stroke: string
  strokeWidth: number
  fill: string | null
  opacity: number
}

export interface DocumentSlice {
  sources: Record<string, SourceDoc>
  pages: Page[]
  /** extracted text per page id; filled lazily as pages come into view */
  pageText: Record<string, PageText>
  pendingText: Record<string, boolean>
  formFields: Record<string, FormField[]>
  fileName: string
  loading: boolean

  openFile: (file: File) => Promise<void>
  addSource: (file: File, afterPageId?: string | null) => Promise<number>
  ensurePageText: (pageId: string) => Promise<void>
  ensureAllPageText: (onProgress?: (done: number, total: number) => void) => Promise<void>
  invalidatePageText: (pageIds: string[]) => void
  closeDocument: () => void
}

export interface ElementsSlice {
  elements: EditorElement[]
  formValues: Record<string, FormValue>
  decorations: DocDecorations
  past: Snapshot[]
  future: Snapshot[]

  snapshot: () => Snapshot
  /** apply an update and record the previous state as an undo step */
  commit: (update: (s: Snapshot) => Snapshot) => void
  /** apply an update without touching history (live typing, drags) */
  setNow: (update: (s: Snapshot) => Snapshot) => void
  /** record the current state as an undo step before a series of setNow calls */
  pushHistory: () => void
  undo: () => boolean
  redo: () => boolean
  resetHistory: () => void

  addElement: (el: EditorElement, opts?: { select?: boolean }) => void
  updateElement: (id: number, patch: (el: EditorElement) => EditorElement, live?: boolean) => void
  removeElements: (ids: number[]) => void
  setFormValue: (name: string, value: FormValue) => void
  setDecorations: (patch: Partial<DocDecorations>) => void
}

export interface EditorSlice {
  tool: ToolId
  selectedIds: number[]
  session: EditSession | null
  liveDraw: EditorElement | null
  marquee: Rect | null
  textStyle: TextStyle
  shapeStyle: ShapeStyle

  setTool: (id: ToolId) => void
  setSelection: (ids: number[]) => void
  toggleSelected: (id: number) => void
  clearSelection: () => void
  setSession: (s: EditSession | null) => void
  setLiveDraw: (el: EditorElement | null) => void
  setMarquee: (r: Rect | null) => void
  setTextStyle: (patch: Partial<TextStyle>) => void
  setShapeStyle: (patch: Partial<ShapeStyle>) => void
}

export type PanelId = 'pages' | 'search' | 'document' | null

export interface UiSlice {
  zoom: number
  fitMode: 'none' | 'width'
  sidebarOpen: boolean
  panel: PanelId
  activePageId: string | null
  status: Status | null
  showFormFields: boolean

  setZoom: (z: number) => void
  zoomStep: (dir: 1 | -1) => void
  setFitMode: (m: 'none' | 'width') => void
  setSidebarOpen: (open: boolean) => void
  setPanel: (p: PanelId) => void
  setActivePageId: (id: string | null) => void
  setStatus: (s: Status | null) => void
  setShowFormFields: (v: boolean) => void
}

export type EditorStore = DocumentSlice & ElementsSlice & EditorSlice & UiSlice
