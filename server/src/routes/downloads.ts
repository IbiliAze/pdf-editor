import { z } from 'zod'
import type { FastifyInstance } from 'fastify'

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
      db.prepare(
        'INSERT INTO downloads (user_id, filename, page_count, byte_size) VALUES (?, ?, ?, ?)',
      ).run(req.user.id, filename, pageCount, byteSize)
      return reply.code(201).send({ ok: true })
    },
  )

  app.get('/api/downloads', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthenticated' })
    const limit = Math.min(200, Number((req.query as { limit?: string })?.limit) || 50)
    const rows = db
      .prepare(
        `SELECT id, filename, page_count, byte_size, created_at
         FROM downloads WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
      )
      .all(req.user.id, limit) as DownloadRow[]
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
