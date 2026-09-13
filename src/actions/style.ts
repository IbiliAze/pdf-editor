import { store } from '../store'
import type { EditorStore } from '../store/types'
import type { EditorElement, FontSpec, TextStyle } from '../types'

interface Styled {
  font?: FontSpec
  size?: number
  color?: string
}

/**
 * The style the toolbar controls should show. Pure in the store state so it
 * can be used as a shallow-compared selector as well as imperatively.
 */
export function shownStyleFrom(s: EditorStore): TextStyle {
  if (s.session && s.session.kind !== 'element') {
    return {
      family: s.session.font.family,
      bold: s.session.font.bold,
      italic: s.session.font.italic,
      size: Math.round(s.session.size),
      color: s.session.color,
    }
  }
  const sel = s.elements.find((el) => s.selectedIds.includes(el.id))
  if (sel) {
    const style = styleOfElement(s, sel)
    if (style) return style
  }
  return s.textStyle
}

export const shownStyle = (): TextStyle => shownStyleFrom(store.get())

function styleOfElement(s: EditorStore, el: EditorElement): TextStyle | null {
  const e = el as EditorElement & Styled & { lineId?: string; blockId?: string }
  if (el.type === 'text') {
    return {
      family: e.font!.family,
      bold: e.font!.bold,
      italic: e.font!.italic,
      size: e.size!,
      color: e.color!,
    }
  }
  if (el.type === 'edit') {
    const line = s.pageText[el.pageId]?.lines.find((l) => l.id === e.lineId)
    const font = e.font ?? line?.font
    return {
      family: font?.family ?? s.textStyle.family,
      bold: font?.bold ?? false,
      italic: font?.italic ?? false,
      size: Math.round(e.size ?? line?.fontHeight ?? s.textStyle.size),
      color: e.color ?? s.textStyle.color,
    }
  }
  if (el.type === 'blockedit') {
    const block = s.pageText[el.pageId]?.blocks.find((b) => b.id === e.blockId)
    const font = e.font ?? block?.font
    return {
      family: font?.family ?? s.textStyle.family,
      bold: font?.bold ?? false,
      italic: font?.italic ?? false,
      size: Math.round(e.size ?? block?.fontHeight ?? s.textStyle.size),
      color: e.color ?? s.textStyle.color,
    }
  }
  return null
}

/**
 * Apply a style change. An open inline session takes priority and is restyled
 * live; otherwise the change lands on the selected elements, and always on the
 * defaults used for the next thing the user adds.
 */
export function applyStyle(patch: Partial<TextStyle>): void {
  const s = store.get()
  s.setTextStyle(patch)

  const session = s.session
  if (session && session.kind !== 'element') {
    store.set({
      session: {
        ...session,
        font: {
          family: patch.family ?? session.font.family,
          bold: patch.bold ?? session.font.bold,
          italic: patch.italic ?? session.font.italic,
        },
        size: patch.size ?? session.size,
        color: patch.color ?? session.color,
      },
    })
    return
  }

  if (!s.selectedIds.length) return
  const ids = new Set(s.selectedIds)
  s.commit((snap) => ({
    ...snap,
    elements: snap.elements.map((el) => (ids.has(el.id) ? restyle(s, el, patch) : el)),
  }))
}

const COLORABLE = ['path', 'highlight', 'shape', 'note']

function restyle(s: EditorStore, el: EditorElement, patch: Partial<TextStyle>): EditorElement {
  const e = el as EditorElement & Styled
  if (el.type === 'text' || el.type === 'edit' || el.type === 'blockedit') {
    const fallback =
      e.font ?? { family: s.textStyle.family, bold: false, italic: false }
    const next = {
      ...el,
      font: {
        family: patch.family ?? fallback.family,
        bold: patch.bold ?? fallback.bold,
        italic: patch.italic ?? fallback.italic,
      },
    } as EditorElement & Styled
    if (patch.size != null) next.size = patch.size
    if (patch.color != null) next.color = patch.color
    return next as EditorElement
  }
  if (patch.color != null && COLORABLE.includes(el.type)) {
    return { ...el, color: patch.color } as EditorElement
  }
  return el
}
