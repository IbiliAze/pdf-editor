export interface AuthUser {
  email: string
  verified: boolean
  createdAt: string
}

export interface DownloadRecord {
  id: number
  filename: string
  pageCount: number
  byteSize: number
  createdAt: string
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

const MESSAGES: Record<string, string> = {
  bad_credentials: 'Email or password is incorrect.',
  unauthenticated: 'Please sign in.',
  unverified: 'Confirm your email address first.',
  forbidden_origin: 'That request was blocked. Reload the page and try again.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      credentials: 'include',
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
      ...init,
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 'network', 0)
  }
  if (res.status === 429) throw new ApiError(MESSAGES.rate_limited, 'rate_limited', 429)

  let body: { error?: string; message?: string } & Record<string, unknown> = {}
  try {
    body = await res.json()
  } catch {
    body = {}
  }
  if (!res.ok) {
    const code = body.error ?? 'error'
    throw new ApiError(body.message ?? MESSAGES[code] ?? 'Something went wrong.', code, res.status)
  }
  return body as T
}

const post = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: 'POST', body: payload ? JSON.stringify(payload) : undefined })

export const api = {
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
  signup: (email: string, password: string) =>
    post<{ user?: AuthUser }>('/api/auth/signup', { email, password }),
  login: (email: string, password: string) =>
    post<{ user: AuthUser }>('/api/auth/login', { email, password }),
  logout: () => post<{ ok: true }>('/api/auth/logout'),
  resendVerification: () => post<{ ok: true }>('/api/auth/resend-verification'),
  verify: (token: string) => post<{ user: AuthUser }>('/api/auth/verify', { token }),
  forgotPassword: (email: string) => post<{ ok: true }>('/api/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    post<{ user: AuthUser }>('/api/auth/reset-password', { token, password }),
  recordDownload: (filename: string, pageCount: number, byteSize: number) =>
    post<{ ok: true }>('/api/downloads', { filename, pageCount, byteSize }),
  downloads: () => request<{ downloads: DownloadRecord[] }>('/api/downloads'),
}
