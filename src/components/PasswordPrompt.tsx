import { useState } from 'react'
import Modal from './Modal'

/** Asks for the password of a protected file before it can be opened. */
export default function PasswordPrompt({
  fileName,
  wrongPassword,
  onCancel,
  onSubmit,
}: {
  fileName: string
  wrongPassword: boolean
  onCancel: () => void
  onSubmit: (password: string) => void
}) {
  const [password, setPassword] = useState('')

  return (
    <Modal
      title="This PDF is protected"
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" disabled={!password} onClick={() => onSubmit(password)}>
            Open
          </button>
        </>
      }
    >
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (password) onSubmit(password)
        }}
      >
        <p className="modal-lead">
          <strong>{fileName}</strong> needs a password to open. It is used here in your browser
          only and is never sent anywhere.
        </p>
        <label>
          Password
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {wrongPassword && <p className="auth-error">That password did not work.</p>}
      </form>
    </Modal>
  )
}
