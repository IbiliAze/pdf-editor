import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { DownloadRecord } from './api'
import { useAuth } from './store'

const formatBytes = (n: number): string => {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const formatDate = (iso: string): string => {
  const d = new Date(iso.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export default function AccountMenu() {
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)
  const apiAvailable = useAuth((s) => s.apiAvailable)
  const open = useAuth((s) => s.open)
  const logout = useAuth((s) => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)
  const [downloads, setDownloads] = useState<DownloadRecord[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen || downloads) return
    api
      .downloads()
      .then((r) => setDownloads(r.downloads))
      .catch(() => setDownloads([]))
  }, [menuOpen, downloads])

  if (!apiAvailable || status === 'unknown') return null

  if (status === 'anon') {
    return (
      <button className="btn" onClick={() => open('signin')}>
        Sign in
      </button>
    )
  }

  const initial = (user?.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="account" ref={ref}>
      <button
        className={`btn account-btn${status === 'unverified' ? ' warn' : ''}`}
        onClick={() => setMenuOpen((v) => !v)}
        title={user?.email}
      >
        <span className="avatar">{initial}</span>
        <span className="account-email">{user?.email}</span>
      </button>
      {menuOpen && (
        <div className="account-menu">
          <div className="account-head">
            <strong>{user?.email}</strong>
            {status === 'unverified' ? (
              <button className="linkish" onClick={() => open('sent')}>
                Email not confirmed — confirm now
              </button>
            ) : (
              <span className="hint">Email confirmed</span>
            )}
          </div>
          <div className="account-downloads">
            <h4>Recent downloads</h4>
            {downloads === null && <p className="hint">Loading…</p>}
            {downloads?.length === 0 && <p className="hint">No downloads yet.</p>}
            {!!downloads?.length && (
              <ul>
                {downloads.slice(0, 12).map((d) => (
                  <li key={d.id}>
                    <span className="dl-name" title={d.filename}>
                      {d.filename}
                    </span>
                    <span className="hint">
                      {d.pageCount} page{d.pageCount === 1 ? '' : 's'} · {formatBytes(d.byteSize)} ·{' '}
                      {formatDate(d.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            className="btn block"
            onClick={() => {
              setMenuOpen(false)
              void logout()
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
