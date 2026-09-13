import { useEffect, useState } from 'react'
import { api } from './api'

type State = 'working' | 'done' | 'error'

const tokenFromUrl = (): string =>
  new URLSearchParams(window.location.search).get('token') ?? ''

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="standalone">
      <a className="brand" href="/">
        <span className="brand-mark">
          <img src="/eight-mile-pdf-logo.png" alt="" />
        </span>
        <span className="brand-name">
          Eight Mile <span>PDF</span>
        </span>
      </a>
      <div className="standalone-card">{children}</div>
    </div>
  )
}

/** Landing page for the link in the confirmation email. */
export function VerifyPage() {
  const [state, setState] = useState<State>('working')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = tokenFromUrl()
    if (!token) {
      setState('error')
      setMessage('That link is missing its confirmation code.')
      return
    }
    api
      .verify(token)
      .then(() => setState('done'))
      .catch((err) => {
        setState('error')
        setMessage((err as Error).message)
      })
  }, [])

  return (
    <Shell>
      {state === 'working' && <p>Confirming your email…</p>}
      {state === 'done' && (
        <>
          <h1>Email confirmed</h1>
          <p>Your account is ready. Head back to the editor to download your PDF.</p>
          <a className="btn primary" href="/">
            Back to the editor
          </a>
        </>
      )}
      {state === 'error' && (
        <>
          <h1>That link did not work</h1>
          <p>{message}</p>
          <a className="btn primary" href="/">
            Back to the editor
          </a>
        </>
      )}
    </Shell>
  )
}

/** Landing page for the link in the password reset email. */
export function ResetPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [state, setState] = useState<State | 'idle'>('idle')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setMessage('Those passwords do not match.')
      return
    }
    setState('working')
    setMessage('')
    try {
      await api.resetPassword(tokenFromUrl(), password)
      setState('done')
    } catch (err) {
      setState('error')
      setMessage((err as Error).message)
    }
  }

  return (
    <Shell>
      <h1>Choose a new password</h1>
      {state === 'done' ? (
        <>
          <p>Your password is updated and you are signed in.</p>
          <a className="btn primary" href="/">
            Back to the editor
          </a>
        </>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="hint">At least 8 characters.</span>
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {message && <p className="auth-error">{message}</p>}
          <button className="btn primary block" type="submit" disabled={state === 'working'}>
            {state === 'working' ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}
    </Shell>
  )
}
