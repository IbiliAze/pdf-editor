// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import FormLayer from '../FormLayer'
import { store } from '../../../store'
import type { FormField, FormValue, Page } from '../../../types'

const page: Page = {
  id: 'p1',
  source: { kind: 'blank' },
  intrinsicRotation: 0,
  rotation: 0,
  width: 600,
  height: 800,
}

const field = (over: Partial<FormField> = {}): FormField => ({
  id: 'f1',
  pageId: 'p1',
  name: 'applicant.name',
  type: 'text',
  rect: { x: 10, y: 20, w: 200, h: 18 },
  defaultValue: '',
  readOnly: false,
  multiline: false,
  ...over,
})

const mount = (fields: FormField[], formValues: Record<string, FormValue> = {}) => {
  store.set({ formFields: { p1: fields }, formValues, zoom: 1, showFormFields: true })
  return render(<FormLayer page={page} />)
}

afterEach(cleanup)

describe('FormLayer', () => {
  it('leaves a field with no length limit unrestricted', () => {
    // pdf.js reports 0 for "no limit"; as an HTML maxlength that would make the
    // field reject every keystroke.
    mount([field({ maxLen: undefined })])
    expect(screen.getByTitle('applicant.name')).not.toHaveAttribute('maxlength')
  })

  it('passes a real length limit through', () => {
    mount([field({ maxLen: 12 })])
    expect(screen.getByTitle('applicant.name')).toHaveAttribute('maxlength', '12')
  })

  it('shows the value already in the document', () => {
    mount([field({ defaultValue: 'Alex Morgan' })])
    expect(screen.getByTitle<HTMLInputElement>('applicant.name').value).toBe('Alex Morgan')
  })

  it('prefers what the user typed over the document value', () => {
    mount([field({ defaultValue: 'Alex Morgan' })], { 'applicant.name': 'Sam Patel' })
    expect(screen.getByTitle<HTMLInputElement>('applicant.name').value).toBe('Sam Patel')
  })

  it('renders a multiline field as a textarea', () => {
    mount([field({ multiline: true })])
    expect(screen.getByTitle('applicant.name').tagName).toBe('TEXTAREA')
  })

  it('marks a read-only field as such', () => {
    mount([field({ readOnly: true })])
    expect(screen.getByTitle('applicant.name')).toHaveAttribute('readonly')
  })

  it('offers every choice of a dropdown', () => {
    mount([
      field({
        type: 'combo',
        options: [
          { value: 'ie', label: 'Ireland' },
          { value: 'uk', label: 'United Kingdom' },
        ],
      }),
    ])
    const select = screen.getByTitle<HTMLSelectElement>('applicant.name')
    expect(select.tagName).toBe('SELECT')
    // the blank option plus the two real ones
    expect(select.options).toHaveLength(3)
  })

  it('renders a checkbox as a toggle that reflects its state', () => {
    mount([field({ id: 'f2', name: 'applicant.news', type: 'checkbox', exportValue: 'Yes' })], {
      'applicant.news': true,
    })
    expect(screen.getByTitle('applicant.news').className).toContain('checked')
  })

  it('draws nothing when form fields are switched off', () => {
    mount([field()])
    store.set({ showFormFields: false })
    cleanup()
    const { container } = render(<FormLayer page={page} />)
    expect(container).toBeEmptyDOMElement()
  })
})
