import { useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { useStore } from '../../store'
import { parsePageRange } from '../../lib/pageModel'
import { redactedPageIds } from '../redaction'
import { exportStateOf } from '../../actions/exportPdf'
import type { ExportOptions } from '../../lib/export/buildPdf'

export interface ExportRequest extends ExportOptions {
  fileName: string
}

/** Everything that happens between pressing Download and the file arriving. */
export default function ExportDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (request: ExportRequest) => void
}) {
  const pages = useStore((s) => s.pages)
  const defaultName = useStore((s) => s.fileName || 'document')
  const formFields = useStore((s) => s.formFields)

  const [fileName, setFileName] = useState(`${defaultName}-edited`)
  const [range, setRange] = useState('all')
  const [flattenForms, setFlattenForms] = useState(false)
  const [protect, setProtect] = useState(false)
  const [password, setPassword] = useState('')
  const [dpi, setDpi] = useState(200)

  const pageIds = useMemo(
    () => parsePageRange(range, pages.length).map((i) => pages[i]?.id).filter(Boolean) as string[],
    [range, pages],
  )

  const rasterCount = useMemo(() => {
    if (!pageIds.length) return 0
    return redactedPageIds(exportStateOf(), pageIds).length
  }, [pageIds])

  const hasForms = Object.values(formFields).some((f) => f.length)

  return (
    <Modal
      title="Download PDF"
      width={460}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!pageIds.length || (protect && password.length < 4)}
            onClick={() =>
              onConfirm({
                fileName: fileName.trim() || defaultName,
                pageIds: pageIds.length === pages.length ? undefined : pageIds,
                flattenForms,
                redactDpi: dpi,
                password: protect ? { userPassword: password } : undefined,
              })
            }
          >
            Download
          </button>
        </>
      }
    >
      <div className="auth-form">
        <label>
          File name
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </label>
        <label>
          Pages
          <input value={range} onChange={(e) => setRange(e.target.value)} />
          <span className="hint">
            {pageIds.length
              ? `${pageIds.length} of ${pages.length} page${pages.length === 1 ? '' : 's'}.`
              : 'That range does not match any pages.'}
          </span>
        </label>

        {hasForms && (
          <label className="checkline">
            <input
              type="checkbox"
              checked={flattenForms}
              onChange={(e) => setFlattenForms(e.target.checked)}
            />
            Flatten form fields so they cannot be changed
          </label>
        )}

        <label className="checkline">
          <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
          Protect with a password
        </label>
        {protect && (
          <>
            <label>
              Password
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="hint">
                Anyone opening the file will need this. Keep a copy: it cannot be recovered, and
                this editor cannot reopen a protected file.
              </span>
            </label>
          </>
        )}

        {rasterCount > 0 && (
          <div className="callout">
            <strong>
              {rasterCount} page{rasterCount === 1 ? '' : 's'} will be flattened to an image.
            </strong>
            <p>
              That is what removes the redacted content from the file. Text on those pages stops
              being selectable or searchable.
            </p>
            <label className="rangeline">
              Quality
              <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
                <option value={150}>150 dpi (smaller file)</option>
                <option value={200}>200 dpi</option>
                <option value={300}>300 dpi (sharper)</option>
              </select>
            </label>
          </div>
        )}
      </div>
    </Modal>
  )
}
