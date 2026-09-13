/**
 * Print the people who asked to hear from Eight Mile as CSV, for the mailing
 * tool. Verified accounts only, so every address has been confirmed.
 *
 *   DATABASE_PATH=./dev.db npm run leads:dev            # development
 *   docker exec <api container> npm run leads > leads.csv   # production
 */
import { loadConfig } from '../config.js'
import { openDb } from '../db.js'

interface LeadRow {
  email: string
  marketing_opt_in_at: string | null
  signup_source: string | null
  downloads: number
  created_at: string
}

const csv = (v: string | number | null) => {
  const s = v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const db = openDb(loadConfig().DATABASE_PATH)
const rows = db
  .prepare(
    `SELECT u.email, u.marketing_opt_in_at, u.signup_source, u.created_at,
            (SELECT COUNT(*) FROM downloads d WHERE d.user_id = u.id) AS downloads
     FROM users u
     WHERE u.marketing_opt_in = 1 AND u.verified_at IS NOT NULL
     ORDER BY u.marketing_opt_in_at`,
  )
  .all() as LeadRow[]
db.close()

const lines = ['email,opted_in_at,signup_source,downloads,created_at']
for (const r of rows) {
  lines.push(
    [r.email, r.marketing_opt_in_at, r.signup_source, r.downloads, r.created_at].map(csv).join(','),
  )
}
process.stdout.write(lines.join('\n') + '\n')
