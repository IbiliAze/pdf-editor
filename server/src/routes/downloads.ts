import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { all, run } from '../db.js'

const record = z.object({
  filename: z.string().min(1).max(300),
  pageCount: z.coerce.number().int().min(0).max(100000).default(0),
  byteSize: z.coerce.number().int().min(0).default(0),
})

interface DownloadRow {
  id: number
  filename: string
  page_count: number
  byte_size: number
  created_at: string
}

export async function registerDownloadRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app

  app.post(
    '/api/downloads',
    { config: { rateLimit: { max: 120, timeWindow: '1 hour' } } },
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: 'unauthenticated' })
      if (!req.user.verified_at) {
        return reply
          .code(403)
          .send({ error: 'unverified', message: 'Confirm your email address first.' })
      }
      const parsed = record.safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: 'invalid' })
      const { filename, pageCount, byteSize } = parsed.data
      await run(
        db,
        'INSERT INTO downloads (user_id, filename, page_count, byte_size) VALUES (?, ?, ?, ?)',
        [req.user.id, filename, pageCount, byteSize],
      )
      return reply.code(201).send({ ok: true })
    },
  )

  app.get('/api/downloads', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthenticated' })
    // LIMIT is written into the statement rather than bound: a prepared
    // placeholder there is sent as a string and MySQL rejects it. So the value
    // has to be forced to a whole number in range here, never the caller's text.
    const asked = Number((req.query as { limit?: string })?.limit)
    const limit = Number.isFinite(asked) ? Math.min(200, Math.max(1, Math.trunc(asked))) : 50
    const rows = await all<DownloadRow>(
      db,
      `SELECT id, filename, page_count, byte_size, created_at
       FROM downloads WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ${limit}`,
      [req.user.id],
    )
    return reply.send({
      downloads: rows.map((r) => ({
        id: r.id,
        filename: r.filename,
        pageCount: r.page_count,
        byteSize: r.byte_size,
        createdAt: r.created_at,
      })),
    })
  })
}
