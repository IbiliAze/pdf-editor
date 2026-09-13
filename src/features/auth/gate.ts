import { store } from '../../store'
import { api } from './api'
import { useAuth } from './store'
import type { ExportResult } from '../../actions/exportPdf'

export type DownloadRunner = () => Promise<ExportResult | ExportResult[]>

/**
 * Run a download behind the account gate.
 *
 * The gate is a product decision, not a security boundary: every byte of the
 * export is produced in the browser, so a determined visitor can always get
 * their file. It exists so downloads are tied to an account, and it steps
 * aside entirely when the account service is unreachable.
 */
export async function gatedDownload(run: DownloadRunner, label = 'PDF'): Promise<void> {
  const auth = useAuth.getState()

  if (auth.status === 'unknown') await auth.refresh()
  const state = useAuth.getState()

  if (!state.apiAvailable || state.status === 'verified') {
    await runAndRecord(run)
    return
  }

  // Remember the download and replay it the moment the account is confirmed.
  useAuth.getState().open(state.status === 'unverified' ? 'sent' : 'signup', {
    label,
    run: () => runAndRecord(run),
  })
}

async function runAndRecord(run: DownloadRunner): Promise<void> {
  const { setStatus, setLastDownloadAt } = store.get()
  setStatus({ type: 'info', msg: 'Preparing PDF…' })
  try {
    const result = await run()
    const files = Array.isArray(result) ? result : [result]
    setStatus({
      type: 'success',
      msg:
        files.length === 1
          ? `Downloaded ${files[0].fileName}.`
          : `Downloaded ${files.length} files.`,
    })
    setLastDownloadAt(Date.now())
    // Bookkeeping only; a failure here must never look like a failed download.
    for (const file of files) {
      api
        .recordDownload(file.fileName, file.pageCount, file.bytes.byteLength)
        .catch(() => undefined)
    }
  } catch (err) {
    setStatus({ type: 'error', msg: `Export failed: ${(err as Error)?.message ?? err}` })
    throw err
  }
}
