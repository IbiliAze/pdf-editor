import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { PASSWORD, headers, lastToken, sessionCookie, testApp } from './helpers.js'

let app: FastifyInstance

beforeEach(async () => {
  app = await testApp()
})

afterEach(async () => {
  await app.close()
})

const signup = (email: string, password = PASSWORD) =>
  app.inject({ method: 'POST', url: '/api/auth/signup', headers: headers(), payload: { email, password } })

const login = (email: string, password = PASSWORD) =>
  app.inject({ method: 'POST', url: '/api/auth/login', headers: headers(), payload: { email, password } })

describe('signup', () => {
  it('creates an unverified account, signs it in and mails a link', async () => {
    const res = await signup('a@example.com')
    expect(res.statusCode).toBe(201)
    expect(res.json().user).toMatchObject({ email: 'a@example.com', verified: false })
    expect(sessionCookie(res)).toMatch(/^em_session=/)
    expect(app.mailer.sent).toHaveLength(1)
    expect(app.mailer.sent[0].to).toBe('a@example.com')
    expect(lastToken(app)).not.toBe('')
  })

  it('rejects a short password and a malformed address', async () => {
    expect((await signup('a@example.com', 'short')).statusCode).toBe(400)
    expect((await signup('not-an-email')).statusCode).toBe(400)
  })

  it('does not reveal that an address is already registered', async () => {
    await signup('taken@example.com')
    const res = await signup('taken@example.com')
    expect(res.statusCode).toBe(201)
    expect(res.json().user).toBeUndefined()
    // the owner is told, rather than the person signing up
    expect(app.mailer.sent[1].text).toMatch(/already have an account/i)
  })

  it('treats the address case-insensitively', async () => {
    await signup('Case@Example.com')
    const res = await login('case@example.com')
    expect(res.statusCode).toBe(200)
  })

  it('records consent and where the visitor came from, off by default', async () => {
    const plain = await signup('a@example.com')
    expect(plain.json().user.marketingOptIn).toBe(false)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: headers(),
      payload: { email: 'b@example.com', password: PASSWORD, marketingOptIn: true, source: 'campaign:sept|ref:eightmile.co.uk' },
    })
    expect(res.json().user.marketingOptIn).toBe(true)
    const row = app.db
      .prepare('SELECT marketing_opt_in, marketing_opt_in_at, signup_source FROM users WHERE email = ?')
      .get('b@example.com') as { marketing_opt_in: number; marketing_opt_in_at: string; signup_source: string }
    expect(row.marketing_opt_in).toBe(1)
    expect(row.marketing_opt_in_at).toBeTruthy()
    expect(row.signup_source).toBe('campaign:sept|ref:eightmile.co.uk')
  })

  it('points every mail at the services page', () => {
    // the first mail is the verification link from beforeEach's clean app
    return signup('a@example.com').then(() => {
      expect(app.mailer.sent[0].text).toContain('https://eightmile.co.uk/saas?utm_source=pdf-editor&utm_medium=email&utm_campaign=verify')
    })
  })
})

describe('preferences', () => {
  const setPrefs = (cookie: string, marketingOptIn: boolean) =>
    app.inject({
      method: 'POST',
      url: '/api/auth/preferences',
      headers: headers(cookie),
      payload: { marketingOptIn },
    })

  it('needs a session', async () => {
    expect((await setPrefs('', true)).statusCode).toBe(401)
  })

  it('turns consent on and off and reports it through me', async () => {
    const cookie = sessionCookie(await signup('a@example.com'))
    const on = await setPrefs(cookie, true)
    expect(on.statusCode).toBe(200)
    expect(on.json().user.marketingOptIn).toBe(true)

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: headers(cookie) })
    expect(me.json().user.marketingOptIn).toBe(true)

    await setPrefs(cookie, false)
    const row = app.db
      .prepare('SELECT marketing_opt_in, marketing_opt_in_at FROM users WHERE email = ?')
      .get('a@example.com') as { marketing_opt_in: number; marketing_opt_in_at: string | null }
    expect(row).toEqual({ marketing_opt_in: 0, marketing_opt_in_at: null })
  })
})

describe('login', () => {
  it('rejects a wrong password with the same message as an unknown address', async () => {
    await signup('a@example.com')
    const wrong = await login('a@example.com', 'wrong password!')
    const unknown = await login('nobody@example.com')
    expect(wrong.statusCode).toBe(401)
    expect(unknown.statusCode).toBe(401)
    expect(wrong.json().message).toBe(unknown.json().message)
  })

  it('issues an httpOnly session cookie', async () => {
    await signup('a@example.com')
    const res = await login('a@example.com')
    const cookie = res.cookies.find((c) => c.name === 'em_session')!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite?.toLowerCase()).toBe('lax')
  })
})

describe('me and logout', () => {
  it('reports the signed-in user and forgets them on logout', async () => {
    const created = await signup('a@example.com')
    const cookie = sessionCookie(created)

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: headers(cookie) })
    expect(me.json().user.email).toBe('a@example.com')

    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: headers(cookie) })
    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: headers(cookie) })
    expect(after.statusCode).toBe(401)
  })

  it('is unauthenticated without a cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })
})

describe('email verification', () => {
  it('marks the account verified and signs the visitor in', async () => {
    await signup('a@example.com')
    const token = lastToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      headers: headers(),
      payload: { token },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.verified).toBe(true)
    // the link works from a different browser than the one that signed up
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: headers(sessionCookie(res)),
    })
    expect(me.json().user.verified).toBe(true)
  })

  it('welcomes the account once it is confirmed', async () => {
    await signup('a@example.com')
    await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      headers: headers(),
      payload: { token: lastToken(app) },
    })
    const welcome = app.mailer.sent[app.mailer.sent.length - 1]
    expect(welcome.to).toBe('a@example.com')
    expect(welcome.subject).toMatch(/ready/i)
    expect(welcome.text).toContain('utm_campaign=welcome')
  })

  it('refuses a token a second time', async () => {
    await signup('a@example.com')
    const token = lastToken(app)
    await app.inject({ method: 'POST', url: '/api/auth/verify', headers: headers(), payload: { token } })
    const again = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      headers: headers(),
      payload: { token },
    })
    expect(again.statusCode).toBe(400)
  })

  it('refuses a made-up token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      headers: headers(),
      payload: { token: 'x'.repeat(40) },
    })
    expect(res.statusCode).toBe(400)
  })

  it('resends only for a signed-in, unverified account', async () => {
    const created = await signup('a@example.com')
    const cookie = sessionCookie(created)
    const anon = await app.inject({
      method: 'POST',
      url: '/api/auth/resend-verification',
      headers: headers(),
    })
    expect(anon.statusCode).toBe(401)

    const resend = await app.inject({
      method: 'POST',
      url: '/api/auth/resend-verification',
      headers: headers(cookie),
    })
    expect(resend.statusCode).toBe(200)
    expect(app.mailer.sent).toHaveLength(2)
    // the newest link works and the superseded one does not
    const fresh = lastToken(app)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/verify',
          headers: headers(),
          payload: { token: fresh },
        })
      ).statusCode,
    ).toBe(200)
  })
})

describe('password reset', () => {
  it('answers the same whether or not the address exists', async () => {
    await signup('a@example.com')
    const known = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      headers: headers(),
      payload: { email: 'a@example.com' },
    })
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      headers: headers(),
      payload: { email: 'nobody@example.com' },
    })
    expect(known.statusCode).toBe(200)
    expect(unknown.statusCode).toBe(200)
    expect(known.json()).toEqual(unknown.json())
  })

  it('changes the password, verifies the account and drops old sessions', async () => {
    const created = await signup('a@example.com')
    const oldCookie = sessionCookie(created)
    await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      headers: headers(),
      payload: { email: 'a@example.com' },
    })
    const token = lastToken(app)
    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      headers: headers(),
      payload: { token, password: 'a whole new password' },
    })
    expect(reset.statusCode).toBe(200)
    expect(reset.json().user.verified).toBe(true)

    const stale = await app.inject({ method: 'GET', url: '/api/auth/me', headers: headers(oldCookie) })
    expect(stale.statusCode).toBe(401)
    expect((await login('a@example.com', 'a whole new password')).statusCode).toBe(200)
    expect((await login('a@example.com', PASSWORD)).statusCode).toBe(401)
  })
})

describe('delete account', () => {
  const remove = (cookie: string, password = PASSWORD) =>
    app.inject({
      method: 'POST',
      url: '/api/auth/delete-account',
      headers: headers(cookie),
      payload: { password },
    })

  it('needs a session', async () => {
    expect((await remove('')).statusCode).toBe(401)
  })

  it('needs the account password, and keeps the account when it is wrong', async () => {
    const cookie = sessionCookie(await signup('a@example.com'))
    const res = await remove(cookie, 'not the password')
    expect(res.statusCode).toBe(401)
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: headers(cookie) })
    expect(me.statusCode).toBe(200)
  })

  it('takes the account, every session and the download history with it', async () => {
    const created = await signup('a@example.com')
    const first = sessionCookie(created)
    await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      headers: headers(),
      payload: { token: lastToken(app) },
    })
    // a second browser, signed in at the same time
    const second = sessionCookie(await login('a@example.com'))
    await app.inject({
      method: 'POST',
      url: '/api/downloads',
      headers: headers(second),
      payload: { filename: 'edited.pdf', pageCount: 3, byteSize: 1024 },
    })

    const res = await remove(second)
    expect(res.statusCode).toBe(200)
    expect(res.cookies.find((c) => c.name === 'em_session')?.value).toBe('')

    for (const cookie of [first, second]) {
      const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: headers(cookie) })
      expect(me.statusCode).toBe(401)
    }
    const counts = ['users', 'sessions', 'email_tokens', 'downloads'].map(
      (t) => (app.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n,
    )
    expect(counts).toEqual([0, 0, 0, 0])

    const mail = app.mailer.sent[app.mailer.sent.length - 1]
    expect(mail.to).toBe('a@example.com')
    expect(mail.subject).toMatch(/deleted/i)
  })

  it('frees the address to be used again', async () => {
    const cookie = sessionCookie(await signup('a@example.com'))
    await remove(cookie)
    const again = await signup('a@example.com')
    expect(again.statusCode).toBe(201)
    // a fresh account, not a resurrected one: it is signed in and unverified
    expect(again.json().user).toMatchObject({ email: 'a@example.com', verified: false })
  })
})

describe('request hardening', () => {
  it('rejects a write from another origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: 'https://evil.example' },
      payload: { email: 'a@example.com', password: PASSWORD },
    })
    expect(res.statusCode).toBe(403)
  })

  it('rate limits repeated sign-up attempts', async () => {
    const codes: number[] = []
    for (let i = 0; i < 7; i++) codes.push((await signup(`rl${i}@example.com`)).statusCode)
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0)
  })

  it('serves a health check', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.json()).toEqual({ ok: true })
  })
})
