import { useEffect, useState } from 'react'
import { registerFeature } from '../registry'
import { store } from '../../store'
import { nid } from '../../lib/ids'
import { normRect } from '../../lib/geometry'
import { drawLink, drawNote, NOTE_SIZE } from './draw'
import { LinkView, NoteView } from './views'
import LinkDialog from './LinkDialog'
import type { ElementKind, ToolBehaviour } from '../../types'
import type { LinkElement, NoteElement } from './types'

const NOTE_COLOR = '#fde047'
const MIN_DRAG = 4

const noteKind: ElementKind<NoteElement> = {
  type: 'note',
  layer: 30,
  render: (el, ctx) => <NoteView el={el} ctx={ctx} />,
  draw: drawNote,
  bounds: (el) => ({ x: el.x, y: el.y, w: NOTE_SIZE, h: NOTE_SIZE }),
  move: (el, dx, dy) => ({ ...el, x: el.x + dx, y: el.y + dy }),
  rotatePage: (el, t) => {
    const p = t({ x: el.x, y: el.y })
    return { ...el, x: p.x, y: p.y }
  },
}

const linkKind: ElementKind<LinkElement> = {
  type: 'link',
  layer: 30,
  render: (el, ctx) => <LinkView el={el} ctx={ctx} />,
  draw: drawLink,
  bounds: (el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }),
  move: (el, dx, dy) => ({ ...el, x: el.x + dx, y: el.y + dy }),
  resize: (el, r) => ({ ...el, ...r }),
  rotatePage: (el, t) => {
    const a = t({ x: el.x, y: el.y })
    const b = t({ x: el.x + el.w, y: el.y + el.h })
    return {
      ...el,
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    }
  },
}

const noteTool: ToolBehaviour = {
  cursor: 'copy',
  pointerDown: ({ page, point, event }) => {
    event.preventDefault()
    const el: NoteElement = {
      id: nid(),
      type: 'note',
      pageId: page.id,
      x: point.x,
      y: point.y,
      text: '',
      color: NOTE_COLOR,
    }
    store.get().addElement(el)
  },
}

let pendingLink: LinkElement | null = null
let openLinkDialog: (() => void) | null = null

const linkTool: ToolBehaviour = {
  cursor: 'crosshair',
  pointerDown: ({ page, point }) => {
    const el: LinkElement = {
      id: nid(),
      type: 'link',
      pageId: page.id,
      x: point.x,
      y: point.y,
      w: 0,
      h: 0,
      target: { kind: 'url', url: '' },
    }
    store.set({ liveDraw: el })
  },
  pointerMove: ({ page, point }) => {
    const d = store.get().liveDraw as LinkElement | null
    if (!d || d.type !== 'link' || d.pageId !== page.id) return
    store.set({ liveDraw: { ...d, w: point.x - d.x, h: point.y - d.y } })
  },
  pointerUp: () => {
    const d = store.get().liveDraw as LinkElement | null
    store.set({ liveDraw: null })
    if (!d || Math.abs(d.w) < MIN_DRAG || Math.abs(d.h) < MIN_DRAG) return
    const el = normRect(d)
    store.get().addElement(el)
    pendingLink = el
    openLinkDialog?.()
  },
}

/** Mounted once by App: edits whichever link was just drawn or double-clicked. */
export function LinkDialogHost() {
  const [target, setTarget] = useState<LinkElement | null>(null)
  openLinkDialog = () => setTarget(pendingLink)

  useEffect(() => {
    return store.subscribe((s) => {
      const session = s.session
      if (session?.kind !== 'element') return
      const el = s.elements.find((e) => e.id === session.id)
      if (el?.type === 'link') {
        pendingLink = el as LinkElement
        setTarget(el as LinkElement)
        store.set({ session: null })
      }
    })
  }, [])

  if (!target) return null
  return <LinkDialog element={target} onClose={() => setTarget(null)} />
}

registerFeature({
  name: 'annotations',
  elements: [noteKind, linkKind],
  tools: [
    {
      id: 'note',
      label: 'Note',
      icon: '☷',
      group: 'annotate',
      order: 33,
      behaviour: noteTool,
      hint: 'Click to drop a sticky note. It is written as a real PDF comment, not drawn on the page.',
    },
    {
      id: 'link',
      label: 'Link',
      icon: '⚭',
      group: 'annotate',
      order: 34,
      behaviour: linkTool,
      hint: 'Drag over the area that should be clickable, then give it a web address or a page.',
    },
  ],
})

export * from './types'
export { normalizeUrl } from './draw'
