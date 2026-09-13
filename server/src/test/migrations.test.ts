import { describe, expect, it } from 'vitest'
import { openDb } from '../db.js'
import { migrate } from '../migrations.js'

describe('migrations', () => {
  it('creates the schema and is safe to run again', () => {
    const db = openDb(':memory:')
    const version = db.prepare('SELECT version FROM schema_version').get() as { version: number }
    expect(version.version).toBeGreaterThan(0)
    expect(migrate(db)).toBe(version.version)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[]
    const names = tables.map((t) => t.name)
    expect(names).toContain('users')
    expect(names).toContain('sessions')
    expect(names).toContain('email_tokens')
    expect(names).toContain('downloads')
    db.close()
  })

  it('rejects a duplicate address regardless of case', () => {
    const db = openDb(':memory:')
    const insert = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    insert.run('a@example.com', 'x')
    expect(() => insert.run('A@Example.com', 'x')).toThrow()
    db.close()
  })

  it('removes a user’s rows with the user', () => {
    const db = openDb(':memory:')
    db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('a@example.com', 'x')
    db.prepare('INSERT INTO downloads (user_id, filename) VALUES (1, ?)').run('a.pdf')
    db.prepare('DELETE FROM users WHERE id = 1').run()
    const left = db.prepare('SELECT COUNT(*) AS n FROM downloads').get() as { n: number }
    expect(left.n).toBe(0)
    db.close()
  })
})
