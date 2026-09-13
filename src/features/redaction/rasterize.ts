import { totalRotation } from '../../types'
import type { Page } from '../../types'
import type { ExportState } from '../../lib/export/buildPdf'
import type { RedactElement } from './types'

/** Above this many pixels a canvas starts failing on modest devices. */
const MAX_PIXELS = 30_000_000

export interface Raster {
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg'
}

/**
 * Render a page to an image with its redactions painted out.
 *
 * Everything that was under a black box is destroyed by the rasterisation
 * itself: the output page carries pixels, not the original content stream, so
 * the text cannot be recovered by selecting, searching, or parsing the file.
 * The cost is that the rest of the page stops being selectable text.
 */
export async function rasterizePage(
  state: ExportState,
  page: Page,
  dpi: number,
): Promise<Raster | null> {
  if (page.source.kind !== 'pdf') return null
  const src = state.sources[page.source.docId]
  if (!src?.pdfjs) return null

  let scale = dpi / 72
  while (page.width * scale * (page.height * scale) > MAX_PIXELS && scale > 1) {
    scale *= 0.75
  }

  const pdfPage = await src.pdfjs.getPage(page.source.pageIndex + 1)
  const viewport = pdfPage.getViewport({ scale, rotation: totalRotation(page) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await pdfPage.render({ canvasContext: ctx, viewport }).promise

  ctx.fillStyle = '#000000'
  for (const el of state.elements) {
    if (el.pageId !== page.id || el.type !== 'redact') continue
    const r = el as RedactElement
    ctx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale)
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  )
  if (!blob) return null
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg' }
}

/** Page ids that carry at least one redaction. */
export function redactedPageIds(state: ExportState, pageIds: string[]): string[] {
  const wanted = new Set(pageIds)
  const hit = new Set<string>()
  for (const el of state.elements) {
    if (el.type === 'redact' && wanted.has(el.pageId)) hit.add(el.pageId)
  }
  return [...hit]
}
