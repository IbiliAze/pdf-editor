import type { StateCreator } from 'zustand'
import { ZOOM_LEVELS } from '../constants'
import type { EditorStore, UiSlice } from './types'

export const createUiSlice: StateCreator<EditorStore, [], [], UiSlice> = (set) => ({
  zoom: 1.25,
  fitMode: 'none',
  sidebarOpen: false,
  panel: null,
  activePageId: null,
  status: null,
  showFormFields: true,

  setZoom: (zoom) => set({ zoom, fitMode: 'none' }),

  // Zoom can be an arbitrary fit-to-width value, so step to the nearest preset
  // level in the requested direction.
  zoomStep: (dir) =>
    set((s) => {
      const z = s.zoom
      const next =
        dir === 1
          ? (ZOOM_LEVELS.find((l) => l > z + 0.01) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1])
          : ([...ZOOM_LEVELS].reverse().find((l) => l < z - 0.01) ?? ZOOM_LEVELS[0])
      return { zoom: next, fitMode: 'none' }
    }),

  setFitMode: (fitMode) => set({ fitMode }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setPanel: (panel) => set({ panel }),
  setActivePageId: (activePageId) => set({ activePageId }),
  setStatus: (status) => set({ status }),
  setShowFormFields: (showFormFields) => set({ showFormFields }),
})
