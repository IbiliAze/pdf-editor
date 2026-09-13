import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import { useAuth } from './store'

const TITLES: Record<string, string> = {
  signin: 'Sign in',
  signup: 'Create an account',
  sent: 'Check your email',
  forgot: 'Reset your password',
  'forgot-sent': 'Check your email',
  delete: 'Delete your account',
  deleted: 'Account deleted',
}

export default function AuthModal() {
  const view = useAuth((s) => s.view)
  const busy = useAuth((s) => s.busy)
  const error = useAuth((s) => s.error)
  const user = useAuth((s) => s.user)
  const pending = useAuth((s) => s.pending)
  const close = useAuth((s) => s.close)
  const setView = useAuth((s) => s.setView)
  const login = useAuth((s) => s.login)
  const signup = useAuth((s) => s.signup)
  const forgot = useAuth((s) => s.forgot)
  const deleteAccount = useAuth((s) => s.deleteAccount)
  const resend = useAuth((s) => s.resend)
  const refresh = useAuth((s) => s.refresh)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resent, setResent] = useState(false)

  // While the visitor is off clicking the link in their inbox, keep asking
  // whether it has been used so the download can start on its own.
  useEffect(() => {
    if (view !== 'sent') return
    const id = setInterval(() => void refresh(), 5000)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [view, refresh])

  if (!view) return null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (view === 'signin') void login(email.trim(), password)
    else if (view === 'signup') void signup(email.trim(), password)
    else if (view === 'forgot') void forgot(email.trim())
    else if (view === 'delete') void deleteAccount(password)
  }

  return (
    <Modal title={TITLES[view]} onClose={close}>
      {pending && view !== 'sent' && (
        <p className="modal-lead">
          Creating an account unlocks downloads. Your PDF never leaves this browser — only your
          email address and a record of the download are stored.
        </p>
      )}

      {(view === 'signin' || view === 'signup' || view === 'forgot') && (
        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {view !== 'forgot' && (
            <label>
              Password
              <input
                type="password"
                autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {view === 'signup' && <span className="hint">At least 8 characters.</span>}
            </label>
          )}
          {error && <p className="auth-error">{error}</p>}
          <button className="btn primary block" type="submit" disabled={busy}>
            {busy
              ? 'Working…'
              : view === 'signup'
                ? 'Create account'
                : view === 'forgot'
                  ? 'Send reset link'
                  : 'Sign in'}
          </button>
        </form>
      )}

      {view === 'sent' && (
        <div className="auth-sent">
          <p>
            We sent a confirmation link to <strong>{user?.email || email || 'your inbox'}</strong>.
            Open it and {pending ? 'your download will start automatically' : 'your account is ready'}.
          </p>
          <p className="hint">This page checks for you every few seconds.</p>
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-actions">
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                await resend()
                setResent(true)
              }}
            >
              {resent ? 'Sent again' : 'Resend email'}
            </button>
            <button className="btn" disabled={busy} onClick={() => void refresh()}>
              I have confirmed
            </button>
          </div>
        </div>
      )}

      {view === 'delete' && (
        <form onSubmit={submit} className="auth-form">
          <div className="auth-warning">
            <p>
              <strong>This cannot be undone.</strong> The account for{' '}
              <strong>{user?.email}</strong> and the record of every download made with it are
              removed from the server.
            </p>
            <p>
              Anything open in the editor stays open. Your PDFs were never uploaded, so there is
              nothing of them to delete.
            </p>
          </div>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="hint">Enter your password to confirm.</span>
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn danger block" type="submit" disabled={busy}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </form>
      )}

      {view === 'deleted' && (
        <div className="auth-sent">
          <p>Your account and your download history have been deleted.</p>
          <p className="hint">You can keep editing. Downloading again needs a new account.</p>
          <button className="btn primary block" onClick={close}>
            Done
          </button>
        </div>
      )}

      {view === 'forgot-sent' && (
        <p>
          If an account exists for <strong>{email}</strong>, a reset link is on its way. The link
          is good for one hour.
        </p>
      )}

      {view !== 'deleted' && (
        <div className="auth-switch">
          {view === 'signin' && (
            <>
              <button className="linkish" onClick={() => setView('signup')}>
                Create an account
              </button>
              <button className="linkish" onClick={() => setView('forgot')}>
                Forgot password?
              </button>
            </>
          )}
          {view === 'signup' && (
            <button className="linkish" onClick={() => setView('signin')}>
              I already have an account
            </button>
          )}
          {(view === 'forgot' || view === 'forgot-sent') && (
            <button className="linkish" onClick={() => setView('signin')}>
              Back to sign in
            </button>
          )}
          {view === 'delete' && (
            <button className="linkish" onClick={close}>
              Keep my account
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
