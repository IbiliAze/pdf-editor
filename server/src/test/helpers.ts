import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

export const ORIGIN = 'http://localhost:5173'

export async function testApp(): Promise<FastifyInstance> {
  return buildApp({
    env: {
      DATABASE_PATH: ':memory:',
      APP_ORIGIN: ORIGIN,
      SECURE_COOKIES: 'false',
      MAIL_TRANSPORT: 'json',
      LOG_LEVEL: 'silent',
      TRUST_PROXY_HOPS: '0',
    } as NodeJS.ProcessEnv,
  })
}

export const headers = (cookie?: string) => ({
  origin: ORIGIN,
  ...(cookie ? { cookie } : {}),
})

/** The session cookie from a reply, as a request cookie header. */
export function sessionCookie(res: { cookies: { name: string; value: string }[] }): string {
  const c = res.cookies.find((x) => x.name === 'em_session')
  return c ? `em_session=${c.value}` : ''
}

/** Pull the token out of the most recent mail. */
export function lastToken(app: FastifyInstance): string {
  const mail = app.mailer.sent[app.mailer.sent.length - 1]
  const m = /token=([^\s&"]+)/.exec(mail?.text ?? '')
  return m ? decodeURIComponent(m[1]) : ''
}

export const PASSWORD = 'correct horse battery'
