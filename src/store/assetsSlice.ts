import type { StateCreator } from 'zustand'
import type { AssetsSlice, EditorStore } from './types'

/**
 * Imported images live outside the undo history: they are large, immutable,
 * and referenced by id from the elements that draw them.
 */
export const createAssetsSlice: StateCreator<EditorStore, [], [], AssetsSlice> = (set, get) => ({
  assets: {},

  addAsset: (asset) => set((s) => ({ assets: { ...s.assets, [asset.id]: asset } })),

  getAsset: (id) => get().assets[id],

  clearAssets: () => {
    for (const asset of Object.values(get().assets)) {
      try {
        URL.revokeObjectURL(asset.url)
      } catch {
        // already revoked
      }
    }
    set({ assets: {} })
  },
})
