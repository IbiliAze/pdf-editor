import { useCallback, useRef, useState } from 'react'
import { HISTORY_LIMIT } from '../constants'
import type { EditorElement } from '../types'

export type ElementsUpdater = EditorElement[] | ((prev: EditorElement[]) => EditorElement[])

/**
 * Owns the list of editor elements plus undo/redo history.
 *
 * State is mirrored into refs so event handlers (drag, blur-commit, export)
 * always see the latest value synchronously; use `elementsRef` in callbacks
 * instead of the `elements` render value.
 */
export function useElements() {
  const [elements, setElements] = useState<EditorElement[]>([])
  const elementsRef = useRef<EditorElement[]>(elements)
  const pastRef = useRef<EditorElement[][]>([])
  const futureRef = useRef<EditorElement[][]>([])

  /** Replace elements without touching history (live typing, drags). */
  const setElementsNow = useCallback((next: EditorElement[]) => {
    elementsRef.current = next
    setElements(next)
  }, [])

  /** Record `snapshot` as an undo step and clear the redo stack. */
  const pushHistory = useCallback((snapshot: EditorElement[]) => {
    pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), snapshot]
    futureRef.current = []
  }, [])

  /** Snapshot the current elements as an undo step (call before mutating). */
  const snapshotHistory = useCallback(() => {
    pushHistory(elementsRef.current)
  }, [pushHistory])

  /** Apply an update and record the previous state as an undo step. */
  const commit = useCallback(
    (updater: ElementsUpdater) => {
      const prev = elementsRef.current
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next === prev) return
      pushHistory(prev)
      setElementsNow(next)
    },
    [pushHistory, setElementsNow],
  )

  /** @returns true if a state was restored (caller should clear selection). */
  const undo = useCallback((): boolean => {
    if (!pastRef.current.length) return false
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, elementsRef.current]
    setElementsNow(prev)
    return true
  }, [setElementsNow])

  /** @returns true if a state was restored (caller should clear selection). */
  const redo = useCallback((): boolean => {
    if (!futureRef.current.length) return false
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    pastRef.current = [...pastRef.current, elementsRef.current]
    setElementsNow(next)
    return true
  }, [setElementsNow])

  /** Drop everything (new document loaded). */
  const reset = useCallback(() => {
    pastRef.current = []
    futureRef.current = []
    setElementsNow([])
  }, [setElementsNow])

  return {
    elements,
    elementsRef,
    setElementsNow,
    commit,
    pushHistory,
    snapshotHistory,
    undo,
    redo,
    reset,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  }
}

export type ElementsApi = ReturnType<typeof useElements>
