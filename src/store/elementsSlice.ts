import type { StateCreator } from 'zustand'
import { HISTORY_LIMIT } from '../constants'
import type { EditorElement } from '../types'
import type { EditorStore, ElementsSlice, Snapshot } from './types'

const snapshotOf = (s: EditorStore): Snapshot => ({
  pages: s.pages,
  elements: s.elements,
  formValues: s.formValues,
  decorations: s.decorations,
})

const sameSnapshot = (a: Snapshot, b: Snapshot): boolean =>
  a.pages === b.pages &&
  a.elements === b.elements &&
  a.formValues === b.formValues &&
  a.decorations === b.decorations

export const createElementsSlice: StateCreator<EditorStore, [], [], ElementsSlice> = (
  set,
  get,
) => ({
  elements: [],
  formValues: {},
  decorations: {},
  past: [],
  future: [],

  snapshot: () => snapshotOf(get()),

  commit: (update) => {
    const state = get()
    const prev = snapshotOf(state)
    const next = update(prev)
    if (sameSnapshot(prev, next)) return
    set({
      ...next,
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), prev],
      future: [],
    })
  },

  setNow: (update) => {
    const next = update(snapshotOf(get()))
    set(next)
  },

  pushHistory: () => {
    const state = get()
    set({ past: [...state.past.slice(-(HISTORY_LIMIT - 1)), snapshotOf(state)], future: [] })
  },

  undo: () => {
    const state = get()
    if (!state.past.length) return false
    const prev = state.past[state.past.length - 1]
    set({
      ...prev,
      past: state.past.slice(0, -1),
      future: [...state.future, snapshotOf(state)],
      selectedIds: [],
      session: null,
      liveDraw: null,
    })
    return true
  },

  redo: () => {
    const state = get()
    if (!state.future.length) return false
    const next = state.future[state.future.length - 1]
    set({
      ...next,
      future: state.future.slice(0, -1),
      past: [...state.past, snapshotOf(state)],
      selectedIds: [],
      session: null,
      liveDraw: null,
    })
    return true
  },

  resetHistory: () => set({ past: [], future: [] }),

  addElement: (el, opts) => {
    get().commit((s) => ({ ...s, elements: [...s.elements, el] }))
    if (opts?.select !== false) set({ selectedIds: [el.id] })
  },

  updateElement: (id, patch, live) => {
    const apply = (s: Snapshot): Snapshot => ({
      ...s,
      elements: s.elements.map((el) => (el.id === id ? patch(el) : el)),
    })
    if (live) get().setNow(apply)
    else get().commit(apply)
  },

  removeElements: (ids) => {
    if (!ids.length) return
    const set_ = new Set(ids)
    get().commit((s) => {
      const elements = s.elements.filter((el: EditorElement) => !set_.has(el.id))
      return elements.length === s.elements.length ? s : { ...s, elements }
    })
    set((s) => ({ selectedIds: s.selectedIds.filter((id) => !set_.has(id)) }))
  },

  setFormValue: (name, value) => {
    get().commit((s) => ({ ...s, formValues: { ...s.formValues, [name]: value } }))
  },

  setDecorations: (patch) => {
    get().commit((s) => ({ ...s, decorations: { ...s.decorations, ...patch } }))
  },
})
