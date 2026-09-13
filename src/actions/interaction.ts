import { store } from '../store'
import { toolById } from '../features/registry'
import { commitSession } from '../features/text-edit/session'
import type { Page, Point, ToolCtx } from '../types'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** Pointer position in page display units. */
export function localPoint(e: ReactPointerEvent<HTMLElement>, zoom: number): Point {
  const r = e.currentTarget.getBoundingClientRect()
  return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }
}

function ctxFor(
  e: ReactPointerEvent<HTMLElement>,
  page: Page,
  canvas: HTMLCanvasElement | null,
): ToolCtx {
  return { page, point: localPoint(e, store.get().zoom), event: e, canvas }
}

export function pagePointerDown(
  e: ReactPointerEvent<HTMLElement>,
  page: Page,
  canvas: HTMLCanvasElement | null,
): void {
  const s = store.get()
  store.set({ activePageId: page.id })
  if (s.session) {
    commitSession()
    return
  }
  toolById(s.tool)?.behaviour?.pointerDown?.(ctxFor(e, page, canvas))
}

export function pagePointerMove(
  e: ReactPointerEvent<HTMLElement>,
  page: Page,
  canvas: HTMLCanvasElement | null,
): void {
  const s = store.get()
  const behaviour = toolById(s.tool)?.behaviour
  if (!behaviour?.pointerMove) return
  behaviour.pointerMove(ctxFor(e, page, canvas))
}

export function pagePointerUp(
  e: ReactPointerEvent<HTMLElement>,
  page: Page,
  canvas: HTMLCanvasElement | null,
): void {
  const s = store.get()
  toolById(s.tool)?.behaviour?.pointerUp?.(ctxFor(e, page, canvas))
}
