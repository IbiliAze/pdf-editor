import { store } from '../store'
import { buildPdf } from '../lib/export/buildPdf'
import type { ExportOptions, ExportState } from '../lib/export/buildPdf'
import { blocksByIdOf, linesByIdOf } from '../store/selectors'
import { commitSession } from '../features/text-edit/session'
import { downloadBytes } from '../lib/utils'

export interface ExportResult {
  bytes: Uint8Array
  fileName: string
  pageCount: number
}

/** Snapshot the store into the shape the export pipeline consumes. */
export function exportStateOf(): ExportState {
  const s = store.get()
  return {
    sources: s.sources,
    pages: s.pages,
    elements: s.elements,
    linesById: linesByIdOf(s.pageText),
    blocksById: blocksByIdOf(s.pageText),
    formFields: s.formFields,
    formValues: s.formValues,
    decorations: s.decorations,
    fileName: s.fileName,
  }
}

/**
 * Render the current document to PDF bytes. Any open inline editor is
 * committed first so in-progress typing is never lost.
 */
export async function renderPdf(
  opts: ExportOptions & { fileName?: string } = {},
): Promise<ExportResult> {
  commitSession()
  const s = store.get()
  // Pages whose text was never extracted cannot carry edits, but form fields
  // and search need them; only what is loaded is required here.
  const state = exportStateOf()
  const bytes = await buildPdf(state, opts)
  const pageIds = opts.pageIds?.length ? opts.pageIds : state.pages.map((p) => p.id)
  return {
    bytes,
    fileName: `${opts.fileName || s.fileName || 'document'}.pdf`,
    pageCount: pageIds.length,
  }
}

/** Render and hand the file to the browser. */
export async function downloadPdf(
  opts: ExportOptions & { fileName?: string } = {},
): Promise<ExportResult> {
  const result = await renderPdf(opts)
  downloadBytes(result.bytes, result.fileName)
  return result
}
