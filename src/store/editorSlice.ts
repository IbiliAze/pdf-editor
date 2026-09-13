import type { StateCreator } from 'zustand'
import { DEFAULT_TEXT_COLOR } from '../constants'
import type { EditorSlice, EditorStore } from './types'

export const createEditorSlice: StateCreator<EditorStore, [], [], EditorSlice> = (set, get) => ({
  tool: 'edittext',
  selectedIds: [],
  session: null,
  liveDraw: null,
  marquee: null,
  textStyle: {
    family: 'Arimo',
    bold: false,
    italic: false,
    size: 16,
    color: DEFAULT_TEXT_COLOR,
  },
  shapeStyle: {
    stroke: '#dc2626',
    strokeWidth: 2,
    fill: null,
    opacity: 1,
  },

  setTool: (id) => {
    if (get().tool === id) return
    set({ tool: id, selectedIds: [], liveDraw: null, marquee: null })
  },

  setSelection: (ids) => set({ selectedIds: ids }),

  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),

  clearSelection: () => set({ selectedIds: [] }),

  setSession: (session) => set({ session }),

  setLiveDraw: (liveDraw) => set({ liveDraw }),

  setMarquee: (marquee) => set({ marquee }),

  setTextStyle: (patch) => set((s) => ({ textStyle: { ...s.textStyle, ...patch } })),

  setShapeStyle: (patch) => set((s) => ({ shapeStyle: { ...s.shapeStyle, ...patch } })),
})
