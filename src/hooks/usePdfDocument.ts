import { useCallback, useRef, useState } from 'react'
import { pdfjsLib } from '../lib/pdfjs'
import type { PDFDocumentProxy } from '../lib/pdfjs'
import { extractPageLines } from '../lib/textLayer'
import type { PageInfo } from '../types'

/**
 * Owns the loaded PDF: original bytes (for export), the pdf.js document
 * proxy (for rendering and coordinate conversion), and the extracted
 * per-page text lines.
 */
export function usePdfDocument() {
  const [pages, setPages] = useState<PageInfo[]>([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const bytesRef = useRef<ArrayBuffer | null>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)

  /**
   * Load a file, replacing the current document. Throws on failure.
   * Resolves with the parsed pages (also set into state).
   */
  const open = useCallback(async (file: File): Promise<PageInfo[]> => {
    setLoading(true)
    try {
      const buf = await file.arrayBuffer()
      // pdf.js transfers its buffer to the worker, so give it a copy and
      // keep the pristine original for pdf-lib at export time.
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise

      const list: PageInfo[] = []
      for (let i = 0; i < doc.numPages; i++) {
        const page = await doc.getPage(i + 1)
        const vp = page.getViewport({ scale: 1 })
        list.push({
          pageIndex: i,
          width: vp.width,
          height: vp.height,
          lines: await extractPageLines(page, i),
        })
      }

      // Only swap state once the new document fully parsed, so a failed
      // open leaves the previous document intact.
      if (docRef.current) {
        try {
          docRef.current.destroy()
        } catch {
          // already destroyed
        }
      }
      bytesRef.current = buf
      docRef.current = doc
      setPages(list)
      setFileName(file.name.replace(/\.pdf$/i, ''))
      return list
    } finally {
      setLoading(false)
    }
  }, [])

  return { pages, fileName, loading, bytesRef, docRef, open }
}

export type PdfDocumentApi = ReturnType<typeof usePdfDocument>
