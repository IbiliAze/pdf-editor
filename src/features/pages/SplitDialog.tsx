import { useState } from 'react'
import Modal from '../../components/Modal'
import { useStore } from '../../store'
import { parsePageRange } from '../../lib/pageModel'
import { splitByRanges } from './actions'

export default function SplitDialog({ onClose }: { onClose: () => void }) {
  const total = useStore((s) => s.pages.length)
  const [ranges, setRanges] = useState(`1-${total}`)
  const [separate, setSeparate] = useState(true)

  const groups = separate
    ? ranges.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
    : [ranges]
  const counts = groups.map((g) => parsePageRange(g, total).length)
  const matched = counts.reduce((a, b) => a + b, 0)

  return (
    <Modal
      title="Split into separate files"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!matched}
            onClick={() => {
              void splitByRanges(ranges, separate)
              onClose()
            }}
          >
            {separate && groups.length > 1 ? `Download ${groups.length} files` : 'Download'}
          </button>
        </>
      }
    >
      <div className="auth-form">
        <label>
          Page ranges
          <input value={ranges} onChange={(e) => setRanges(e.target.value)} />
          <span className="hint">
            Page numbers as they appear now, for example <code>1-3, 7, 10-</code>.
          </span>
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={separate}
            onChange={(e) => setSeparate(e.target.checked)}
          />
          One file per range
        </label>
        <p className="hint">
          {matched
            ? separate
              ? `${groups.length} file${groups.length === 1 ? '' : 's'}, ${matched} page${matched === 1 ? '' : 's'} in total.`
              : `One file with ${matched} page${matched === 1 ? '' : 's'}.`
            : 'That range does not match any pages.'}
        </p>
      </div>
    </Modal>
  )
}
