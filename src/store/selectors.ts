import { useMemo } from 'react'
import { useStore } from './index'
import type { EditorElement, Line, Page, TextBlock } from '../types'
import type { PageText } from './types'

const EMPTY_TEXT: PageText = { lines: [], blocks: [] }
const EMPTY_ELEMENTS: EditorElement[] = []

export const usePages = (): Page[] => useStore((s) => s.pages)

export const usePage = (pageId: string): Page | undefined =>
  useStore((s) => s.pages.find((p) => p.id === pageId))

export const usePageText = (pageId: string): PageText =>
  useStore((s) => s.pageText[pageId] ?? EMPTY_TEXT)

export const useHasDoc = (): boolean => useStore((s) => s.pages.length > 0)

export const useCanUndo = (): boolean => useStore((s) => s.past.length > 0)
export const useCanRedo = (): boolean => useStore((s) => s.future.length > 0)

/** Elements on one page, in insertion order. */
export function usePageElements(pageId: string): EditorElement[] {
  const all = useStore((s) => s.elements)
  return useMemo(() => {
    const list = all.filter((el) => el.pageId === pageId)
    return list.length ? list : EMPTY_ELEMENTS
  }, [all, pageId])
}

/** Every extracted line across loaded pages, keyed by id. */
export function useLinesById(): Record<string, Line> {
  const pageText = useStore((s) => s.pageText)
  return useMemo(() => linesByIdOf(pageText), [pageText])
}

export function useBlocksById(): Record<string, TextBlock> {
  const pageText = useStore((s) => s.pageText)
  return useMemo(() => blocksByIdOf(pageText), [pageText])
}

export function linesByIdOf(pageText: Record<string, PageText>): Record<string, Line> {
  const map: Record<string, Line> = {}
  for (const pt of Object.values(pageText)) for (const l of pt.lines) map[l.id] = l
  return map
}

export function blocksByIdOf(pageText: Record<string, PageText>): Record<string, TextBlock> {
  const map: Record<string, TextBlock> = {}
  for (const pt of Object.values(pageText)) for (const b of pt.blocks) map[b.id] = b
  return map
}

export const useSelectedElements = (): EditorElement[] => {
  const elements = useStore((s) => s.elements)
  const selectedIds = useStore((s) => s.selectedIds)
  return useMemo(
    () => elements.filter((el) => selectedIds.includes(el.id)),
    [elements, selectedIds],
  )
}
