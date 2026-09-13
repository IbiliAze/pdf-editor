let idSeq = 1

/** Unique numeric id for editor elements within a session. */
export const nid = (): number => idSeq++

let strSeq = 1

/** Unique string id with a readable prefix (pages, sources, assets). */
export const sid = (prefix: string): string => `${prefix}-${strSeq++}`

/** Reset the counters. Tests only. */
export const __resetIds = (): void => {
  idSeq = 1
  strSeq = 1
}
