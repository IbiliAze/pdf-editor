import { useCallback, useEffect, useRef, useState } from 'react'
import './features'
import Toolbar from './components/Toolbar'
import Workspace from './components/Workspace'
import { useStore } from './store'
import { useDragInteraction } from './hooks/useDragInteraction'
import { useKeyboard } from './hooks/useKeyboard'
import { toolById } from './features/registry'
import { downloadPdf } from './actions/exportPdf'
import { AccountMenu, AuthModal, gatedDownload, useAuth } from './features/auth'
import { PageSidebar } from './features/pages'
import { SignatureHost } from './features/signatures'
import { SearchPanel } from './features/search'
import { LinkDialogHost } from './features/annotations'
import { DecorationsPanel, ExportDialog } from './features/doc-tools'
import type { ExportRequest } from './features/doc-tools'
import { clamp } from './lib/colors'

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openFile = useStore((s) => s.openFile)
  const status = useStore((s) => s.status)
  const setStatus = useStore((s) => s.setStatus)
  const loading = useStore((s) => s.loading)
  const tool = useStore((s) => s.tool)
  const pages = useStore((s) => s.pages)
  const fileName = useStore((s) => s.fileName)
  const elementCount = useStore((s) => s.elements.length)

  useDragInteraction()

  const handleOpen = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return
      setStatus(null)
      try {
        await openFile(file)
        // Fit the page to the viewport on small screens; cap at the
        // comfortable desktop default.
        const first = useStore.getState().pages[0]
        if (first) {
          const avail = document.documentElement.clientWidth - 24
          useStore.setState({ zoom: clamp(Math.min(1.25, avail / first.width), 0.4, 1.25) })
        }
      } catch (err) {
        setStatus({ type: 'error', msg: `Could not open PDF: ${(err as Error)?.message ?? err}` })
      }
    },
    [openFile, setStatus],
  )

  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(() => {
    if (!useStore.getState().pages.length) return
    setExporting(true)
  }, [])

  const runExport = useCallback(async (request: ExportRequest) => {
    setExporting(false)
    await gatedDownload(() => downloadPdf(request)).catch(() => undefined)
  }, [])

  useKeyboard(handleExport)

  // Learn who is signed in once, so the download gate never has to guess.
  useEffect(() => {
    void useAuth.getState().refresh()
  }, [])

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 5000)
    return () => clearTimeout(t)
  }, [status, setStatus])

  const hasDoc = pages.length > 0
  const docLabel = hasDoc
    ? `${fileName || 'Untitled'} · ${pages.length} page${pages.length === 1 ? '' : 's'} · ${elementCount} edit${elementCount === 1 ? '' : 's'}`
    : null

  return (
    <div className="app">
      <Toolbar
        onOpen={() => fileInputRef.current?.click()}
        onExport={handleExport}
        right={
          <>
            {docLabel && <span className="doc-label">{docLabel}</span>}
            <AccountMenu />
          </>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          handleOpen(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {hasDoc && <div className="hintbar">{toolById(tool)?.hint}</div>}
      {status && <div className={`notice ${status.type}`}>{status.msg}</div>}
      {loading && <div className="notice info">Loading PDF…</div>}

      <div className="body">
        <PageSidebar />
        <Workspace onOpenFile={handleOpen} onPick={() => fileInputRef.current?.click()} />
        <SearchPanel />
        <DecorationsPanel />
      </div>

      <AuthModal />
      <SignatureHost />
      <LinkDialogHost />
      {exporting && (
        <ExportDialog onClose={() => setExporting(false)} onConfirm={runExport} />
      )}
    </div>
  )
}
