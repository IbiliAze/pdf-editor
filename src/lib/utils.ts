let idSeq = 1

/** Unique id for editor elements within a session. */
export const nid = (): number => idSeq++

export function downloadBytes(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Normalize a rectangle so width/height are positive. */
export function normRect<T extends { x: number; y: number; w: number; h: number }>(r: T): T {
  let { x, y, w, h } = r
  if (w < 0) {
    x += w
    w = -w
  }
  if (h < 0) {
    y += h
    h = -h
  }
  return { ...r, x, y, w, h }
}
