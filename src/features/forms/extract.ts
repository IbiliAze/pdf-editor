import type { PDFPageProxy, PageViewport } from '../../lib/pdfjs'
import { normRect } from '../../lib/geometry'
import type { FormField, FormFieldType } from '../../types'

interface PdfJsAnnotation {
  id: string
  subtype?: string
  fieldType?: string | null
  fieldName?: string
  rect: number[]
  fieldValue?: string | string[] | null
  defaultFieldValue?: string | null
  readOnly?: boolean
  hidden?: boolean
  multiLine?: boolean
  maxLen?: number | null
  checkBox?: boolean
  radioButton?: boolean
  pushButton?: boolean
  combo?: boolean
  exportValue?: string
  buttonValue?: string
  options?: { exportValue: string; displayValue: string }[]
}

function typeOf(a: PdfJsAnnotation): FormFieldType | null {
  if (a.fieldType === 'Tx') return 'text'
  if (a.fieldType === 'Btn') {
    if (a.pushButton) return null
    return a.radioButton ? 'radio' : 'checkbox'
  }
  if (a.fieldType === 'Ch') return a.combo ? 'combo' : 'list'
  return null
}

/**
 * Read the fillable fields of a page. Geometry comes back in the page's
 * display space at the current rotation, the same space elements live in.
 */
export async function extractFormFields(
  page: PDFPageProxy,
  viewport: PageViewport,
  pageId: string,
): Promise<FormField[]> {
  let annotations: PdfJsAnnotation[]
  try {
    annotations = (await page.getAnnotations({ intent: 'display' })) as PdfJsAnnotation[]
  } catch {
    return []
  }

  const fields: FormField[] = []
  for (const a of annotations) {
    if (a.subtype !== 'Widget' || a.hidden) continue
    const type = typeOf(a)
    if (!type || !a.fieldName) continue

    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect)
    const rect = normRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 })
    if (rect.w < 1 || rect.h < 1) continue

    const on = a.exportValue ?? a.buttonValue ?? 'Yes'
    const checked = type === 'checkbox' || type === 'radio' ? a.fieldValue === on : false

    fields.push({
      id: a.id,
      pageId,
      name: a.fieldName,
      type,
      rect,
      defaultValue:
        type === 'checkbox' || type === 'radio'
          ? checked
          : type === 'list'
            ? toArray(a.fieldValue)
            : String(a.fieldValue ?? a.defaultFieldValue ?? ''),
      options: a.options?.map((o) => ({ value: o.exportValue, label: o.displayValue })),
      exportValue: type === 'checkbox' || type === 'radio' ? on : undefined,
      readOnly: !!a.readOnly,
      multiline: !!a.multiLine,
      // pdf.js reports 0 for "no limit"; passing that through as a maxlength
      // would make the field reject every keystroke.
      maxLen: a.maxLen && a.maxLen > 0 ? a.maxLen : undefined,
    })
  }
  return fields
}

const toArray = (v: string | string[] | null | undefined): string[] =>
  Array.isArray(v) ? v : v ? [v] : []

/**
 * The value the editor should show for a field: what the user typed, else
 * what the document already had.
 */
export function currentValue(
  field: FormField,
  values: Record<string, import('../../types').FormValue>,
): import('../../types').FormValue {
  const key = valueKey(field)
  return key in values ? values[key] : field.defaultValue
}

/**
 * Radio widgets in one group share a field name, so the stored value is the
 * chosen option rather than a per-widget flag.
 */
export const valueKey = (field: FormField): string => field.name
