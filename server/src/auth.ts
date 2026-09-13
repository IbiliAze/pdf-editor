import bcrypt from 'bcryptjs'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Db } from './db.js'

export const BCRYPT_ROUNDS = 12

export interface User {
  id: number
  email: string
  password_hash: string
  verified_at: string | null
  created_at: string
}

export interface SessionRow {
  id_hash: string
  user_id: number
  expires_at: string
}

/** Opaque secrets are stored hashed, so a database leak is not a login. */
export const newSecret = (): string => randomBytes(32).toString('base64url')
export const hashSecret = (secret: string): string =>
  createHash('sha256').update(secret).digest('hex')

export const hashPassword = (pw: string): Promise<string> => bcrypt.hash(pw, BCRYPT_ROUNDS)
export const verifyPassword = (pw: string, hash: string): Promise<boolean> =>
  bcrypt.compare(pw, hash)

/** Constant-time compare of two hex digests. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

const iso = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19)

export function findUserByEmail(db: Db, email: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined
}

export function findUserById(db: Db, id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
}

export function createUser(db: Db, email: string, passwordHash: string): User {
  const info = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, passwordHash)
  return findUserById(db, Number(info.lastInsertRowid))!
}

export interface CreatedSession {
  secret: string
  expiresAt: Date
}

export function createSession(
  db: Db,
  userId: number,
  ttlDays: number,
  ip?: string,
  userAgent?: string,
): CreatedSession {
  const secret = newSecret()
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000)
  db.prepare(
    `INSERT INTO sessions (id_hash, user_id, expires_at, last_seen_at, ip, user_agent)
     VALUES (?, ?, ?, datetime('now'), ?, ?)`,
  ).run(hashSecret(secret), userId, iso(expiresAt), ip ?? null, userAgent ?? null)
  return { secret, expiresAt }
}

export function userForSession(db: Db, secret: string): User | undefined {
  const row = db
    .prepare(`SELECT * FROM sessions WHERE id_hash = ? AND expires_at > datetime('now')`)
    .get(hashSecret(secret)) as SessionRow | undefined
  if (!row) return undefined
  db.prepare(`UPDATE sessions SET last_seen_at = datetime('now') WHERE id_hash = ?`).run(
    row.id_hash,
  )
  return findUserById(db, row.user_id)
}

export function deleteSession(db: Db, secret: string): void {
  db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hashSecret(secret))
}

export function deleteAllSessions(db: Db, userId: number): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

export type TokenKind = 'verify' | 'reset'

export function createEmailToken(
  db: Db,
  userId: number,
  kind: TokenKind,
  ttlMinutes: number,
): string {
  // One live token of each kind per user keeps old links from piling up.
  db.prepare(
    `UPDATE email_tokens SET used_at = datetime('now')
     WHERE user_id = ? AND kind = ? AND used_at IS NULL`,
  ).run(userId, kind)
  const secret = newSecret()
  db.prepare(
    'INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)',
  ).run(hashSecret(secret), userId, kind, iso(new Date(Date.now() + ttlMinutes * 60_000)))
  return secret
}

export function consumeEmailToken(db: Db, secret: string, kind: TokenKind): User | undefined {
  const hash = hashSecret(secret)
  const row = db
    .prepare(
      `SELECT * FROM email_tokens
       WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > datetime('now')`,
    )
    .get(hash, kind) as { user_id: number } | undefined
  if (!row) return undefined
  db.prepare(`UPDATE email_tokens SET used_at = datetime('now') WHERE token_hash = ?`).run(hash)
  return findUserById(db, row.user_id)
}

export function markVerified(db: Db, userId: number): void {
  db.prepare(`UPDATE users SET verified_at = datetime('now') WHERE id = ? AND verified_at IS NULL`).run(
    userId,
  )
}

export function setPassword(db: Db, userId: number, passwordHash: string): void {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId)
}

/** Housekeeping: drop expired sessions and spent tokens. */
export function pruneExpired(db: Db): void {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run()
  db.prepare(
    `DELETE FROM email_tokens WHERE expires_at <= datetime('now', '-7 days')`,
  ).run()
}
