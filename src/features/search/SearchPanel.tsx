import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store'
import { findInLines } from './find'
import type { Match } from './find'
import { redactRect } from '../redaction'
import { HIGHLIGHT_COLOR } from '../../constants'
import { nid } from '../../lib/ids'
import type { EditorElement } from '../../types'

export default function SearchPanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const pages = useStore((s) => s.pages)
  const pageText = useStore((s) => s.pageText)
  const ensureAllPageText = useStore((s) => s.ensureAllPageText)
  const setActivePageId = useStore((s) => s.setActivePageId)

  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [index, setIndex] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)

  const open = panel === 'search'

  // Searching has to see every page, not just the ones that were scrolled to.
  useEffect(() => {
    if (!open || !pages.length) return
    const missing = pages.filter((p) => !pageText[p.id]).length
    if (!missing) return
    setScanning(true)
    void ensureAllPageText((done, total) => setProgress(done / total)).finally(() =>
      setScanning(false),
    )
    // Only when the panel opens or the document changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pages])

  const matches: Match[] = useMemo(() => {
    if (!query.trim()) return []
    const out: Match[] = []
    for (const page of pages) {
      const lines = pageText[page.id]?.lines
      if (!lines) continue
      out.push(...findInLines(lines, query, { caseSensitive, wholeWord }))
    }
    return out
  }, [query, pages, pageText, caseSensitive, wholeWord])

  useEffect(() => {
    setIndex(0)
  }, [query, caseSensitive, wholeWord])

  const setSearchResults = useStore((s) => s.setSearchResults)
  useEffect(() => {
    setSearchResults(matches, index)
  }, [matches, index, setSearchResults])

  const go = useCallback(
    (delta: number) => {
      if (!matches.length) return
      const next = (index + delta + matches.length) % matches.length
      setIndex(next)
      setActivePageId(matches[next].pageId)
    },
    [index, matches, setActivePageId],
  )

  if (!open) return null

  const addAll = (make: (m: Match) => EditorElement) => {
    if (!matches.length) return
    useStore.getState().commit((snap) => ({
      ...snap,
      elements: [...snap.elements, ...matches.map(make)],
    }))
  }

  return (
    <aside className="panel">
      <header className="sidebar-head">
        <strong>Find</strong>
        <button className="modal-close" onClick={() => setPanel(null)} aria-label="Close find">
          ×
        </button>
      </header>
      <div className="panel-body">
        <input
          className="panel-input"
          autoFocus
          placeholder="Find in document"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go(e.shiftKey ? -1 : 1)
            if (e.key === 'Escape') setPanel(null)
          }}
        />
        <div className="panel-row">
          <label className="checkline">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            Match case
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
            />
            Whole word
          </label>
        </div>
        <div className="panel-row">
          <span className="hint">
            {scanning
              ? `Reading pages… ${Math.round(progress * 100)}%`
              : query.trim()
                ? matches.length
                  ? `${index + 1} of ${matches.length}`
                  : 'No matches'
                : `${useStore.getState().pages.length} pages`}
          </span>
          <span className="spacer" />
          <button className="btn" disabled={!matches.length} onClick={() => go(-1)}>
            ↑
          </button>
          <button className="btn" disabled={!matches.length} onClick={() => go(1)}>
            ↓
          </button>
        </div>
        <div className="panel-row">
          <button
            className="btn"
            disabled={!matches.length}
            title="Add a highlight over every match"
            onClick={() =>
              addAll((m) => ({
                id: nid(),
                type: 'highlight',
                pageId: m.pageId,
                x: m.rect.x,
                y: m.rect.y,
                w: m.rect.w,
                h: m.rect.h,
                color: HIGHLIGHT_COLOR,
              }) as EditorElement)
            }
          >
            Highlight all
          </button>
          <button
            className="btn"
            disabled={!matches.length}
            title="Mark every match for removal"
            onClick={() => addAll((m) => redactRect(m.pageId, m.rect) as EditorElement)}
          >
            Redact all
          </button>
        </div>
      </div>
    </aside>
  )
}
