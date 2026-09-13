// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api } from '../api'
import type { AuthUser } from '../api'
import { useAuth } from '../store'
import AuthModal from '../AuthModal'
import AccountMenu from '../AccountMenu'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    api: { ...actual.api, signup: vi.fn(), setPreferences: vi.fn(), downloads: vi.fn() },
  }
})

const signup = vi.mocked(api.signup)
const setPreferences = vi.mocked(api.setPreferences)
const downloads = vi.mocked(api.downloads)

const user = (marketingOptIn: boolean): AuthUser => ({
  email: 'a@example.com',
  verified: true,
  createdAt: '2026-01-01 00:00:00',
  marketingOptIn,
})

beforeEach(() => {
  signup.mockReset()
  setPreferences.mockReset()
  downloads.mockReset()
  sessionStorage.clear()
  useAuth.setState({
    user: null,
    status: 'anon',
    apiAvailable: true,
    view: 'signup',
    busy: false,
    error: null,
    pending: null,
  })
})

afterEach(cleanup)

const fillAndSubmit = () => {
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'a@example.com' } })
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'correct horse battery' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('signing up', () => {
  it('does not opt anyone in unless they tick the box', async () => {
    signup.mockResolvedValue({ user: { ...user(false), verified: false } })
    render(<AuthModal />)
    expect(screen.getByRole('checkbox', { name: /news from Eight Mile/i })).not.toBeChecked()
    fillAndSubmit()
    await waitFor(() => expect(signup).toHaveBeenCalled())
    expect(signup.mock.calls[0][2]).toMatchObject({ marketingOptIn: false })
  })

  it('sends the consent and the tab’s signup source', async () => {
    sessionStorage.setItem('em-pdf-source', 'campaign:sept')
    signup.mockResolvedValue({ user: { ...user(true), verified: false } })
    render(<AuthModal />)
    fireEvent.click(screen.getByRole('checkbox', { name: /news from Eight Mile/i }))
    fillAndSubmit()
    await waitFor(() => expect(signup).toHaveBeenCalled())
    expect(signup.mock.calls[0][2]).toEqual({ marketingOptIn: true, source: 'campaign:sept' })
  })
})

describe('account menu', () => {
  it('lets the account holder withdraw consent', async () => {
    downloads.mockResolvedValue({ downloads: [] })
    setPreferences.mockResolvedValue({ user: user(false) })
    useAuth.setState({ user: user(true), status: 'verified', view: null })
    render(<AccountMenu />)
    fireEvent.click(screen.getByRole('button', { name: /a@example.com/ }))
    const box = await screen.findByRole('checkbox', { name: 'News from Eight Mile' })
    expect(box).toBeChecked()
    fireEvent.click(box)
    await waitFor(() => expect(setPreferences).toHaveBeenCalledWith(false))
    await waitFor(() => expect(useAuth.getState().user?.marketingOptIn).toBe(false))
  })
})
