import { useState } from 'react'
import Modal from '../../components/Modal'
import { store } from '../../store'
import type { LinkElement, LinkTarget } from './types'

export default function LinkDialog({
  element,
  onClose,
}: {
  element: LinkElement
  onClose: () => void
}) {
  const pages = store.get().pages
  const [mode, setMode] = useState<'url' | 'page'>(element.target.kind)
  const [url, setUrl] = useState(element.target.kind === 'url' ? element.target.url : '')
  const [pageId, setPageId] = useState(
    element.target.kind === 'page' ? element.target.pageId : (pages[0]?.id ?? ''),
  )
  const [border, setBorder] = useState(element.border ?? false)

  const save = () => {
    const target: LinkTarget = mode === 'url' ? { kind: 'url', url } : { kind: 'page', pageId }
    store.get().updateElement(element.id, (el) => ({ ...el, target, border }))
    onClose()
  }

  const remove = () => {
    store.get().removeElements([element.id])
    onClose()
  }

  return (
    <Modal
      title="Link"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={remove}>
            Remove
          </button>
          <button className="btn primary" onClick={save} disabled={mode === 'url' && !url.trim()}>
            Save
          </button>
        </>
      }
    >
      <div className="tabs">
        <button className={`tab${mode === 'url' ? ' active' : ''}`} onClick={() => setMode('url')}>
          Web address
        </button>
        <button className={`tab${mode === 'page' ? ' active' : ''}`} onClick={() => setMode('page')}>
          Page in this file
        </button>
      </div>

      <div className="auth-form">
        {mode === 'url' ? (
          <label>
            Address
            <input
              value={url}
              placeholder="example.com/handbook"
              onChange={(e) => setUrl(e.target.value)}
            />
            <span className="hint">https:// is added when you leave it off.</span>
          </label>
        ) : (
          <label>
            Go to
            <select value={pageId} onChange={(e) => setPageId(e.target.value)}>
              {pages.map((p, i) => (
                <option key={p.id} value={p.id}>
                  Page {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="checkline">
          <input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} />
          Show a border around the link
        </label>
      </div>
    </Modal>
  )
}
