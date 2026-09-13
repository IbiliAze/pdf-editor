import { useStore } from '../../store'
import { currentValue } from './extract'
import type { FormField, Page } from '../../types'

/** Inputs overlaid on the page's fillable fields. */
export default function FormLayer({ page }: { page: Page }) {
  const fields = useStore((s) => s.formFields[page.id])
  const values = useStore((s) => s.formValues)
  const setFormValue = useStore((s) => s.setFormValue)
  const zoom = useStore((s) => s.zoom)
  const show = useStore((s) => s.showFormFields)

  if (!show || !fields?.length) return null

  return (
    <>
      {fields.map((field) => (
        <Field
          key={field.id}
          field={field}
          zoom={zoom}
          value={currentValue(field, values)}
          onChange={(v) => setFormValue(field.name, v)}
        />
      ))}
    </>
  )
}

function Field({
  field,
  zoom,
  value,
  onChange,
}: {
  field: FormField
  zoom: number
  value: import('../../types').FormValue
  onChange: (v: import('../../types').FormValue) => void
}) {
  const style: React.CSSProperties = {
    left: field.rect.x * zoom,
    top: field.rect.y * zoom,
    width: field.rect.w * zoom,
    height: field.rect.h * zoom,
    fontSize: Math.min(16, field.rect.h * 0.62) * zoom,
  }
  const stop = (e: React.PointerEvent) => e.stopPropagation()

  if (field.type === 'checkbox' || field.type === 'radio') {
    const checked =
      field.type === 'radio' ? value === field.exportValue : value === true || value === field.exportValue
    return (
      <button
        className={`form-check${checked ? ' checked' : ''}`}
        style={style}
        title={field.name}
        disabled={field.readOnly}
        onPointerDown={stop}
        onClick={() =>
          field.type === 'radio'
            ? onChange(checked ? '' : (field.exportValue ?? 'Yes'))
            : onChange(!checked)
        }
      >
        {checked ? '✓' : ''}
      </button>
    )
  }

  if (field.type === 'combo' || field.type === 'list') {
    const selected = Array.isArray(value) ? value[0] : String(value ?? '')
    return (
      <select
        className="form-input"
        style={style}
        title={field.name}
        disabled={field.readOnly}
        value={selected}
        onPointerDown={stop}
        onChange={(e) => onChange(field.type === 'list' ? [e.target.value] : e.target.value)}
      >
        <option value="" />
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label || o.value}
          </option>
        ))}
      </select>
    )
  }

  if (field.multiline) {
    return (
      <textarea
        className="form-input"
        style={style}
        title={field.name}
        readOnly={field.readOnly}
        maxLength={field.maxLen}
        value={String(value ?? '')}
        onPointerDown={stop}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <input
      className="form-input"
      style={style}
      title={field.name}
      readOnly={field.readOnly}
      maxLength={field.maxLen}
      value={String(value ?? '')}
      onPointerDown={stop}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
