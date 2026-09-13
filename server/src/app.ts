import Fastify from 'fastify'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { loadConfig } from './config.js'
import type { Config } from './config.js'
import { openDb } from './db.js'
import type { Db } from './db.js'
import { createMailer } from './mail.js'
import type { Mailer } from './mail.js'
import { pruneExpired, userForSession } from './auth.js'
import type { User } from './auth.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerDownloadRoutes } from './routes/downloads.js'

export const SESSION_COOKIE = 'em_session'

declare module 'fastify' {
  interface FastifyInstance {
    config: Config
    db: Db
    mailer: Mailer
  }
  interface FastifyRequest {
    user?: User
  }
}

export interface BuildOptions {
  env?: NodeJS.ProcessEnv
  config?: Partial<Config>
}

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const config = { ...loadConfig(opts.env), ...opts.config }

  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    // The app sits behind the shared nginx site and the app container's own
    // nginx, so the client address comes from X-Forwarded-For. Trusting a
    // fixed number of hops stops a client from spoofing its own address, and
    // without it every request would be rate limited against the proxy.
    trustProxy: (_addr: string, hop: number) => hop < config.TRUST_PROXY_HOPS,
    bodyLimit: 64 * 1024,
  })

  app.decorate('config', config)
  app.decorate('db', openDb(config.DATABASE_PATH))
  app.decorate('mailer', createMailer(config))
  app.decorateRequest('user', undefined)

  await app.register(cookie)
  await app.register(rateLimit, { global: false })

  app.addHook('onRequest', async (req) => {
    const secret = req.cookies?.[SESSION_COOKIE]
    if (secret) req.user = userForSession(app.db, secret)
  })

  // SameSite=Lax already blocks cross-site form posts; this also rejects
  // cross-origin fetches that carry the cookie.
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return
    const origin = req.headers.origin
    if (origin && origin !== config.APP_ORIGIN) {
      reply.code(403).send({ error: 'forbidden_origin' })
    }
  })

  app.get('/api/health', async () => ({ ok: true }))

  await registerAuthRoutes(app)
  await registerDownloadRoutes(app)

  const prune = setInterval(() => {
    try {
      pruneExpired(app.db)
    } catch (err) {
      app.log.warn({ err }, 'prune failed')
    }
  }, 3600_000)
  prune.unref?.()

  app.addHook('onClose', async () => {
    clearInterval(prune)
    try {
      app.db.close()
    } catch {
      // already closed
    }
  })

  return app
}

/** Cookie options shared by every place that sets the session cookie. */
export const sessionCookieOptions = (config: Config, maxAgeSeconds: number) => ({
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.SECURE_COOKIES,
  maxAge: maxAgeSeconds,
})

export const clientIp = (req: FastifyRequest): string => req.ip ?? 'unknown'
