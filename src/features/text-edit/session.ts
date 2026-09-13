import { store } from '../../store'
import { nid } from '../../lib/ids'
import { lineBBox, partialEdit, sampleRectColors } from '../../lib/textLayer'
import { measureText } from '../../lib/fonts'
import { unionRect } from '../../lib/geometry'
import type { BlockSession, FontSpec, Line, LineSession, TextBlock } from '../../types'
import type { BlockEditElement, EditElement } from './types'

/** Character index nearest to `offset` display units into the run. */
function caretIndexAt(text: string, offset: number, size: number, font: FontSpec): number {
  if (offset <= 0) return 0
  let best = 0
  let bestDelta = Infinity
  for (let i = 0; i <= text.length; i++) {
    const w = measureText(text.slice(0, i), size, font)
    const delta = Math.abs(w - offset)
    if (delta < bestDelta) {
      bestDelta = delta
      best = i
    } else if (w > offset) {
      break
    }
  }
  return best
}

const findEdit = (lineId: string): EditElement | undefined =>
  store.get().elements.find((el): el is EditElement => el.type === 'edit' && el.lineId === lineId)

const findBlockEdit = (blockId: string): BlockEditElement | undefined =>
  store
    .get()
    .elements.find(
      (el): el is BlockEditElement => el.type === 'blockedit' && el.blockId === blockId,
    )

/** The block edit covering a line, if any. */
export const blockEditForLine = (line: Line): BlockEditElement | undefined =>
  line.blockId ? findBlockEdit(line.blockId) : undefined

export function startLineEdit(
  line: Line,
  canvas: HTMLCanvasElement | null,
  pageWidth: number,
  /** distance along the baseline that was clicked, for caret placement */
  caretU?: number,
): void {
  const s = store.get()
  if (s.session) commitSession()
  const existing = findEdit(line.id)
  let bg = '#ffffff'
  let color = '#111827'
  let baseColor = '#111827'
  if (existing) {
    bg = existing.bg
    color = existing.color
    baseColor = existing.baseColor ?? existing.color
  } else if (canvas && pageWidth) {
    const sampled = sampleRectColors(canvas, lineBBox(line), canvas.width / pageWidth)
    bg = sampled.bg
    color = sampled.color
    baseColor = sampled.color
  }
  const font = existing?.font ?? line.font
  const size = existing?.size ?? line.fontHeight
  const text = existing ? existing.text : line.text
  const session: LineSession = {
    kind: 'line',
    lineId: line.id,
    pageId: line.pageId,
    text,
    bg,
    color,
    baseColor,
    font,
    size,
    caret: caretU == null ? undefined : caretIndexAt(text, caretU - line.x, size, font),
  }
  store.set({ session, selectedIds: [] })
}

export function startBlockEdit(
  block: TextBlock,
  lines: Line[],
  canvas: HTMLCanvasElement | null,
  pageWidth: number,
): void {
  const s = store.get()
  if (s.session) commitSession()
  const existing = findBlockEdit(block.id)
  let bg = '#ffffff'
  let color = '#111827'
  let baseColor = '#111827'
  if (existing) {
    bg = existing.bg
    color = existing.color
    baseColor = existing.baseColor ?? existing.color
  } else if (canvas && pageWidth) {
    const box = unionRect(lines.map(lineBBox))
    if (box) {
      const sampled = sampleRectColors(canvas, box, canvas.width / pageWidth)
      bg = sampled.bg
      color = sampled.color
      baseColor = sampled.color
    }
  }
  const session: BlockSession = {
    kind: 'block',
    blockId: block.id,
    pageId: block.pageId,
    text: existing ? existing.text : lines.map((l) => l.text).join(' '),
    bg,
    color,
    baseColor,
    font: existing?.font ?? block.font,
    size: existing?.size ?? block.fontHeight,
    lineHeight: existing?.pitch ?? block.pitch,
  }
  store.set({ session, selectedIds: [] })
}

/** Commit whichever inline text session is open. Safe to call at any time. */
export function commitSession(): void {
  const session = store.get().session
  if (!session) return
  if (session.kind === 'line') commitLineSession(session)
  else if (session.kind === 'block') commitBlockSession(session)
  else store.set({ session: null })
}

function commitLineSession(s: LineSession): void {
  const state = store.get()
  store.set({ session: null })
  const line = state.pageText[s.pageId]?.lines.find((l) => l.id === s.lineId)
  if (!line) return

  const fontDirty =
    s.font.family !== line.font.family ||
    s.font.bold !== line.font.bold ||
    s.font.italic !== line.font.italic
  const sizeDirty = Math.abs(s.size - line.fontHeight) > 0.01
  const colorDirty = s.color !== s.baseColor
  const dirty = s.text !== line.text || fontDirty || sizeDirty || colorDirty

  const existing = findEdit(s.lineId)
  const id = existing?.id ?? nid()

  state.commit((snap) => {
    const others = snap.elements.filter(
      (el) => !(el.type === 'edit' && (el as EditElement).lineId === s.lineId),
    )
    if (!dirty) return others.length === snap.elements.length ? snap : { ...snap, elements: others }
    const { keep, offset } = partialEdit(line, s.text, fontDirty || sizeDirty || colorDirty)
    const edit: EditElement = {
      id,
      type: 'edit',
      lineId: s.lineId,
      pageId: s.pageId,
      text: s.text,
      bg: s.bg,
      color: s.color,
      baseColor: s.baseColor,
      keep,
      coverOffset: offset,
    }
    if (fontDirty) edit.font = s.font
    if (sizeDirty) edit.size = s.size
    return { ...snap, elements: [...others, edit] }
  })
  // Keep the committed edit selected so toolbar style controls (which blur and
  // thereby close the inline editor) still have a target to apply to.
  store.set({ selectedIds: dirty ? [id] : [] })
}

function commitBlockSession(s: BlockSession): void {
  const state = store.get()
  store.set({ session: null })
  const block = state.pageText[s.pageId]?.blocks.find((b) => b.id === s.blockId)
  if (!block) return
  const lines = state.pageText[s.pageId]?.lines ?? []
  const original = block.lineIds
    .map((id) => lines.find((l) => l.id === id)?.text ?? '')
    .join(' ')

  const fontDirty =
    s.font.family !== block.font.family ||
    s.font.bold !== block.font.bold ||
    s.font.italic !== block.font.italic
  const sizeDirty = Math.abs(s.size - block.fontHeight) > 0.01
  const colorDirty = s.color !== s.baseColor
  const dirty = s.text !== original || fontDirty || sizeDirty || colorDirty

  const existing = findBlockEdit(s.blockId)
  const id = existing?.id ?? nid()
  const lineIds = new Set(block.lineIds)

  state.commit((snap) => {
    // A paragraph edit supersedes any single-line edits inside it.
    const others = snap.elements.filter(
      (el) =>
        !(el.type === 'blockedit' && (el as BlockEditElement).blockId === s.blockId) &&
        !(el.type === 'edit' && lineIds.has((el as EditElement).lineId)),
    )
    if (!dirty) return others.length === snap.elements.length ? snap : { ...snap, elements: others }
    const edit: BlockEditElement = {
      id,
      type: 'blockedit',
      blockId: s.blockId,
      pageId: s.pageId,
      text: s.text,
      bg: s.bg,
      color: s.color,
      baseColor: s.baseColor,
    }
    if (fontDirty) edit.font = s.font
    if (sizeDirty) edit.size = s.size
    if (Math.abs(s.lineHeight - block.pitch) > 0.01) edit.pitch = s.lineHeight
    return { ...snap, elements: [...others, edit] }
  })
  store.set({ selectedIds: dirty ? [id] : [] })
}

export function cancelSession(): void {
  store.set({ session: null })
}

export function updateSessionText(text: string): void {
  const session = store.get().session
  if (!session || session.kind === 'element') return
  store.set({ session: { ...session, text } })
}
