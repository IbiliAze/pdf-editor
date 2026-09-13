const KEY = 'em-pdf-signatures'
const LIMIT = 6

/** Saved signatures, newest first, as PNG data URLs in this browser only. */
export function loadSignatures(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveSignature(dataUrl: string): string[] {
  const list = [dataUrl, ...loadSignatures().filter((x) => x !== dataUrl)].slice(0, LIMIT)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage full or blocked; the signature still works for this session
  }
  return list
}

export function removeSignature(dataUrl: string): string[] {
  const list = loadSignatures().filter((x) => x !== dataUrl)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
  return list
}
