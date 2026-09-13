import { useEffect, useRef } from 'react'
import { useStore } from '../../store'
import type { Page } from '../../types'

/** Outlines over search hits on one page, with the current one emphasised. */
export default function MatchLayer({ page }: { page: Page }) {
  const zoom = useStore((s) => s.zoom)
  const panel = useStore((s) => s.panel)
  const matches = useStore((s) => s.searchMatches)
  const index = useStore((s) => s.searchIndex)
  const currentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [index])

  if (panel !== 'search' || !matches?.length) return null

  return (
    <>
      {matches.map((m, i) =>
        m.pageId !== page.id ? null : (
          <div
            key={`${m.lineId}-${m.start}-${i}`}
            ref={i === index ? currentRef : undefined}
            className={`match${i === index ? ' current' : ''}`}
            style={{
              left: m.rect.x * zoom,
              top: m.rect.y * zoom,
              width: m.rect.w * zoom,
              height: m.rect.h * zoom,
            }}
          />
        ),
      )}
    </>
  )
}
