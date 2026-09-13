import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { createDocumentSlice } from './documentSlice'
import { createEditorSlice } from './editorSlice'
import { createElementsSlice } from './elementsSlice'
import { createUiSlice } from './uiSlice'
import type { EditorStore } from './types'

export const useStore = create<EditorStore>()((...a) => ({
  ...createDocumentSlice(...a),
  ...createElementsSlice(...a),
  ...createEditorSlice(...a),
  ...createUiSlice(...a),
}))

/** Synchronous access for event handlers and async work. */
export const store = {
  get: () => useStore.getState(),
  set: useStore.setState,
  subscribe: useStore.subscribe,
}

export { useShallow }
export * from './selectors'
export type { EditorStore } from './types'
