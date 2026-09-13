// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApiError, api } from '../api'
import type { AuthUser, DownloadRecord } from '../api'
import { useAuth } from '../store'
import AuthModal from '../AuthModal'
import AccountMenu from '../AccountMenu'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    api: { ...actual.api, deleteAccount: vi.fn(), downloads: vi.fn() },
  }
})

const deleteAccount = vi.mocked(api.deleteAccount)
const downloads = vi.mocked(api.downloads)

const user = (email: string): AuthUser => ({ email, verified: true, createdAt: '2026-01-01 00:00:00' })
const record = (filename: string): DownloadRecord => ({
  id: 1,
  filename,
  pageCount: 2,
  byteSize: 2048,
  createdAt: '2026-01-02 10:00:00',
})

beforeEach(() => {
  deleteAccount.mockReset()
  downloads.mockReset()
  useAuth.setState({
    user: user('a@example.com'),
    status: 'verified',
    apiAvailable: true,
    view: null,
    busy: false,
    error: null,
    pending: null,
  })
})

afterEach(cleanup)

const openDeleteDialog = () => {
  useAuth.setState({ view: 'delete' })
  render(<AuthModal />)
}

const submitPassword = (password: string) => {
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
}

describe('deleting an account', () => {
  it('names the account and requires the password', () => {
    openDeleteDialog()
    expect(screen.getByText('a@example.com')).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeRequired()
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('deletes with the password, signs out and says so', async () => {
    deleteAccount.mockResolvedValue({ ok: true })
    openDeleteDialog()
    submitPassword('correct horse battery')

    expect(await screen.findByText(/have been deleted/i)).toBeInTheDocument()
    expect(deleteAccount).toHaveBeenCalledWith('correct horse battery')
    expect(useAuth.getState()).toMatchObject({ user: null, status: 'anon', view: 'deleted' })
  })

  it('shows the server message and keeps the account when the password is wrong', async () => {
    deleteAccount.mockRejectedValue(new ApiError('That password is not right.', 'bad_credentials', 401))
    openDeleteDialog()
    submitPassword('not the password')

    expect(await screen.findByText('That password is not right.')).toBeInTheDocument()
    expect(useAuth.getState()).toMatchObject({ status: 'verified', view: 'delete' })
    expect(useAuth.getState().user?.email).toBe('a@example.com')
  })

  it('backs out without calling the server', () => {
    openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }))
    expect(useAuth.getState().view).toBeNull()
    expect(deleteAccount).not.toHaveBeenCalled()
  })
})

describe('account menu', () => {
  it('offers account deletion', async () => {
    downloads.mockResolvedValue({ downloads: [] })
    render(<AccountMenu />)
    fireEvent.click(screen.getByRole('button', { name: /a@example.com/ }))
    // let the downloads request settle before acting on the menu
    expect(await screen.findByText('No downloads yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    expect(useAuth.getState().view).toBe('delete')
  })

  it('never shows one account’s downloads to the next account', async () => {
    downloads.mockResolvedValueOnce({ downloads: [record('first-account.pdf')] })
    render(<AccountMenu />)
    const toggle = () => fireEvent.click(screen.getByRole('button', { name: /@example.com/ }))

    toggle()
    expect(await screen.findByText('first-account.pdf')).toBeInTheDocument()
    toggle()

    downloads.mockResolvedValueOnce({ downloads: [record('second-account.pdf')] })
    act(() => useAuth.setState({ user: user('b@example.com') }))
    toggle()

    expect(await screen.findByText('second-account.pdf')).toBeInTheDocument()
    expect(screen.queryByText('first-account.pdf')).not.toBeInTheDocument()
    await waitFor(() => expect(downloads).toHaveBeenCalledTimes(2))
  })
})
