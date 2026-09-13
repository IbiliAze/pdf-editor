/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EditorElement, ElementKind, ToolDef } from '../types'

const kinds = new Map<string, ElementKind<any>>()
const toolList: ToolDef[] = []

export interface FeatureModule {
  name: string
  elements?: ElementKind<any>[]
  tools?: ToolDef[]
}

const registered = new Set<string>()

export function registerFeature(feature: FeatureModule): void {
  if (registered.has(feature.name)) return
  registered.add(feature.name)
  for (const kind of feature.elements ?? []) kinds.set(kind.type, kind)
  for (const tool of feature.tools ?? []) toolList.push(tool)
  toolList.sort((a, b) => a.order - b.order)
}

export function elementKind(type: string): ElementKind<any> | undefined {
  return kinds.get(type)
}

export function kindOf(el: EditorElement): ElementKind<any> | undefined {
  return kinds.get(el.type)
}

export const allTools = (): ToolDef[] => toolList

export const toolById = (id: string): ToolDef | undefined => toolList.find((t) => t.id === id)

/** Sort elements into export order: layer bucket first, insertion order within. */
export function inDrawOrder(elements: EditorElement[]): EditorElement[] {
  return elements
    .map((el, i) => ({ el, i, layer: kinds.get(el.type)?.layer ?? 0 }))
    .sort((a, b) => a.layer - b.layer || a.i - b.i)
    .map((e) => e.el)
}

/** Tests only. */
export const __resetRegistry = (): void => {
  kinds.clear()
  toolList.length = 0
  registered.clear()
}
