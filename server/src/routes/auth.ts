import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { SESSION_COOKIE, clientIp, sessionCookieOptions } from '../app.js'
import {
  consumeEmailToken,
  createEmailToken,
  createSession,
  createUser,
  deleteAllSessions,
  deleteSession,
  deleteUser,
  findUserByEmail,
  hashPassword,
  markVerified,
  setMarketingOptIn,
  setPassword,
  verifyPassword,
} from '../auth.js'
import type { User } from '../auth.js'

const VERIFY_TTL_MINUTES = 24 * 60
const RESET_TTL_MINUTES = 60

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(200),
})

const signupBody = credentials.extend({
  marketingOptIn: z.boolean().optional(),
  source: z.string().max(300).optional(),
})
const preferencesBody = z.object({ marketingOptIn: z.boolean() })

const emailOnly = z.object({ email: z.email().max(254) })
const tokenOnly = z.object({ token: z.string().min(10).max(200) })

const publicUser = (user: User) => ({
  email: user.email,
  verified: !!user.verified_at,
  createdAt: user.created_at,
  marketingOptIn: user.marketing_opt_in === 1,
})

/** Parse a body, replying 400 with field messages when it does not fit. */
function parse<T>(schema: z.ZodType<T>, body: unknown): { ok: true; data: T } | { ok: false; message: string } {
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, data: result.data }
  const message = result.error.issues.map((i) => i.message).join('. ')
  return { ok: false, message }
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const { config, db, mailer } = app
  const link = (path: string, token: string) =>
    `${config.APP_ORIGIN}${path}?token=${encodeURIComponent(token)}`

  const startSession = (userId: number, req: { headers: Record<string, unknown> }, reply: {
    setCookie: (n: string, v: string, o: object) => unknown
  }, ip: string) => {
    const session = createSession(
      db,
      userId,
      config.SESSION_TTL_DAYS,
      ip,
      String(req.headers['user-agent'] ?? '').slice(0, 300),
    )
    reply.setCookie(
      SESSION_COOKIE,
      session.secret,
      sessionCookieOptions(config, config.SESSION_TTL_DAYS * 86400),
    )
  }

  app.post(
    '/api/auth/signup',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const parsed = parse(signupBody, req.body)
      if (!parsed.ok) return reply.code(400).send({ error: 'invalid', message: parsed.message })
      const { email, password, marketingOptIn, source } = parsed.data

      const existing = findUserByEmail(db, email)
      if (existing) {
        // Do not reveal that the address is taken: mail the owner instead.
        const token = createEmailToken(db, existing.id, 'reset', RESET_TTL_MINUTES)
        await mailer
          .sendAlreadyRegistered(existing.email, link('/reset', token))
          .catch((err) => app.log.warn({ err }, 'already-registered mail failed'))
        return reply.code(201).send({ ok: true, verified: false })
      }

      const user = createUser(db, email, await hashPassword(password), {
        marketingOptIn,
        signupSource: source,
      })
      const token = createEmailToken(db, user.id, 'verify', VERIFY_TTL_MINUTES)
      await mailer
        .sendVerification(user.email, link('/verify', token))
        .catch((err) => app.log.error({ err }, 'verification mail failed'))
      startSession(user.id, req, reply, clientIp(req))
      return reply.code(201).send({ ok: true, user: publicUser(user) })
    },
  )

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const parsed = parse(credentials, req.body)
      if (!parsed.ok) return reply.code(400).send({ error: 'invalid', message: parsed.message })
      const { email, password } = parsed.data
      const user = findUserByEmail(db, email)
      const ok = user ? await verifyPassword(password, user.password_hash) : false
      if (!user || !ok) {
        return reply.code(401).send({ error: 'bad_credentials', message: 'Email or password is incorrect.' })
      }
      startSession(user.id, req, reply, clientIp(req))
      return reply.send({ ok: true, user: publicUser(user) })
    },
  )

  app.post('/api/auth/logout', async (req, reply) => {
    const secret = req.cookies?.[SESSION_COOKIE]
    if (secret) deleteSession(db, secret)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return reply.send({ ok: true })
  })

  app.get('/api/auth/me', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthenticated' })
    return reply.send({ user: publicUser(req.user) })
  })

  // Consent can be withdrawn from the account menu, as the signup form promises.
  app.post(
    '/api/auth/preferences',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: 'unauthenticated' })
      const parsed = parse(preferencesBody, req.body)
      if (!parsed.ok) return reply.code(400).send({ error: 'invalid', message: parsed.message })
      setMarketingOptIn(db, req.user.id, parsed.data.marketingOptIn)
      return reply.send({ ok: true, user: publicUser(findUserByEmail(db, req.user.email)!) })
    },
  )

  app.post(
    '/api/auth/verify',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const parsed = parse(tokenOnly, req.body)
      if (!parsed.ok) return reply.code(400).send({ error: 'invalid', message: parsed.message })
      const user = consumeEmailToken(db, parsed.data.token, 'verify')
      if (!user) {
        return reply
          .code(400)
          .send({ error: 'bad_token', message: 'That confirmation link has expired or was already used.' })
      }
      markVerified(db, user.id)
      // Signing the visitor in here is what makes clicking the link in another
      // tab or on another device finish the job.
      startSession(user.id, req, reply, clientIp(req))
      const fresh = findUserByEmail(db, user.email)!
      // Told once, on the first confirmation only: a reset link also verifies
      // but goes through reset-password, not here.
      if (!user.verified_at) {
        await mailer
          .sendWelcome(fresh.email)
          .catch((err) => app.log.warn({ err }, 'welcome mail failed'))
      }
      return reply.send({ ok: true, user: publicUser(fresh) })
    },
  )

  app.post(
    '/api/auth/resend-verification',
    { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: 'unauthenticated' })
      if (req.user.verified_at) return reply.send({ ok: true, alreadyVerified: true })
      const token = createEmailToken(db, req.user.id, 'verify', VERIFY_TTL_MINUTES)
      await mailer
        .sendVerification(req.user.email, link('/verify', token))
        .catch((err) => app.log.error({ err }, 'verification mail failed'))
      return reply.send({ ok: true })
    },
  )

  app.post(
    '/api/auth/delete-account',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: 'unauthenticated' })
      const parsed = parse(z.object({ password: z.string().min(1).max(200) }), req.body)
      if (!parsed.ok) return reply.code(400).send({ error: 'invalid', message: parsed.message })
      // The password is asked for again so a borrowed session cannot close
      // someone's account.
      if (!(await verifyPassword(parsed.data.password, req.user.password_hash))) {
        return reply
          .code(401)
          .send({ error: 'bad_credentials', message: 'That password is not right.' })
      }
      const { id, email } = req.user
      deleteUser(db, id)
      req.user = undefined
      reply.clearCookie(SESSION_COOKIE, { path: '/' })
      await mailer
        .sendAccountDeleted(email)
        .catch((err) => app.log.warn({ err }, 'deletion mail failed'))
      return reply.send({ ok: true })
    },
  )

  app.post(
    '/api/auth/forgot-password',
    { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const parsed = parse(emailOnly, req.body)
      if (!parsed.ok) return reply.code(400).send({ error: 'invalid', message: parsed.message })
      const user = findUserByEmail(db, parsed.data.email)
      if (user) {
        const token = createEmailToken(db, user.id, 'reset', RESET_TTL_MINUTES)
        await mailer
          .sendPasswordReset(user.email, link('/reset', token))
          .catch((err) => app.log.error({ err }, 'reset mail failed'))
      }
      // Always the same answer, so this cannot be used to probe for accounts.
      return reply.send({ ok: true })
    },
  )

  app.post(
    '/api/auth/reset-password',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const parsed = parse(
        z.object({ token: z.string().min(10).max(200), password: z.string().min(8).max(200) }),
        req.body,
      )
      if (!parsed.ok) return reply.code(400).send({ error: 'invalid', message: parsed.message })
      const user = consumeEmailToken(db, parsed.data.token, 'reset')
      if (!user) {
        return reply
          .code(400)
          .send({ error: 'bad_token', message: 'That reset link has expired or was already used.' })
      }
      setPassword(db, user.id, await hashPassword(parsed.data.password))
      // Anyone holding an old session is logged out, including an attacker.
      deleteAllSessions(db, user.id)
      // Using a reset link proves the address works.
      markVerified(db, user.id)
      startSession(user.id, req, reply, clientIp(req))
      return reply.send({ ok: true, user: publicUser(findUserByEmail(db, user.email)!) })
    },
  )
}
