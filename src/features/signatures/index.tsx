import { useState } from 'react'
import { registerFeature } from '../registry'
import { store } from '../../store'
import { importDataUrl, placeImage } from '../images'
import SignatureModal from './SignatureModal'
import type { Page, Point, ToolBehaviour } from '../../types'

let pendingSpot: { page: Page; point: Point } | null = null
let openModal: (() => void) | null = null

const signatureTool: ToolBehaviour = {
  cursor: 'copy',
  pointerDown: ({ page, point, event }) => {
    event.preventDefault()
    pendingSpot = { page, point }
    openModal?.()
  },
}

/** Mounted once by App; the signature tool opens it where the user clicked. */
export function SignatureHost() {
  const [open, setOpen] = useState(false)
  openModal = () => setOpen(true)

  if (!open) return null
  return (
    <SignatureModal
      onClose={() => setOpen(false)}
      onPick={async (dataUrl) => {
        setOpen(false)
        const spot = pendingSpot
        if (!spot) return
        try {
          const asset = await importDataUrl(dataUrl)
          placeImage(asset.id, spot.page.id, spot.point, 'signature')
        } catch (err) {
          store.get().setStatus({
            type: 'error',
            msg: `Could not add that signature: ${(err as Error)?.message ?? err}`,
          })
        }
      }}
    />
  )
}

registerFeature({
  name: 'signatures',
  tools: [
    {
      id: 'signature',
      label: 'Sign',
      icon: '✍',
      group: 'insert',
      order: 22,
      behaviour: signatureTool,
      hint: 'Click where the signature goes, then draw it, type it, or upload a photo of it.',
    },
  ],
})

export { SignatureModal }
