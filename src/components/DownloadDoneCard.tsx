import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { eightmileUrl, outbound } from '../lib/eightmile'
import { promoAllowed, promoSeen } from '../lib/promo'

/**
 * The one moment the tool asks for something back: after a download has
 * landed, a single card says who built it. Dismissing or following it keeps
 * the card away for a fortnight in this browser.
 */
export default function DownloadDoneCard() {
  const lastDownloadAt = useStore((s) => s.lastDownloadAt)
  const [shownFor, setShownFor] = useState<number | null>(null)

  useEffect(() => {
    if (lastDownloadAt && promoAllowed()) setShownFor(lastDownloadAt)
  }, [lastDownloadAt])

  if (!shownFor) return null

  const dismiss = () => {
    promoSeen()
    setShownFor(null)
  }

  return (
    <div className="download-card" role="status">
      <p>
        <strong>Your PDF is ready.</strong> Eight Mile PDF is built by Eight Mile, a studio that
        designs websites and builds SaaS products for businesses.
      </p>
      <div className="download-card-actions">
        <a className="btn primary" href={eightmileUrl('post-download')} {...outbound} onClick={dismiss}>
          See what we build
        </a>
        <button className="linkish" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}
