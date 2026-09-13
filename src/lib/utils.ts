export { nid, sid } from './ids'
export { normRect } from './geometry'

export function downloadBytes(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // Revoking synchronously races the download in some browsers.
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 4000)
}

/** Strip a trailing .pdf and any path separators from a file name. */
export const baseName = (name: string): string =>
  name.replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '')
