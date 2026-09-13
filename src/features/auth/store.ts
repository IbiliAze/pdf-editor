import { create } from 'zustand'
import { ApiError, api } from './api'
import type { AuthUser } from './api'

export type AuthStatus = 'unknown' | 'anon' | 'unverified' | 'verified'
export type AuthView = 'signin' | 'signup' | 'sent' | 'forgot' | 'forgot-sent' | 'delete' | 'deleted'

export interface PendingDownload {
  run: () => Promise<void>
  label: string
}

interface AuthState {
  user: AuthUser | null
  status: AuthStatus
  /** false when the API is not reachable, so the gate can let downloads run */
  apiAvailable: boolean
  view: AuthView | null
  busy: boolean
  error: string | null
  pending: PendingDownload | null

  refresh: () => Promise<AuthStatus>
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resend: () => Promise<void>
  forgot: (email: string) => Promise<void>
  deleteAccount: (password: string) => Promise<void>
  adoptUser: (user: AuthUser) => void
  open: (view: AuthView, pending?: PendingDownload | null) => void
  close: () => void
  setView: (view: AuthView) => void
  runPending: () => Promise<void>
}

const statusOf = (user: AuthUser | null): AuthStatus =>
  !user ? 'anon' : user.verified ? 'verified' : 'unverified'

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  status: 'unknown',
  apiAvailable: true,
  view: null,
  busy: false,
  error: null,
  pending: null,

  refresh: async () => {
    try {
      const { user } = await api.me()
      set({ user, status: statusOf(user), apiAvailable: true })
    } catch (err) {
      const apiErr = err as ApiError
      // A network failure means accounts are unavailable, not that the visitor
      // is signed out: downloads must not be blocked by our own outage.
      if (apiErr.code === 'network') set({ user: null, status: 'anon', apiAvailable: false })
      else set({ user: null, status: 'anon', apiAvailable: true })
    }
    const status = get().status
    if (status === 'verified') await get().runPending()
    return status
  },

  signup: async (email, password) => {
    set({ busy: true, error: null })
    try {
      const res = await api.signup(email, password)
      if (res.user) set({ user: res.user, status: statusOf(res.user) })
      set({ view: 'sent' })
    } catch (err) {
      set({ error: (err as Error).message })
    } finally {
      set({ busy: false })
    }
  },

  login: async (email, password) => {
    set({ busy: true, error: null })
    try {
      const { user } = await api.login(email, password)
      set({ user, status: statusOf(user) })
      if (user.verified) {
        set({ view: null })
        await get().runPending()
      } else {
        set({ view: 'sent' })
      }
    } catch (err) {
      set({ error: (err as Error).message })
    } finally {
      set({ busy: false })
    }
  },

  logout: async () => {
    try {
      await api.logout()
    } catch {
      // signing out locally is the important part
    }
    set({ user: null, status: 'anon', pending: null })
  },

  resend: async () => {
    set({ busy: true, error: null })
    try {
      await api.resendVerification()
    } catch (err) {
      set({ error: (err as Error).message })
    } finally {
      set({ busy: false })
    }
  },

  forgot: async (email) => {
    set({ busy: true, error: null })
    try {
      await api.forgotPassword(email)
      set({ view: 'forgot-sent' })
    } catch (err) {
      set({ error: (err as Error).message })
    } finally {
      set({ busy: false })
    }
  },

  deleteAccount: async (password) => {
    set({ busy: true, error: null })
    try {
      await api.deleteAccount(password)
      // The server has already ended every session; forget the user here too.
      set({ user: null, status: 'anon', pending: null, view: 'deleted' })
    } catch (err) {
      set({ error: (err as Error).message })
    } finally {
      set({ busy: false })
    }
  },

  adoptUser: (user) => {
    set({ user, status: statusOf(user), apiAvailable: true })
  },

  open: (view, pending) => set({ view, error: null, ...(pending !== undefined ? { pending } : {}) }),

  close: () => set({ view: null, error: null, pending: null }),

  setView: (view) => set({ view, error: null }),

  runPending: async () => {
    const pending = get().pending
    if (!pending) return
    set({ pending: null, view: null })
    await pending.run()
  },
}))
