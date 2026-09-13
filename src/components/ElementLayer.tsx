import { Fragment, useMemo } from 'react'
import { useStore } from '../store'
import { kindOf } from '../features/registry'
import { ResizeHandles } from './ResizeHandles'
import type { EditorElement, ElementEvents, Page, RenderCtx } from '../types'

interface Props {
  page: Page
  elements: EditorElement[]
  events: ElementEvents
}

/**
 * Renders every element on a page through its registered kind. Adding an
 * element type never means touching this file.
 */
export default function ElementLayer({ page, elements, events }: Props) {
  const zoom = useStore((s) => s.zoom)
  const tool = useStore((s) => s.tool)
  const selectedIds = useStore((s) => s.selectedIds)
  const session = useStore((s) => s.session)
  const pageText = useStore((s) => s.pageText[page.id])

  const linesById = useMemo(() => {
    const map: Record<string, import('../types').Line> = {}
    for (const l of pageText?.lines ?? []) map[l.id] = l
    return map
  }, [pageText])

  const blocksById = useMemo(() => {
    const map: Record<string, import('../types').TextBlock> = {}
    for (const b of pageText?.blocks ?? []) map[b.id] = b
    return map
  }, [pageText])

  const hiddenLineId = session?.kind === 'line' ? session.lineId : null
  const hiddenBlockId = session?.kind === 'block' ? session.blockId : null
  const editingElId = session?.kind === 'element' ? session.id : null

  return (
    <>
      {elements.map((el) => {
        const kind = kindOf(el)
        if (!kind) return null
        const selected = selectedIds.includes(el.id)
        const ctx: RenderCtx = {
          zoom,
          tool,
          page,
          selected,
          editing: editingElId === el.id,
          linesById,
          blocksById,
          hiddenLineId,
          hiddenBlockId,
          on: events,
        }
        return (
          <Fragment key={el.id}>
            {kind.render(el, ctx)}
            {selected && tool === 'select' && kind.resize && (
              <ResizeHandles el={el} zoom={zoom} events={events} />
            )}
          </Fragment>
        )
      })}
    </>
  )
}
