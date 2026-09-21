import bcrypt from 'bcryptjs'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { one, run } from './db.js'
import type { Db } from './db.js'

export const BCRYPT_ROUNDS = 12

export interface User {
  id: number
  email: string
  password_hash: string
  verified_at: string | null
  created_at: string
  marketing_opt_in: number
  marketing_opt_in_at: string | null
  signup_source: string | null
}

export interface SignupExtras {
  marketingOptIn?: boolean
  signupSource?: string
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

export function findUserByEmail(db: Db, email: string): Promise<User | undefined> {
  return one<User>(db, 'SELECT * FROM users WHERE email = ?', [email])
}

export function findUserById(db: Db, id: number): Promise<User | undefined> {
  return one<User>(db, 'SELECT * FROM users WHERE id = ?', [id])
}

export async function createUser(
  db: Db,
  email: string,
  passwordHash: string,
  extras: SignupExtras = {},
): Promise<User> {
  const optIn = extras.marketingOptIn ? 1 : 0
  const result = await run(
    db,
    `INSERT INTO users (email, password_hash, marketing_opt_in, marketing_opt_in_at, signup_source)
     VALUES (?, ?, ?, CASE WHEN ? = 1 THEN UTC_TIMESTAMP() END, ?)`,
    [email, passwordHash, optIn, optIn, extras.signupSource ?? null],
  )
  return (await findUserById(db, result.insertId))!
}

export async function setMarketingOptIn(db: Db, userId: number, on: boolean): Promise<void> {
  await run(
    db,
    `UPDATE users SET marketing_opt_in = ?,
       marketing_opt_in_at = CASE WHEN ? = 1 THEN UTC_TIMESTAMP() END
     WHERE id = ?`,
    [on ? 1 : 0, on ? 1 : 0, userId],
  )
}

export interface CreatedSession {
  secret: string
  expiresAt: Date
}

export async function createSession(
  db: Db,
  userId: number,
  ttlDays: number,
  ip?: string,
  userAgent?: string,
): Promise<CreatedSession> {
  const secret = newSecret()
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000)
  await run(
    db,
    `INSERT INTO sessions (id_hash, user_id, expires_at, last_seen_at, ip, user_agent)
     VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?)`,
    [hashSecret(secret), userId, iso(expiresAt), ip ?? null, userAgent ?? null],
  )
  return { secret, expiresAt }
}

export async function userForSession(db: Db, secret: string): Promise<User | undefined> {
  const row = await one<SessionRow>(
    db,
    'SELECT * FROM sessions WHERE id_hash = ? AND expires_at > UTC_TIMESTAMP()',
    [hashSecret(secret)],
  )
  if (!row) return undefined
  await run(db, 'UPDATE sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id_hash = ?', [
    row.id_hash,
  ])
  return findUserById(db, row.user_id)
}

export async function deleteSession(db: Db, secret: string): Promise<void> {
  await run(db, 'DELETE FROM sessions WHERE id_hash = ?', [hashSecret(secret)])
}

export async function deleteAllSessions(db: Db, userId: number): Promise<void> {
  await run(db, 'DELETE FROM sessions WHERE user_id = ?', [userId])
}

export type TokenKind = 'verify' | 'reset'

export async function createEmailToken(
  db: Db,
  userId: number,
  kind: TokenKind,
  ttlMinutes: number,
): Promise<string> {
  // One live token of each kind per user keeps old links from piling up.
  await run(
    db,
    `UPDATE email_tokens SET used_at = UTC_TIMESTAMP()
     WHERE user_id = ? AND kind = ? AND used_at IS NULL`,
    [userId, kind],
  )
  const secret = newSecret()
  await run(
    db,
    'INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)',
    [hashSecret(secret), userId, kind, iso(new Date(Date.now() + ttlMinutes * 60_000))],
  )
  return secret
}

export async function consumeEmailToken(
  db: Db,
  secret: string,
  kind: TokenKind,
): Promise<User | undefined> {
  const hash = hashSecret(secret)
  const row = await one<{ user_id: number }>(
    db,
    `SELECT * FROM email_tokens
     WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
    [hash, kind],
  )
  if (!row) return undefined
  await run(db, 'UPDATE email_tokens SET used_at = UTC_TIMESTAMP() WHERE token_hash = ?', [hash])
  return findUserById(db, row.user_id)
}

export async function markVerified(db: Db, userId: number): Promise<void> {
  await run(db, 'UPDATE users SET verified_at = UTC_TIMESTAMP() WHERE id = ? AND verified_at IS NULL', [
    userId,
  ])
}

export async function setPassword(db: Db, userId: number, passwordHash: string): Promise<void> {
  await run(db, 'UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId])
}

/**
 * Close an account for good. Sessions, email tokens and download records all
 * reference the user with ON DELETE CASCADE, so this one statement takes
 * everything the server holds about them.
 */
export async function deleteUser(db: Db, userId: number): Promise<void> {
  await run(db, 'DELETE FROM users WHERE id = ?', [userId])
}

/** Housekeeping: drop expired sessions and spent tokens. */
export async function pruneExpired(db: Db): Promise<void> {
  await run(db, 'DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()')
  await run(db, 'DELETE FROM email_tokens WHERE expires_at <= UTC_TIMESTAMP() - INTERVAL 7 DAY')
}
