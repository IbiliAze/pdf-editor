import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useStore } from '../store'
import { eightmileUrl, outbound } from '../lib/eightmile'
import PageView from './PageView'

interface Props {
  onOpenFile: (file: File | null | undefined) => void
  onPick: () => void
}

/** The scrolling page column, plus the empty state and drop target. */
export default function Workspace({ onOpenFile, onPick }: Props) {
  const pages = useStore((s) => s.pages)
  const loading = useStore((s) => s.loading)
  const fitMode = useStore((s) => s.fitMode)
  const setZoom = useStore((s) => s.setZoom)
  const ref = useRef<HTMLElement>(null)

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer?.files?.[0]
      if (file && /\.pdf$/i.test(file.name)) onOpenFile(file)
      else if (file) useStore.getState().setStatus({ type: 'error', msg: 'Only PDF files are supported.' })
    },
    [onOpenFile],
  )

  // Keep the fit-to-width zoom in step with the available width.
  useLayoutEffect(() => {
    if (fitMode !== 'width') return
    const el = ref.current
    const first = pages[0]
    if (!el || !first) return
    const apply = () => {
      const avail = el.clientWidth - 48
      if (avail > 0) useStore.setState({ zoom: Math.max(0.1, avail / first.width) })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitMode, pages, setZoom])

  // Scroll to the active page when it changes from outside (sidebar, search).
  useEffect(() => {
    let last: string | null = useStore.getState().activePageId
    return useStore.subscribe((s) => {
      if (s.activePageId === last) return
      last = s.activePageId
      if (!s.activePageId) return
      const node = ref.current?.querySelector(`[data-page-id="${s.activePageId}"]`)
      node?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }, [])

  return (
    <main
      className="workspace"
      ref={ref}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {!pages.length && !loading && (
        <div className="empty" onClick={onPick}>
          <span className="empty-logo-wrap">
            <img className="empty-logo" src="/eight-mile-pdf-logo.png" alt="Eight Mile PDF logo" />
          </span>
          <h2>{document.documentElement.dataset.heading ?? 'Open a PDF to start editing'}</h2>
          <p>
            Click here or drop a file. Click any text on the page to rewrite it — your file stays
            in your browser.
          </p>
          {/* The whole card opens the file picker, so the link must not. */}
          <p className="empty-by" onClick={(e) => e.stopPropagation()}>
            Free, from{' '}
            <a href={eightmileUrl('empty-state')} {...outbound}>
              Eight Mile
            </a>
            . We design websites and build SaaS products for businesses.
          </p>
        </div>
      )}
      {pages.map((page, i) => (
        <PageView key={page.id} page={page} index={i} />
      ))}
    </main>
  )
}
