import { PDFArray, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib'
import { hexToRgb01 } from '../../lib/colors'
import type { ExportCtx } from '../../types'
import type { LinkElement, NoteElement } from './types'

export const NOTE_SIZE = 20

const colorArray = (ctx: ExportCtx, hex: string): PDFArray => {
  const c = hexToRgb01(hex)
  const arr = PDFArray.withContext(ctx.out.context)
  arr.push(PDFNumber.of(c.r))
  arr.push(PDFNumber.of(c.g))
  arr.push(PDFNumber.of(c.b))
  return arr
}

const rectArray = (
  ctx: ExportCtx,
  r: { x: number; y: number; width: number; height: number },
): PDFArray => {
  const arr = PDFArray.withContext(ctx.out.context)
  for (const n of [r.x, r.y, r.x + r.width, r.y + r.height]) arr.push(PDFNumber.of(n))
  return arr
}

const pdfDate = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

/**
 * Write a sticky note as a real /Text annotation, so readers show it as a
 * comment rather than as ink on the page.
 */
export async function drawNote(el: NoteElement, ctx: ExportCtx): Promise<void> {
  const rect = ctx.rectToPdf(el.x, el.y, NOTE_SIZE, NOTE_SIZE)
  const dict = ctx.out.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Name: 'Comment',
    Rect: rectArray(ctx, rect),
    Contents: PDFHexString.fromText(el.text ?? ''),
    T: PDFHexString.fromText(el.author || 'Eight Mile PDF'),
    C: colorArray(ctx, el.color),
    M: PDFString.of(pdfDate(new Date())),
    // Print, so the note survives a flatten in other software.
    F: PDFNumber.of(4),
    Open: false,
  })
  ctx.page.node.addAnnot(ctx.out.context.register(dict))
}

export async function drawLink(el: LinkElement, ctx: ExportCtx): Promise<void> {
  const rect = ctx.rectToPdf(el.x, el.y, el.w, el.h)
  const border = PDFArray.withContext(ctx.out.context)
  for (const n of [0, 0, el.border ? 1 : 0]) border.push(PDFNumber.of(n))

  const base: Record<string, unknown> = {
    Type: 'Annot',
    Subtype: 'Link',
    Rect: rectArray(ctx, rect),
    Border: border,
    F: PDFNumber.of(4),
  }
  if (el.border) base.C = colorArray(ctx, '#2563eb')

  if (el.target.kind === 'url') {
    const url = el.target.url.trim()
    if (!url) return
    base.A = ctx.out.context.obj({
      Type: 'Action',
      S: 'URI',
      URI: PDFString.of(normalizeUrl(url)),
    })
  } else {
    const ref = ctx.refForPage(el.target.pageId)
    if (!ref) return
    const dest = PDFArray.withContext(ctx.out.context)
    dest.push(ref as never)
    dest.push(PDFName.of('Fit'))
    base.Dest = dest
  }

  ctx.page.node.addAnnot(ctx.out.context.register(ctx.out.context.obj(base as never)))
}

/** Bare domains are the common case; assume https rather than a relative path. */
export function normalizeUrl(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  return `https://${url}`
}
