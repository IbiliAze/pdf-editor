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

async function verifiedCookie(email: string): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: headers(),
    payload: { email, password: PASSWORD },
  })
  const verify = await app.inject({
    method: 'POST',
    url: '/api/auth/verify',
    headers: headers(),
    payload: { token: lastToken(app) },
  })
  return sessionCookie(verify)
}

const record = (cookie: string, filename = 'report.pdf') =>
  app.inject({
    method: 'POST',
    url: '/api/downloads',
    headers: headers(cookie),
    payload: { filename, pageCount: 3, byteSize: 12345 },
  })

describe('download records', () => {
  it('needs a session', async () => {
    expect((await record('')).statusCode).toBe(401)
  })

  it('needs a verified address', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: headers(),
      payload: { email: 'unverified@example.com', password: PASSWORD },
    })
    const res = await record(sessionCookie(created))
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('unverified')
  })

  it('stores and lists a verified user’s downloads, newest first', async () => {
    const cookie = await verifiedCookie('a@example.com')
    expect((await record(cookie, 'first.pdf')).statusCode).toBe(201)
    expect((await record(cookie, 'second.pdf')).statusCode).toBe(201)

    const list = await app.inject({ method: 'GET', url: '/api/downloads', headers: headers(cookie) })
    const rows = list.json().downloads
    expect(rows).toHaveLength(2)
    expect(rows[0].filename).toBe('second.pdf')
    expect(rows[0]).toMatchObject({ pageCount: 3, byteSize: 12345 })
  })

  it('never shows one user the downloads of another', async () => {
    const mine = await verifiedCookie('mine@example.com')
    await record(mine, 'mine.pdf')
    const theirs = await verifiedCookie('theirs@example.com')

    const list = await app.inject({ method: 'GET', url: '/api/downloads', headers: headers(theirs) })
    expect(list.json().downloads).toHaveLength(0)
  })

  it('rejects a record with no filename', async () => {
    const cookie = await verifiedCookie('a@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/downloads',
      headers: headers(cookie),
      payload: { filename: '' },
    })
    expect(res.statusCode).toBe(400)
  })
})
