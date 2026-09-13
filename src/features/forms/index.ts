import { registerExportPlugin } from '../../lib/export/buildPdf'
import type { ExportState } from '../../lib/export/buildPdf'
import type { PDFDocument, PDFFont, PDFRadioGroup } from 'pdf-lib'
import { StandardFonts, rgb } from 'pdf-lib'
import { drawDisplayText } from '../../lib/export/drawText'
import { currentValue } from './extract'
import type { ExportCtx, FormField, FormValue } from '../../types'

const asString = (v: FormValue): string =>
  Array.isArray(v) ? (v[0] ?? '') : typeof v === 'boolean' ? (v ? 'Yes' : '') : String(v ?? '')

/**
 * Write the filled values into the output.
 *
 * With the original document in hand the real AcroForm is updated, so the
 * result stays a fillable form. A rebuilt document has no AcroForm to update
 * (copyPages does not bring the catalog across), so the values are drawn as
 * page content instead, which is the same thing a flatten would produce.
 */
async function applyForms(
  doc: PDFDocument,
  state: ExportState,
  mode: 'inplace' | 'rebuild',
  ctxForPage: (pageId: string) => ExportCtx | null,
  flatten: boolean,
): Promise<void> {
  const touched = Object.keys(state.formValues)
  // Page order matters: radio widgets are matched to pdf-lib's option list by
  // their position in the document.
  const allFields = state.pages.flatMap((p) => state.formFields[p.id] ?? [])
  if (!touched.length && !flatten) return

  if (mode === 'inplace') {
    const form = (() => {
      try {
        return doc.getForm()
      } catch {
        return null
      }
    })()
    if (form) {
      for (const name of touched) {
        const field = allFields.find((f) => f.name === name)
        const value = state.formValues[name]
        try {
          if (!field) continue
          if (field.type === 'text') form.getTextField(name).setText(asString(value))
          else if (field.type === 'checkbox') {
            const box = form.getCheckBox(name)
            if (value === true || value === field.exportValue) box.check()
            else box.uncheck()
          } else if (field.type === 'radio') {
            const group = form.getRadioGroup(name)
            const chosen = asString(value)
            if (chosen) selectRadio(group, allFields, name, chosen)
            else group.clear()
          } else if (field.type === 'combo') form.getDropdown(name).select(asString(value))
          else if (field.type === 'list') form.getOptionList(name).select(asString(value))
        } catch {
          // The field is missing, read-only, or a different type than the
          // annotation suggested: drawing it below keeps the value visible.
        }
      }
      try {
        form.updateFieldAppearances()
      } catch {
        // some documents have appearance streams pdf-lib cannot rebuild
      }
      if (flatten) {
        try {
          form.flatten()
        } catch {
          // leave the form in place rather than failing the export
        }
      }
      return
    }
  }

  // Rebuilt document: draw the values where the widgets used to be.
  let helvetica: PDFFont | null = null
  for (const [pageId, fields] of Object.entries(state.formFields)) {
    const ctx = ctxForPage(pageId)
    if (!ctx) continue
    for (const field of fields) {
      const value = currentValue(field, state.formValues)
      if (!helvetica) helvetica = await doc.embedFont(StandardFonts.Helvetica)
      drawField(ctx, field, value, helvetica)
    }
  }
}

function drawField(ctx: ExportCtx, field: FormField, value: FormValue, font: PDFFont): void {
  if (field.type === 'checkbox' || field.type === 'radio') {
    const on = field.type === 'radio' ? value === field.exportValue : value === true
    if (!on) return
    drawTick(ctx, field)
    return
  }
  const text = asString(value)
  if (!text) return
  const size = Math.min(12, field.rect.h * 0.62)
  drawDisplayText(ctx, text, {
    x: field.rect.x + 2,
    y: field.rect.y + (field.rect.h - size * 1.2) / 2,
    width: field.rect.w - 4,
    size,
    font,
    color: '#111827',
  })
}

/**
 * Choose a radio option.
 *
 * pdf.js reports the widget's own on-state name, which in many documents is
 * just its index, while pdf-lib selects by the option label from /Opt. The two
 * line up by widget order, so the chosen widget's position in the group is
 * what actually identifies the option.
 */
function selectRadio(
  group: PDFRadioGroup,
  allFields: FormField[],
  name: string,
  chosen: string,
): void {
  const options = group.getOptions()
  const widgets = allFields.filter((f) => f.name === name && f.type === 'radio')
  const index = widgets.findIndex((f) => f.exportValue === chosen)
  const byIndex = index >= 0 ? options[index] : undefined
  try {
    group.select(byIndex ?? chosen)
  } catch {
    // last resort: the on-state name may be the option after all
    group.select(chosen)
  }
}

/** A tick drawn as two strokes, so no dingbat font has to be embedded. */
function drawTick(ctx: ExportCtx, field: FormField): void {
  const { x, y, w, h } = field.rect
  const inset = Math.min(w, h) * 0.22
  const thickness = Math.max(0.8, Math.min(w, h) * 0.12)
  const a = ctx.toPdf(x + inset, y + h * 0.55)
  const b = ctx.toPdf(x + w * 0.42, y + h - inset)
  const c = ctx.toPdf(x + w - inset, y + inset)
  const color = rgb(0.07, 0.09, 0.15)
  ctx.page.drawLine({ start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness, color })
  ctx.page.drawLine({ start: { x: b[0], y: b[1] }, end: { x: c[0], y: c[1] }, thickness, color })
}

registerExportPlugin({ applyForms })

export { default as FormLayer } from './FormLayer'
export * from './extract'
