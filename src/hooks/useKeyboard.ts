import { useEffect } from 'react'
import { store } from '../store'
import { deleteSelected, duplicateSelected, nudgeSelected } from '../actions/elements'
import { commitSession } from '../features/text-edit/session'

const isEditable = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  )
}

/** Global editor shortcuts. */
export function useKeyboard(onExport: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = store.get()
      const editable = isEditable(e.target)
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (mod && key === 'z' && !editable) {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && key === 'y' && !editable) {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && key === 'f') {
        e.preventDefault()
        store.set({ panel: s.panel === 'search' ? null : 'search' })
        return
      }
      if (mod && key === 's') {
        e.preventDefault()
        onExport()
        return
      }
      if (mod && key === 'd' && !editable) {
        e.preventDefault()
        duplicateSelected()
        return
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault()
        s.zoomStep(1)
        return
      }
      if (mod && key === '-') {
        e.preventDefault()
        s.zoomStep(-1)
        return
      }

      if (editable) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedIds.length) {
        e.preventDefault()
        deleteSelected()
        return
      }
      if (e.key === 'Escape') {
        if (s.session) commitSession()
        s.clearSelection()
        return
      }
      if (e.key.startsWith('Arrow') && s.selectedIds.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        if (e.key === 'ArrowLeft') nudgeSelected(-step, 0)
        if (e.key === 'ArrowRight') nudgeSelected(step, 0)
        if (e.key === 'ArrowUp') nudgeSelected(0, -step)
        if (e.key === 'ArrowDown') nudgeSelected(0, step)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExport])
}
