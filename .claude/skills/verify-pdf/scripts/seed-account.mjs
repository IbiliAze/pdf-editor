// Write a confirmed account and a live session straight into the API's
// database, so an end-to-end run skips the email round trip and never spends
// the login rate limit.
//
//   node seed-account.mjs [email]
//
// Prints { email, password, cookie: { name, value } } as JSON. Reads the same
// DB_* variables as the API (see db.mjs). The API must have started once
// against the same database, so the schema exists.
import { createHash, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { connect, settings } from './db.mjs'

const require = createRequire(new URL('../../../../server/package.json', import.meta.url))
const bcrypt = require('bcryptjs')

const [email = 'verify@example.com'] = process.argv.slice(2)
const db = await connect()

const [tables] = await db.query('SHOW TABLES LIKE ?', ['users'])
if (tables.length === 0) {
  console.error(`${settings.database} has no users table. Start the API against it once first.`)
  process.exit(1)
}

const password = 'verify-pdf password'
await db.execute(
  `INSERT INTO users (email, password_hash, verified_at) VALUES (?, ?, UTC_TIMESTAMP())
   ON DUPLICATE KEY UPDATE
     password_hash = VALUES(password_hash),
     verified_at = COALESCE(verified_at, UTC_TIMESTAMP())`,
  [email, bcrypt.hashSync(password, 10)],
)
const [[{ id }]] = await db.execute('SELECT id FROM users WHERE email = ?', [email])

// The same scheme as server/src/auth.ts: the cookie carries the secret and the
// table stores its sha256.
const secret = randomBytes(32).toString('base64url')
await db.execute(
  `INSERT INTO sessions (id_hash, user_id, expires_at, last_seen_at)
   VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 1 DAY, UTC_TIMESTAMP())`,
  [createHash('sha256').update(secret).digest('hex'), id],
)
await db.end()

console.log(JSON.stringify({ email, password, cookie: { name: 'em_session', value: secret } }))
