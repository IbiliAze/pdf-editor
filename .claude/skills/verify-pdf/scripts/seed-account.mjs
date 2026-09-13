// Write a confirmed account and a live session straight into the API's
// database, so an end-to-end run skips the email round trip and never spends
// the login rate limit.
//
//   node seed-account.mjs <database> [email]
//
// Prints { email, password, cookie: { name, value } } as JSON. The API must have
// started once against the same database, so the schema exists.
import { createHash, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'

// better-sqlite3 and bcryptjs are the server's dependencies, not the app's.
const require = createRequire(new URL('../../../../server/package.json', import.meta.url))
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

const [dbPath, email = 'verify@example.com'] = process.argv.slice(2)
if (!dbPath) {
  console.error('usage: node seed-account.mjs <database> [email]')
  process.exit(2)
}

const db = new Database(dbPath, { fileMustExist: true })
db.pragma('foreign_keys = ON')
const hasSchema = db
  .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
  .get()
if (!hasSchema) {
  console.error(`${dbPath} has no users table. Start the API against it once first.`)
  process.exit(1)
}

const password = 'verify-pdf password'
db.prepare(
  `INSERT INTO users (email, password_hash, verified_at) VALUES (?, ?, datetime('now'))
   ON CONFLICT(email) DO UPDATE SET
     password_hash = excluded.password_hash,
     verified_at = COALESCE(users.verified_at, datetime('now'))`,
).run(email, bcrypt.hashSync(password, 10))
const { id } = db.prepare('SELECT id FROM users WHERE email = ?').get(email)

// The same scheme as server/src/auth.ts: the cookie carries the secret and the
// table stores its sha256.
const secret = randomBytes(32).toString('base64url')
db.prepare(
  `INSERT INTO sessions (id_hash, user_id, expires_at, last_seen_at)
   VALUES (?, ?, datetime('now', '+1 day'), datetime('now'))`,
).run(createHash('sha256').update(secret).digest('hex'), id)
db.close()

console.log(JSON.stringify({ email, password, cookie: { name: 'em_session', value: secret } }))
