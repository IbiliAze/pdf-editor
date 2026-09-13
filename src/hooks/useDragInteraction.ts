import { useEffect } from 'react'
import { store } from '../store'
import { kindOf } from '../features/registry'
import { boundsOf } from '../actions/elements'
import type { EditorElement, Rect, ResizeHandle } from '../types'

interface DragState {
  mode: 'move' | 'resize'
  ids: number[]
  handle?: ResizeHandle
  startX: number
  startY: number
  base: EditorElement[]
  baseBounds: Record<number, Rect>
  moved: boolean
  aspect?: number
}

let drag: DragState | null = null

export function beginMove(e: { clientX: number; clientY: number }, ids: number[]): void {
  const s = store.get()
  drag = {
    mode: 'move',
    ids,
    startX: e.clientX,
    startY: e.clientY,
    base: s.elements,
    baseBounds: {},
    moved: false,
  }
}

export function beginResize(
  e: { clientX: number; clientY: number },
  el: EditorElement,
  handle: ResizeHandle,
): void {
  const s = store.get()
  const b = boundsOf(el)
  if (!b) return
  drag = {
    mode: 'resize',
    ids: [el.id],
    handle,
    startX: e.clientX,
    startY: e.clientY,
    base: s.elements,
    baseBounds: { [el.id]: b },
    moved: false,
    aspect: b.h ? b.w / b.h : undefined,
  }
}

export const isDragging = (): boolean => !!drag

function resizeRect(base: Rect, handle: ResizeHandle, dx: number, dy: number, keepAspect: boolean): Rect {
  let { x, y, w, h } = base
  if (handle.includes('w')) {
    x += dx
    w -= dx
  }
  if (handle.includes('e')) w += dx
  if (handle.includes('n')) {
    y += dy
    h -= dy
  }
  if (handle.includes('s')) h += dy
  const minW = 8
  const minH = handle === 'e' || handle === 'w' ? 0 : 8
  if (w < minW) w = minW
  if (h < minH) h = minH
  if (keepAspect && base.h) {
    const aspect = base.w / base.h
    if (handle.length === 2) {
      h = w / aspect
      if (handle.includes('n')) y = base.y + base.h - h
    }
  }
  return { x, y, w, h }
}

/** Window-level move/resize of the current selection. */
export function useDragInteraction(): void {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag
      if (!d) return
      const s = store.get()
      if (!d.moved) {
        if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 3) return
        d.moved = true
        s.pushHistory()
      }
      const dx = (e.clientX - d.startX) / s.zoom
      const dy = (e.clientY - d.startY) / s.zoom
      const ids = new Set(d.ids)
      const next = d.base.map((el): EditorElement => {
        if (!ids.has(el.id)) return el
        const kind = kindOf(el)
        if (!kind) return el
        if (d.mode === 'resize' && kind.resize && d.handle) {
          const base = d.baseBounds[el.id]
          if (!base) return el
          return kind.resize(el, resizeRect(base, d.handle, dx, dy, e.shiftKey))
        }
        return kind.move ? kind.move(el, dx, dy) : el
      })
      s.setNow((snap) => ({ ...snap, elements: next }))
    }
    const onUp = () => {
      drag = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])
}
