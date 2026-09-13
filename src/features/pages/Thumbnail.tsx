import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { totalRotation } from '../../types'
import type { Page } from '../../types'

const THUMB_WIDTH = 150
const cache = new Map<string, string>()
const CACHE_LIMIT = 300

const keyOf = (page: Page) =>
  page.source.kind === 'blank'
    ? `blank:${Math.round(page.width)}x${Math.round(page.height)}`
    : `${page.source.docId}:${page.source.pageIndex}:${totalRotation(page)}`

export function clearThumbnailCache(): void {
  cache.clear()
}

/** A lazily rendered page thumbnail. Renders once per source page and angle. */
export default function Thumbnail({ page }: { page: Page }) {
  const sources = useStore((s) => s.sources)
  const [url, setUrl] = useState<string | null>(() => cache.get(keyOf(page)) ?? null)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const height = Math.round((THUMB_WIDTH * page.height) / Math.max(1, page.width))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const key = keyOf(page)
    const cached = cache.get(key)
    if (cached) {
      setUrl(cached)
      return
    }
    if (!visible) return
    if (page.source.kind === 'blank') return
    const doc = sources[page.source.docId]?.pdfjs
    if (!doc) return

    let cancelled = false
    const src = page.source
    ;(async () => {
      try {
        const p = await doc.getPage(src.pageIndex + 1)
        const scale = THUMB_WIDTH / page.width
        const vp = p.getViewport({ scale, rotation: totalRotation(page) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(vp.width))
        canvas.height = Math.max(1, Math.floor(vp.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await p.render({ canvasContext: ctx, viewport: vp }).promise
        if (cancelled) return
        const dataUrl = canvas.toDataURL('image/png')
        if (cache.size > CACHE_LIMIT) cache.clear()
        cache.set(key, dataUrl)
        setUrl(dataUrl)
      } catch {
        // page torn down or render superseded
      }
    })()
    return () => {
      cancelled = true
    }
  }, [page, sources, visible])

  return (
    <div className="thumb-canvas" ref={ref} style={{ width: THUMB_WIDTH, height }}>
      {url ? (
        // draggable={false} stops the browser's native image drag, which would
        // otherwise cancel the pointer gesture used to reorder pages.
        <img src={url} alt="" width={THUMB_WIDTH} height={height} draggable={false} />
      ) : null}
    </div>
  )
}
